/**
 * Visual Drag-and-Drop Editor for Certificate Text Placement
 * Handles percentage-based positioning, dragging, and resizing handles.
 */

class PlacementEditor {
  constructor(containerId, imgId, options = {}) {
    this.container = document.getElementById(containerId);
    this.img = document.getElementById(imgId);

    this.onConfigChange = options.onConfigChange || null;

    // Field configuration objects storing percentage values
    this.configs = {
      name: {
        x_percent: 15.0,
        y_percent: 42.0,
        width_percent: 70.0,
        height_percent: 12.0,
        font_family: "Arial-Bold.ttf",
        font_size_pt: 48,
        font_color: "#1E3A8A",
        alignment: "center",
        is_bold: true,
        is_italic: false
      },
      reg_no: {
        x_percent: 30.0,
        y_percent: 62.0,
        width_percent: 40.0,
        height_percent: 8.0,
        font_family: "Arial.ttf",
        font_size_pt: 26,
        font_color: "#334155",
        alignment: "center",
        is_bold: false,
        is_italic: false
      }
    };

    this.activeField = "name";
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.dragStart = { x: 0, y: 0 };
    this.initialBoxRect = { x: 0, y: 0, w: 0, h: 0 };

    this.boxes = {};

    // Wait for template image load before rendering overlays
    if (this.img.complete) {
      this.init();
    } else {
      this.img.addEventListener("load", () => this.init());
    }

    window.addEventListener("resize", () => this.refreshBoxPositions());
  }

  init() {
    this.createOverlayBox("name", "Name Field", "John Doe");
    this.createOverlayBox("reg_no", "Reg No Field", "REG-2026-001");
    this.selectField(this.activeField);
    this.refreshBoxPositions();

    // Global mouse/touch move and up listeners
    window.addEventListener("mousemove", (e) => this.handlePointerMove(e));
    window.addEventListener("mouseup", () => this.handlePointerUp());

    window.addEventListener("touchmove", (e) => this.handlePointerMove(e.touches[0]), { passive: false });
    window.addEventListener("touchend", () => this.handlePointerUp());
  }

