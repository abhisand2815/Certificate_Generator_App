import os
import io
import csv
import uuid
import time
from typing import Dict, Any, List
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image

from cert_engine import render_certificate, batch_generate, FONTS_DIR

app = FastAPI(title="Certificate Generator API")

# Enable CORS for local convenience
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
PREVIEWS_DIR = os.path.join(OUTPUT_DIR, "previews")
BATCHES_DIR = os.path.join(OUTPUT_DIR, "batches")

for d in [UPLOADS_DIR, OUTPUT_DIR, PREVIEWS_DIR, BATCHES_DIR]:
    os.makedirs(d, exist_ok=True)

# In-memory storage for batch jobs
# job_id -> { "status": "processing"|"completed"|"failed", "processed": int, "total": int, "zip_path": str, "error": str }
JOBS: Dict[str, Dict[str, Any]] = {}


class PreviewRequest(BaseModel):
    template_id: str
    field_configs: Dict[str, Any]
    sample_data: Dict[str, Any] = Field(default_factory=dict)


class BatchRequest(BaseModel):
    template_id: str
    field_configs: Dict[str, Any]
    recipients: List[Dict[str, Any]]


@app.get("/api/fonts")
def get_available_fonts():
    """Returns list of bundled TTF fonts available for rendering."""
    fonts = []
    if os.path.exists(FONTS_DIR):
        for f in os.listdir(FONTS_DIR):
            if f.lower().endswith(".ttf"):
                fonts.append(f)
    return {"fonts": sorted(fonts)}


@app.post("/api/upload-template")
async def upload_template(file: UploadFile = File(...)):
    """Upload certificate template image (PNG or JPG)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".png", ".jpg", ".jpeg"]:
        raise HTTPException(status_code=400, detail="Only PNG and JPG images are supported")
    
    template_id = uuid.uuid4().hex
    save_filename = f"{template_id}{ext}"
    save_path = os.path.join(UPLOADS_DIR, save_filename)

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    # Validate image & extract width/height
    try:
        with Image.open(save_path) as img:
            w, h = img.size
    except Exception as e:
        os.remove(save_path)
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    return {
        "template_id": template_id,
        "filename": save_filename,
        "width": w,
        "height": h,
        "url": f"/uploads/{save_filename}"
    }


@app.post("/api/validate-csv")
async def validate_csv(file: UploadFile = File(...)):
    """Parse and validate uploaded recipient CSV file."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a valid .csv file")

    content_bytes = await file.read()
    try:
        content_str = content_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        content_str = content_bytes.decode("latin-1")

    csv_file = io.StringIO(content_str)
    reader = csv.reader(csv_file)
    rows = list(reader)

    if not rows:
        return {"valid": False, "total_rows": 0, "valid_rows": [], "errors": ["CSV file is empty"], "duplicates": []}

    # Find header row
    header = [col.strip() for col in rows[0]]
    header_lower = [h.lower() for h in header]

    # Map name & reg_no columns
    name_col_idx = -1
    reg_col_idx = -1

    for idx, h in enumerate(header_lower):
        if any(k in h for k in ["name", "recipient", "student", "full name"]):
            name_col_idx = idx
            break
    
    for idx, h in enumerate(header_lower):
        if any(k in h for k in ["reg", "registration", "id", "roll", "number", "code"]):
            reg_col_idx = idx
            break

    # If no header match, fallback to column 0 (Name) and column 1 (Reg No) if 2+ columns exist
    if name_col_idx == -1 and len(header) >= 1:
        name_col_idx = 0
    if reg_col_idx == -1 and len(header) >= 2:
        reg_col_idx = 1 if name_col_idx != 1 else 0

    valid_rows = []
    errors = []
    seen_reg_nos = set()
    duplicate_regs = set()

    data_rows = rows[1:] if len(rows) > 1 else []

    for row_idx, row in enumerate(data_rows, start=2):
        if not any(cell.strip() for cell in row):
            continue  # Skip completely empty rows
        
        name_val = row[name_col_idx].strip() if name_col_idx < len(row) else ""
        reg_val = row[reg_col_idx].strip() if reg_col_idx < len(row) else ""

        row_errors = []
        if not name_val:
            row_errors.append(f"Row {row_idx}: Name field is empty")
        if not reg_val:
            row_errors.append(f"Row {row_idx}: Registration Number field is empty")
        
        if reg_val:
            if reg_val in seen_reg_nos:
                duplicate_regs.add(reg_val)
                row_errors.append(f"Row {row_idx}: Duplicate Registration Number '{reg_val}'")
            else:
                seen_reg_nos.add(reg_val)

        if row_errors:
            errors.extend(row_errors)
        
        valid_rows.append({
            "name": name_val,
            "reg_no": reg_val,
            "row_num": row_idx,
            "has_error": len(row_errors) > 0
        })

    is_valid = len(errors) == 0 and len(valid_rows) > 0

    return {
        "valid": is_valid,
        "total_rows": len(valid_rows),
        "valid_rows": valid_rows,
        "errors": errors,
        "duplicates": list(duplicate_regs)
    }


