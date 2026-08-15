import os
from PIL import Image, ImageDraw
from cert_engine import render_certificate, batch_generate

def create_dummy_template(path="uploads/test_template.png"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img = Image.new("RGB", (1200, 800), color="#F8FAFC")
    draw = ImageDraw.Draw(img)
    # Draw simple frame border
    draw.rectangle([20, 20, 1180, 780], outline="#1E293B", width=5)
    draw.rectangle([30, 30, 1170, 770], outline="#64748B", width=2)
    img.save(path)
    print(f"Created template at {path}")
    return path

def test():
    template_path = create_dummy_template()
    
    field_configs = {
        "name": {
            "x_percent": 15.0,
            "y_percent": 40.0,
            "width_percent": 70.0,
            "height_percent": 15.0,
            "font_family": "Arial-Bold.ttf",
            "font_size_pt": 54,
            "font_color": "#0F172A",
            "alignment": "center",
            "is_bold": True
        },
        "reg_no": {
            "x_percent": 25.0,
            "y_percent": 65.0,
            "width_percent": 50.0,
            "height_percent": 8.0,
            "font_family": "Georgia.ttf",
            "font_size_pt": 28,
            "font_color": "#475569",
            "alignment": "center"
        }
    }
    
    sample_recipient = {
        "name": "Dr. Bartholomew Alexander Montgomery-Wellington III",
        "reg_no": "REG-2026-99482"
    }
    
    output_path = "output/previews/test_output.png"
    render_certificate(template_path, field_configs, sample_recipient, output_path)
    print(f"Rendered sample preview at {output_path}")

    # Test batch generation
    recipients = [
        {"name": "Alice Smith", "reg_no": "REG-001"},
        {"name": "Bob Johnson", "reg_no": "REG-002"},
        {"name": "Dr. Bartholomew Alexander Montgomery-Wellington III", "reg_no": "REG-003"}
    ]
    zip_path = "output/batches/test_batch.zip"
    batch_generate(
        template_path,
        field_configs,
        recipients,
        output_dir="output/batches/test_certs",
        zip_output_path=zip_path,
        progress_callback=lambda current, total: print(f"Progress: {current}/{total}")
    )
    print(f"Batch generation completed: {zip_path}")

if __name__ == "__main__":
    test()