  createOverlayBox(fieldKey, labelText, sampleText) {
    const box = document.createElement("div");
    box.className = `drag-box ${fieldKey}`;
    box.dataset.field = fieldKey;

    const label = document.createElement("div");
    label.className = "field-label-tag";
    label.innerText = labelText;
    box.appendChild(label);

    const textEl = document.createElement("div");
    textEl.className = "box-preview-text";
    textEl.innerText = sampleText;
    box.appendChild(textEl);

    // Add resize handles
    const handles = ["nw", "ne", "sw", "se"];
    handles.forEach((h) => {
      const handleEl = document.createElement("div");
      handleEl.className = `resize-handle ${h}`;
      handleEl.dataset.handle = h;
      box.appendChild(handleEl);

      handleEl.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        this.startResize(e, fieldKey, h);
      });
      handleEl.addEventListener("touchstart", (e) => {
        e.stopPropagation();
        this.startResize(e.touches[0], fieldKey, h);
      });
    });

    box.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      this.selectField(fieldKey);
      this.startDrag(e, fieldKey);
    });

    box.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      this.selectField(fieldKey);
      this.startDrag(e.touches[0], fieldKey);
    });

    this.container.appendChild(box);
    this.boxes[fieldKey] = box;
  }

  selectField(fieldKey) {
    this.activeField = fieldKey;
    Object.keys(this.boxes).forEach((k) => {
      if (k === fieldKey) {
        this.boxes[k].classList.add("selected");
      } else {
        this.boxes[k].classList.remove("selected");
      }
    });

    if (this.onConfigChange) {
      this.onConfigChange(fieldKey, this.configs[fieldKey]);
    }
  }

  updateSampleText(nameText, regText) {
    if (this.boxes["name"]) {
      this.boxes["name"].querySelector(".box-preview-text").innerText = nameText || "John Doe";
    }
    if (this.boxes["reg_no"]) {
      this.boxes["reg_no"].querySelector(".box-preview-text").innerText = regText || "REG-2026-001";
    }
  }

  updateFieldStyle(fieldKey, styleUpdates) {
    if (!this.configs[fieldKey]) return;
    Object.assign(this.configs[fieldKey], styleUpdates);

    const box = this.boxes[fieldKey];
    if (box) {
      const textEl = box.querySelector(".box-preview-text");
      const cfg = this.configs[fieldKey];

      textEl.style.color = cfg.font_color || "#ffffff";
      textEl.style.textAlign = cfg.alignment || "center";
      textEl.style.fontWeight = cfg.is_bold ? "bold" : "normal";
      textEl.style.fontStyle = cfg.is_italic ? "italic" : "normal";
      if (cfg.font_family) {
        textEl.style.fontFamily = `"${cfg.font_family.replace('.ttf', '')}", cursive, sans-serif`;
      }

      // Scale font size proportionally for DOM preview
      const imgRect = this.img.getBoundingClientRect();
      const scale = imgRect.width / (this.img.naturalWidth || 1000);
      const displaySize = Math.max(12, Math.round(cfg.font_size_pt * scale));
      textEl.style.fontSize = `${displaySize}px`;
    }

    if (this.onConfigChange) {
      this.onConfigChange(fieldKey, this.configs[fieldKey]);
    }
  }

  refreshBoxPositions() {
    const imgRect = this.img.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    const imgLeft = imgRect.left - containerRect.left;
    const imgTop = imgRect.top - containerRect.top;
    const imgW = imgRect.width;
    const imgH = imgRect.height;

    Object.keys(this.configs).forEach((fieldKey) => {
      const cfg = this.configs[fieldKey];
      const box = this.boxes[fieldKey];
      if (!box || imgW === 0 || imgH === 0) return;

      const leftPx = imgLeft + (cfg.x_percent / 100) * imgW;
      const topPx = imgTop + (cfg.y_percent / 100) * imgH;
      const widthPx = (cfg.width_percent / 100) * imgW;
      const heightPx = (cfg.height_percent / 100) * imgH;

      box.style.left = `${leftPx}px`;
      box.style.top = `${topPx}px`;
      box.style.width = `${widthPx}px`;
      box.style.height = `${heightPx}px`;

      this.updateFieldStyle(fieldKey, {});
    });
  }

  startDrag(e, fieldKey) {
    this.isDragging = true;
    this.activeField = fieldKey;
    this.dragStart = { x: e.clientX, y: e.clientY };

    const cfg = this.configs[fieldKey];
    this.initialBoxRect = {
      x: cfg.x_percent,
      y: cfg.y_percent,
      w: cfg.width_percent,
      h: cfg.height_percent
    };
  }

  startResize(e, fieldKey, handle) {
    this.isResizing = true;
    this.resizeHandle = handle;
    this.activeField = fieldKey;
    this.dragStart = { x: e.clientX, y: e.clientY };

    const cfg = this.configs[fieldKey];
    this.initialBoxRect = {
      x: cfg.x_percent,
      y: cfg.y_percent,
      w: cfg.width_percent,
      h: cfg.height_percent
    };
  }

  handlePointerMove(e) {
    if (!this.isDragging && !this.isResizing) return;
    if (e.preventDefault) e.preventDefault();

    const imgRect = this.img.getBoundingClientRect();
    if (imgRect.width === 0 || imgRect.height === 0) return;

    const deltaX = e.clientX - this.dragStart.x;
    const deltaY = e.clientY - this.dragStart.y;

    const deltaXPct = (deltaX / imgRect.width) * 100;
    const deltaYPct = (deltaY / imgRect.height) * 100;

    const cfg = this.configs[this.activeField];
    const init = this.initialBoxRect;

    if (this.isDragging) {
      let newX = init.x + deltaXPct;
      let newY = init.y + deltaYPct;

      // Clamp within 0-100% boundary
      newX = Math.max(0, Math.min(100 - init.w, newX));
      newY = Math.max(0, Math.min(100 - init.h, newY));

      cfg.x_percent = Math.round(newX * 10) / 10;
      cfg.y_percent = Math.round(newY * 10) / 10;
    } else if (this.isResizing) {
      const handle = this.resizeHandle;
      let newX = init.x;
      let newY = init.y;
      let newW = init.w;
      let newH = init.h;

      if (handle.includes("e")) {
        newW = Math.max(5, Math.min(100 - init.x, init.w + deltaXPct));
      }
      if (handle.includes("s")) {
        newH = Math.max(3, Math.min(100 - init.y, init.h + deltaYPct));
      }
      if (handle.includes("w")) {
        const potentialW = init.w - deltaXPct;
        if (potentialW >= 5 && init.x + deltaXPct >= 0) {
          newX = init.x + deltaXPct;
          newW = potentialW;
        }
      }
      if (handle.includes("n")) {
        const potentialH = init.h - deltaYPct;
        if (potentialH >= 3 && init.y + deltaYPct >= 0) {
          newY = init.y + deltaYPct;
          newH = potentialH;
        }
      }

      cfg.x_percent = Math.round(newX * 10) / 10;
      cfg.y_percent = Math.round(newY * 10) / 10;
      cfg.width_percent = Math.round(newW * 10) / 10;
      cfg.height_percent = Math.round(newH * 10) / 10;
    }

    this.refreshBoxPositions();
  }

  handlePointerUp() {
    if (this.isDragging || this.isResizing) {
      this.isDragging = false;
      this.isResizing = false;
      this.resizeHandle = null;

      if (this.onConfigChange) {
        this.onConfigChange(this.activeField, this.configs[this.activeField]);
      }
    }
  }

  getFieldConfigs() {
    return JSON.parse(JSON.stringify(this.configs));
  }
}