@app.post("/api/generate-preview")
def generate_preview(req: PreviewRequest):
    """Generate a single sample certificate image preview."""
    # Locate template image file
    template_filename = None
    for ext in [".png", ".jpg", ".jpeg"]:
        candidate = os.path.join(UPLOADS_DIR, f"{req.template_id}{ext}")
        if os.path.exists(candidate):
            template_filename = candidate
            break

    if not template_filename:
        raise HTTPException(status_code=404, detail="Template image not found")

    sample = req.sample_data or {"name": "Alexander John Doe", "reg_no": "REG-2026-001"}
    output_filename = f"preview_{req.template_id}.png"
    output_path = os.path.join(PREVIEWS_DIR, output_filename)

    try:
        render_certificate(template_filename, req.field_configs, sample, output_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render preview: {str(e)}")

    timestamp = int(time.time() * 1000)
    return {"preview_url": f"/output/previews/{output_filename}?t={timestamp}"}


def run_batch_worker(job_id: str, template_path: str, field_configs: dict, recipients: list):
    """Background task function to process batch generation."""
    try:
        def update_progress(current, total):
            if job_id in JOBS:
                JOBS[job_id]["processed"] = current

        job_dir = os.path.join(BATCHES_DIR, job_id)
        zip_path = os.path.join(BATCHES_DIR, f"certificates_{job_id}.zip")

        batch_generate(
            template_path=template_path,
            field_configs=field_configs,
            recipient_rows=recipients,
            output_dir=job_dir,
            zip_output_path=zip_path,
            progress_callback=update_progress
        )

        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["zip_path"] = zip_path
        JOBS[job_id]["download_url"] = f"/api/download/{job_id}"
    except Exception as e:
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)


@app.post("/api/generate-batch")
def start_batch_generation(req: BatchRequest, background_tasks: BackgroundTasks):
    """Start background task for batch certificate generation."""
    template_path = None
    for ext in [".png", ".jpg", ".jpeg"]:
        candidate = os.path.join(UPLOADS_DIR, f"{req.template_id}{ext}")
        if os.path.exists(candidate):
            template_path = candidate
            break

    if not template_path:
        raise HTTPException(status_code=404, detail="Template image not found")

    if not req.recipients:
        raise HTTPException(status_code=400, detail="Recipient list is empty")

    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = {
        "status": "processing",
        "processed": 0,
        "total": len(req.recipients),
        "zip_path": None,
        "download_url": None,
        "error": None
    }

    background_tasks.add_task(
        run_batch_worker,
        job_id,
        template_path,
        req.field_configs,
        req.recipients
    )

    return {"job_id": job_id, "total": len(req.recipients)}


@app.get("/api/job-status/{job_id}")
def get_job_status(job_id: str):
    """Check background batch task progress."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    return JOBS[job_id]


@app.get("/api/download/{job_id}")
def download_batch_zip(job_id: str):
    """Download compiled ZIP containing generated certificates."""
    if job_id not in JOBS or JOBS[job_id]["status"] != "completed":
        raise HTTPException(status_code=404, detail="Batch ZIP not ready or job not found")
    
    zip_path = JOBS[job_id].get("zip_path")
    if not zip_path or not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="ZIP file missing on server")

    return FileResponse(
        zip_path,
        filename="Certificates_Batch.zip",
        media_type="application/zip"
    )

# Static file routes
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/output", StaticFiles(directory=OUTPUT_DIR), name="output")

@app.get("/")
def read_index():
    """Serve main frontend web app."""
    return FileResponse(os.path.join(BASE_DIR, "static", "index.html"))
