# Certificate Studio

A local, offline certificate generation platform built for Bit By Bit, VIT Bhopal University. It provides a drag-and-drop web interface for placing recipient fields on a certificate template, previewing the result, and batch-generating certificates for large recipient lists exported as a single downloadable ZIP.

## Overview

Certificate Studio removes the need for manually editing certificates one by one in design software. An organizer uploads a blank certificate template and a CSV of recipients, positions the name and registration number fields visually on a canvas, and generates print-ready PDF certificates for every recipient in one batch operation. The entire pipeline runs locally, with no external services or internet dependency required at generation time.

## Features

- **Drag-and-drop field editor** — Position and resize the Name and Registration Number fields directly on the certificate template using an interactive canvas.
- **Live preview** — Generate a sample certificate with placeholder data before committing to a full batch run.
- **CSV recipient validation** — Upload a recipient list and receive automatic detection of the name and registration columns, along with validation for empty fields and duplicate registration numbers.
- **Batch generation** — Render certificates for every recipient in the CSV and package them into a single ZIP archive of individually named PDF files.
- **Background job processing** — Batch runs execute asynchronously with progress tracking, so the interface remains responsive during large runs.
- **Font and style controls** — Choose from bundled TTF fonts, adjust size, color, bold/italic styling, and text alignment per field.
- **Auto-fit text** — Text automatically shrinks to fit within its bounding box if it would otherwise overflow.
- **Fully offline** — No external APIs or network calls are required once dependencies are installed.

## Tech Stack

**Backend**
- Python 3
- FastAPI
- Pillow (PIL) for image and PDF rendering
- Uvicorn as the ASGI server

**Frontend**
- HTML, CSS, and vanilla JavaScript
- Canvas-based visual field editor

## Project Structure

```
Certificate_GEN/
├── app.py                  # FastAPI application and API routes
├── cert_engine.py          # Core rendering and batch generation logic
├── test_cert.py            # Standalone script for testing the rendering engine
├── requirements.txt        # Python dependencies
├── sample_50_recipients.csv# Example recipient CSV for testing
├── sample_template.png     # Example certificate template
├── static/
│   ├── index.html          # Main web application
│   ├── logo.png
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js          # Application logic (upload, CSV, batch flow)
│   │   └── editor.js        # Canvas-based field placement editor
│   └── fonts/               # Bundled TTF fonts
├── uploads/                 # Uploaded certificate templates (runtime)
└── output/
    ├── previews/             # Generated preview images (runtime)
    └── batches/               # Generated batch ZIPs (runtime)
```

## Installation

1. Clone or download the repository.
2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate   # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

1. Start the server:
   ```bash
   uvicorn app:app --reload
   ```
2. Open `http://localhost:8000` in a browser.
3. **Step 1 — Upload Assets**: Upload a blank certificate template (PNG or JPG) and a recipient CSV file. The CSV should contain at least a name column and a registration number column; headers are matched automatically.
4. **Step 2 — Place & Style Fields**: Drag and resize the Name and Registration Number fields on the canvas, and configure font, size, color, and alignment. Use the preview to check the layout against sample data.
5. **Step 3 — Generate & Download**: Start batch generation to render a certificate for every recipient. Once processing completes, download the ZIP archive containing all certificates as individual PDF files.

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/fonts` | List available bundled fonts |
| `POST` | `/api/upload-template` | Upload a certificate template image |
| `POST` | `/api/validate-csv` | Validate and parse a recipient CSV |
| `POST` | `/api/generate-preview` | Generate a single sample certificate |
| `POST` | `/api/generate-batch` | Start a background batch generation job |
| `GET` | `/api/job-status/{job_id}` | Check the status of a batch job |
| `GET` | `/api/download/{job_id}` | Download the completed batch ZIP |

## Testing

A standalone test script is included to verify the rendering engine without running the full server:

```bash
python test_cert.py
```

This creates a dummy template, renders a sample certificate, and runs a small batch generation to confirm the pipeline is working correctly.

## Notes

- CSV recipient files should include a name column (e.g. `Name`, `Full Name`, `Student`) and a registration column (e.g. `Registration Number`, `Reg No`, `Roll Number`, `ID`). Column matching is case-insensitive and falls back to the first two columns if no header match is found.
- Generated certificates are exported as PDF files, named using a sanitized combination of registration number and recipient name.
- The `uploads/` and `output/` directories are created automatically at runtime and are used for storing uploaded templates and generated files.
