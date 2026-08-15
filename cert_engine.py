import os
import re
import zipfile
from typing import Dict, List, Any, Callable
from PIL import Image, ImageDraw, ImageFont

FONTS_DIR = os.path.join(os.path.dirname(__file__), "static", "fonts")

def hex_to_rgb(hex_str: str) -> tuple:
    """Convert hex color string to RGB tuple."""
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 3:
        hex_str = ''.join([c*2 for c in hex_str])
    if len(hex_str) != 6:
        return (0, 0, 0)
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

def get_font_path(font_family: str, is_bold: bool = False) -> str:
    """Find local TTF font file path."""
    if is_bold and "Bold" not in font_family:
        bold_filename = font_family.replace(".ttf", "-Bold.ttf")
        bold_candidate = os.path.join(FONTS_DIR, bold_filename)
        if os.path.exists(bold_candidate):
            return bold_candidate

    font_path = os.path.join(FONTS_DIR, font_family)
    if os.path.exists(font_path):
        return font_path

    # Fallback to default Arial.ttf
    fallback = os.path.join(FONTS_DIR, "Arial.ttf")
    if os.path.exists(fallback):
        return fallback

    return ""

def sanitize_filename(text: str) -> str:
    """Sanitize string for safe filenames."""
    text = re.sub(r'[^\w\s-]', '', str(text)).strip()
    return re.sub(r'[-\s]+', '_', text) or "recipient"

def render_certificate(
    template_path: str,
    field_configs: Dict[str, Any],
    recipient_data: Dict[str, str],
    output_path: str
) -> str:
    """
    Renders a certificate by placing text fields onto the template image.
    
    field_configs format:
    {
        "name": {
            "x_percent": float,
            "y_percent": float,
            "width_percent": float,
            "height_percent": float,
            "font_family": str,
            "font_size_pt": int,
            "font_color": str,
            "alignment": "left" | "center" | "right",
            "is_bold": bool,
            "is_italic": bool
        },
        "reg_no": { ... }
    }
    """
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template image not found at {template_path}")

    # Open image
    img = Image.open(template_path).convert("RGB")
    img_w, img_h = img.size
    draw = ImageDraw.Draw(img)

    for field_key, config in field_configs.items():
        text = str(recipient_data.get(field_key, recipient_data.get(field_key.lower(), "")))
        if not text:
            continue

        # Extract percentages
        x_pct = float(config.get("x_percent", 10.0))
        y_pct = float(config.get("y_percent", 10.0))
        w_pct = float(config.get("width_percent", 80.0))
        h_pct = float(config.get("height_percent", 10.0))

        # Convert percentages to actual pixel values
        box_x = (x_pct / 100.0) * img_w
        box_y = (y_pct / 100.0) * img_h
        box_w = (w_pct / 100.0) * img_w
        box_h = (h_pct / 100.0) * img_h

        font_family = config.get("font_family", "Arial.ttf")
        initial_font_size = int(config.get("font_size_pt", 40))
        font_color_hex = config.get("font_color", "#000000")
        color_rgb = hex_to_rgb(font_color_hex)
        alignment = config.get("alignment", "center").lower()
        is_bold = bool(config.get("is_bold", False))

        font_path = get_font_path(font_family, is_bold=is_bold)
        current_font_size = initial_font_size

        # Auto-fit loop: shrink font size if text exceeds bounding box width or height
        font = None
        text_w = 0
        text_h = 0
        offset_y = 0

        while current_font_size >= 8:
            try:
                if font_path:
                    font = ImageFont.truetype(font_path, current_font_size)
                else:
                    font = ImageFont.load_default()
            except Exception:
                font = ImageFont.load_default()

            # Calculate text size using bbox
            bbox = draw.textbbox((0, 0), text, font=font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            offset_y = bbox[1]

            if text_w <= box_w and text_h <= box_h:
                break
            
            current_font_size -= 1
            if current_font_size < 8:
                break

        # Calculate alignment coordinates
        if alignment == "left":
            render_x = box_x
        elif alignment == "right":
            render_x = box_x + box_w - text_w
        else:  # center
            render_x = box_x + (box_w - text_w) / 2.0

        # Vertically center text in bounding box
        render_y = box_y + (box_h - text_h) / 2.0 - offset_y

        draw.text((render_x, render_y), text, fill=color_rgb, font=font)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    if output_path.lower().endswith(".pdf"):
        img.save(output_path, "PDF", resolution=100.0)
    else:
        img.save(output_path, quality=95)
    return output_path


def batch_generate(
    template_path: str,
    field_configs: Dict[str, Any],
    recipient_rows: List[Dict[str, str]],
    output_dir: str,
    zip_output_path: str,
    progress_callback: Callable[[int, int], None] = None
) -> str:
    """
    Renders certificates for all recipients and archives them as PDF files into a ZIP file.
    """
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(os.path.dirname(zip_output_path), exist_ok=True)

    generated_files = []
    total = len(recipient_rows)

    for idx, row in enumerate(recipient_rows):
        name = row.get("name", row.get("Name", f"Recipient_{idx+1}"))
        reg_no = row.get("reg_no", row.get("Registration Number", row.get("RegNo", f"REG{idx+1:03d}")))
        
        filename = f"{sanitize_filename(reg_no)}_{sanitize_filename(name)}.pdf"
        file_path = os.path.join(output_dir, filename)

        recipient_data = {
            "name": name,
            "reg_no": reg_no
        }

        render_certificate(template_path, field_configs, recipient_data, file_path)
        generated_files.append((filename, file_path))

        if progress_callback:
            progress_callback(idx + 1, total)

    # Create ZIP archive
    with zipfile.ZipFile(zip_output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for fname, fpath in generated_files:
            zipf.write(fpath, arcname=fname)

    return zip_output_path
