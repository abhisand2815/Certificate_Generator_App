/**
 * Certificate Studio - Main App Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  // App State
  const state = {
    currentStep: 1,
    templateId: null,
    templateUrl: null,
    templateWidth: 0,
    templateHeight: 0,
    csvData: null,
    editor: null,
    fonts: [],
    pollInterval: null
  };

  // DOM Elements
  const stepPanels = {
    1: document.getElementById("step-panel-1"),
    2: document.getElementById("step-panel-2"),
    3: document.getElementById("step-panel-3")
  };

  const stepNavs = {
    1: document.getElementById("step-nav-1"),
    2: document.getElementById("step-nav-2"),
    3: document.getElementById("step-nav-3")
  };

  // Step 1 Elements
  const templateDropzone = document.getElementById("template-dropzone");
  const templateInput = document.getElementById("template-input");
  const templateFileInfo = document.getElementById("template-file-info");
  const templateFilename = document.getElementById("template-filename");
  const templateDims = document.getElementById("template-dims");

  const csvDropzone = document.getElementById("csv-dropzone");
  const csvInput = document.getElementById("csv-input");
  const csvFileInfo = document.getElementById("csv-file-info");
  const csvFilename = document.getElementById("csv-filename");
  const csvCount = document.getElementById("csv-count");

  const csvResultsCard = document.getElementById("csv-results-card");
  const csvAlertsContainer = document.getElementById("csv-alerts-container");
  const recipientsTbody = document.getElementById("recipients-tbody");
  const validationSummaryBadges = document.getElementById("validation-summary-badges");

  const btnToStep2 = document.getElementById("btn-to-step2");

  // Step 2 Elements
  const editorCanvasContainer = document.getElementById("editor-canvas-container");
  const templatePreviewImg = document.getElementById("template-preview-img");

  const tabBtnName = document.getElementById("tab-btn-name");
  const tabBtnRegNo = document.getElementById("tab-btn-reg_no");

  const fontFamilySelect = document.getElementById("font-family-select");
  const fontSizeSlider = document.getElementById("font-size-slider");
  const fontSizeInput = document.getElementById("font-size-input");
  const fontColorPicker = document.getElementById("font-color-picker");
  const fontColorHex = document.getElementById("font-color-hex");

  const alignLeft = document.getElementById("align-left");
  const alignCenter = document.getElementById("align-center");
  const alignRight = document.getElementById("align-right");

  const toggleBold = document.getElementById("toggle-bold");
  const toggleItalic = document.getElementById("toggle-italic");

  const btnBackToStep1 = document.getElementById("btn-back-to-step1");
  const btnRenderPreview = document.getElementById("btn-render-preview");
  const btnToStep3 = document.getElementById("btn-to-step3");

  // Step 3 Elements
  const renderedPreviewImg = document.getElementById("rendered-preview-img");
  const sampleRecipientSelect = document.getElementById("sample-recipient-select");
  const batchSummaryText = document.getElementById("batch-summary-text");

  const btnStartBatch = document.getElementById("btn-start-batch");
  const batchProgressCard = document.getElementById("batch-progress-card");
  const batchStatusText = document.getElementById("batch-status-text");
  const batchProgressCount = document.getElementById("batch-progress-count");
  const batchProgressFill = document.getElementById("batch-progress-fill");
  const downloadSuccessBanner = document.getElementById("download-success-banner");
  const downloadZipLink = document.getElementById("download-zip-link");

  const btnBackToStep2 = document.getElementById("btn-back-to-step2");

  // Load available fonts from API
  fetchAvailableFonts();

  // ----------------------------------------------------
  // STEP NAVIGATION CONTROLLER
  // ----------------------------------------------------
  function switchStep(stepNum) {
    state.currentStep = stepNum;
    [1, 2, 3].forEach((s) => {
      if (s === stepNum) {
        stepPanels[s].classList.add("active");
        stepNavs[s].classList.add("active");
      } else {
        stepPanels[s].classList.remove("active");
        stepNavs[s].classList.remove("active");
      }
      if (s < stepNum) {
        stepNavs[s].classList.add("completed");
      } else {
        stepNavs[s].classList.remove("completed");
      }
    });

    if (stepNum === 2) {
      initEditorStep();
    } else if (stepNum === 3) {
      initPreviewStep();
    }
  }

  // ----------------------------------------------------
  // STEP 1: UPLOAD HANDLERS
  // ----------------------------------------------------
  setupDropzone(templateDropzone, templateInput, handleTemplateUpload);
  setupDropzone(csvDropzone, csvInput, handleCsvUpload);

  function setupDropzone(zoneEl, inputEl, handler) {
    zoneEl.addEventListener("click", () => inputEl.click());
    inputEl.addEventListener("change", (e) => {
      if (e.target.files.length > 0) handler(e.target.files[0]);
    });

    ["dragenter", "dragover"].forEach((evtName) => {
      zoneEl.addEventListener(evtName, (e) => {
        e.preventDefault();
        zoneEl.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((evtName) => {
      zoneEl.addEventListener(evtName, (e) => {
        e.preventDefault();
        zoneEl.classList.remove("dragover");
      });
    });

    zoneEl.addEventListener("drop", (e) => {
      if (e.dataTransfer.files.length > 0) {
        handler(e.dataTransfer.files[0]);
      }
    });
  }

  async function handleTemplateUpload(file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-template", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Template Upload Error: ${err.detail}`);
        return;
      }

      const data = await res.json();
      state.templateId = data.template_id;
      state.templateUrl = data.url;
      state.templateWidth = data.width;
      state.templateHeight = data.height;

      templateFilename.innerText = file.name;
      templateDims.innerText = `${data.width} × ${data.height} px`;
      templateFileInfo.style.display = "flex";

      checkStep1Completion();
    } catch (e) {
      alert(`Upload failed: ${e.message}`);
    }
  }

  async function handleCsvUpload(file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/validate-csv", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`CSV Validation Error: ${err.detail}`);
        return;
      }

      const data = await res.json();
      state.csvData = data;

      csvFilename.innerText = file.name;
      csvCount.innerText = `${data.total_rows} recipients`;
      csvFileInfo.style.display = "flex";

      renderCsvValidationResults(data);
      checkStep1Completion();
    } catch (e) {
      alert(`CSV Upload failed: ${e.message}`);
    }
  }

  function renderCsvValidationResults(data) {
    csvResultsCard.style.display = "block";
    csvAlertsContainer.innerHTML = "";
    recipientsTbody.innerHTML = "";

    // Summary Badges
    validationSummaryBadges.innerHTML = `
      <span class="badge-success">✓ ${data.valid_rows.length} Valid Rows</span>
      ${data.errors.length > 0 ? `<span class="badge-error">⚠️ ${data.errors.length} Issues Found</span>` : ""}
    `;

    // Alerts
    if (data.errors.length > 0) {
      const alertDiv = document.createElement("div");
      alertDiv.className = "alert alert-danger";
      alertDiv.innerHTML = `<strong>Validation Warnings Found:</strong><ul style="margin-left: 1rem; margin-top: 4px;">${data.errors.map(e => `<li>${e}</li>`).join("")}</ul>`;
      csvAlertsContainer.appendChild(alertDiv);
    } else {
      const alertDiv = document.createElement("div");
      alertDiv.className = "alert alert-success";
      alertDiv.innerHTML = `✔ All ${data.total_rows} recipient records passed validation with zero errors!`;
      csvAlertsContainer.appendChild(alertDiv);
    }

    // Populate Table
    data.valid_rows.forEach((row) => {
      const tr = document.createElement("tr");
      if (row.has_error) tr.classList.add("has-error");

      tr.innerHTML = `
        <td>${row.row_num}</td>
        <td><strong>${escapeHtml(row.name || "-")}</strong></td>
        <td><code>${escapeHtml(row.reg_no || "-")}</code></td>
        <td>${row.has_error ? '<span class="badge-error">Flagged</span>' : '<span class="badge-success">Valid</span>'}</td>
      `;
      recipientsTbody.appendChild(tr);
    });
  }

  function checkStep1Completion() {
    if (state.templateId && state.csvData && state.csvData.valid_rows.length > 0) {
      btnToStep2.disabled = false;
    } else {
      btnToStep2.disabled = true;
    }
  }

  btnToStep2.addEventListener("click", () => switchStep(2));
  btnBackToStep1.addEventListener("click", () => switchStep(1));
  btnBackToStep2.addEventListener("click", () => switchStep(2));

  // ----------------------------------------------------
  // STEP 2: PLACEMENT & TYPOGRAPHY LOGIC
  // ----------------------------------------------------
  async function fetchAvailableFonts() {
    try {
      const res = await fetch("/api/fonts");
      const data = await res.json();
      state.fonts = data.fonts || [];

      fontFamilySelect.innerHTML = state.fonts
        .map((f) => {
          let label = f.replace(".ttf", "").replace("-Regular", "");
          if (f === "GreatVibes-Regular.ttf") label = "Great Vibes (Calligraphic Script)";
          return `<option value="${f}" style="font-family: '${f.replace('.ttf', '')}', cursive, sans-serif;">${label}</option>`;
        })
        .join("");
    } catch (e) {
      console.error("Failed to load fonts:", e);
    }
  }

  function initEditorStep() {
    if (!state.templateUrl) return;

    templatePreviewImg.src = state.templateUrl;

    if (!state.editor) {
      state.editor = new PlacementEditor("editor-canvas-container", "template-preview-img", {
        onConfigChange: (fieldKey, config) => {
          if (fieldKey === state.editor.activeField) {
            syncControlsWithConfig(config);
          }
        }
      });
    } else {
      state.editor.refreshBoxPositions();
    }

    // Update sample preview text inside placement boxes from first CSV row
    if (state.csvData && state.csvData.valid_rows.length > 0) {
      const first = state.csvData.valid_rows[0];
      state.editor.updateSampleText(first.name, first.reg_no);
    }
  }

  // Sidebar Controls Event Listeners
  tabBtnName.addEventListener("click", () => selectEditorTab("name"));
  tabBtnRegNo.addEventListener("click", () => selectEditorTab("reg_no"));

  function selectEditorTab(fieldKey) {
    if (!state.editor) return;
    state.editor.selectField(fieldKey);

    tabBtnName.classList.toggle("active", fieldKey === "name");
    tabBtnRegNo.classList.toggle("active", fieldKey === "reg_no");

    const config = state.editor.getFieldConfigs()[fieldKey];
    syncControlsWithConfig(config);
  }

  function syncControlsWithConfig(cfg) {
    if (!cfg) return;
    if (fontFamilySelect.querySelector(`option[value="${cfg.font_family}"]`)) {
      fontFamilySelect.value = cfg.font_family;
    }
    fontSizeSlider.value = cfg.font_size_pt;
    fontSizeInput.value = cfg.font_size_pt;
    fontColorPicker.value = cfg.font_color;
    fontColorHex.value = cfg.font_color;

    alignLeft.classList.toggle("active", cfg.alignment === "left");
    alignCenter.classList.toggle("active", cfg.alignment === "center");
    alignRight.classList.toggle("active", cfg.alignment === "right");

    toggleBold.classList.toggle("active", !!cfg.is_bold);
    toggleItalic.classList.toggle("active", !!cfg.is_italic);
  }

  // Handle Control Inputs Change
  fontFamilySelect.addEventListener("change", (e) => {
    updateActiveFieldStyle({ font_family: e.target.value });
  });

  fontSizeSlider.addEventListener("input", (e) => {
    fontSizeInput.value = e.target.value;
    updateActiveFieldStyle({ font_size_pt: parseInt(e.target.value) });
  });

  fontSizeInput.addEventListener("input", (e) => {
    fontSizeSlider.value = e.target.value;
    updateActiveFieldStyle({ font_size_pt: parseInt(e.target.value) || 24 });
  });

  fontColorPicker.addEventListener("input", (e) => {
    fontColorHex.value = e.target.value;
    updateActiveFieldStyle({ font_color: e.target.value });
  });

  fontColorHex.addEventListener("change", (e) => {
    fontColorPicker.value = e.target.value;
    updateActiveFieldStyle({ font_color: e.target.value });
  });

  alignLeft.addEventListener("click", () => {
    updateActiveFieldStyle({ alignment: "left" });
    syncAlignmentButtons("left");
  });
  alignCenter.addEventListener("click", () => {
    updateActiveFieldStyle({ alignment: "center" });
    syncAlignmentButtons("center");
  });
  alignRight.addEventListener("click", () => {
    updateActiveFieldStyle({ alignment: "right" });
    syncAlignmentButtons("right");
  });

  function syncAlignmentButtons(align) {
    alignLeft.classList.toggle("active", align === "left");
    alignCenter.classList.toggle("active", align === "center");
    alignRight.classList.toggle("active", align === "right");
  }

  toggleBold.addEventListener("click", () => {
    const isBold = !toggleBold.classList.contains("active");
    toggleBold.classList.toggle("active", isBold);
    updateActiveFieldStyle({ is_bold: isBold });
  });

  toggleItalic.addEventListener("click", () => {
    const isItalic = !toggleItalic.classList.contains("active");
    toggleItalic.classList.toggle("active", isItalic);
    updateActiveFieldStyle({ is_italic: isItalic });
  });

  function updateActiveFieldStyle(updates) {
    if (state.editor) {
      state.editor.updateFieldStyle(state.editor.activeField, updates);
    }
  }

  btnRenderPreview.addEventListener("click", () => switchStep(3));
  btnToStep3.addEventListener("click", () => switchStep(3));

  // ----------------------------------------------------
  // STEP 3: PREVIEW & BATCH GENERATION LOGIC
  // ----------------------------------------------------
  function initPreviewStep() {
    if (!state.csvData || !state.csvData.valid_rows.length) return;

    // Populate recipient selector dropdown
    sampleRecipientSelect.innerHTML = state.csvData.valid_rows
      .map((r, idx) => `<option value="${idx}">${idx + 1}. ${escapeHtml(r.name)} (${escapeHtml(r.reg_no)})</option>`)
      .join("");

    batchSummaryText.innerText = `Ready to generate ${state.csvData.valid_rows.length} certificates using Pillow engine.`;

    // Render initial sample preview (first recipient)
    requestSamplePreview(0);
  }

  sampleRecipientSelect.addEventListener("change", (e) => {
    requestSamplePreview(parseInt(e.target.value) || 0);
  });

  async function requestSamplePreview(recipientIndex) {
    if (!state.templateId || !state.editor || !state.csvData) return;

    const recipient = state.csvData.valid_rows[recipientIndex] || state.csvData.valid_rows[0];
    const fieldConfigs = state.editor.getFieldConfigs();

    try {
      const res = await fetch("/api/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: state.templateId,
          field_configs: fieldConfigs,
          sample_data: recipient
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Preview generation failed: ${formatApiError(err)}`);
        return;
      }

      const data = await res.json();
      renderedPreviewImg.src = data.preview_url;
    } catch (e) {
      console.error("Preview render error:", e);
    }
  }

  // ----------------------------------------------------
  // BATCH GENERATION & POLLING
  // ----------------------------------------------------
  btnStartBatch.addEventListener("click", async () => {
    if (!state.templateId || !state.editor || !state.csvData) return;

    const fieldConfigs = state.editor.getFieldConfigs();
    const recipients = state.csvData.valid_rows;

    btnStartBatch.disabled = true;
    batchProgressCard.style.display = "block";
    downloadSuccessBanner.style.display = "none";
    downloadZipLink.style.display = "none";

    try {
      const res = await fetch("/api/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: state.templateId,
          field_configs: fieldConfigs,
          recipients: recipients
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Batch error: ${formatApiError(err)}`);
        btnStartBatch.disabled = false;
        return;
      }

      const data = await res.json();
      const jobId = data.job_id;

      // Start progress polling every 1 second
      startBatchPolling(jobId, data.total);
    } catch (e) {
      alert(`Failed to start batch generation: ${e.message}`);
      btnStartBatch.disabled = false;
    }
  });

  function startBatchPolling(jobId, totalCount) {
    if (state.pollInterval) clearInterval(state.pollInterval);

    state.pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/job-status/${jobId}`);
        if (!res.ok) return;

        const job = await res.json();
        const processed = job.processed || 0;
        const total = job.total || totalCount;
        const pct = Math.min(100, Math.round((processed / total) * 100));

        batchProgressCount.innerText = `${processed} / ${total}`;
        batchProgressFill.style.width = `${pct}%`;

        if (job.status === "processing") {
          batchStatusText.innerText = `Compositing certificate images... (${pct}%)`;
        } else if (job.status === "completed") {
          clearInterval(state.pollInterval);
          batchStatusText.innerText = "Completed!";
          batchProgressFill.style.width = "100%";

          downloadSuccessBanner.style.display = "flex";
          downloadZipLink.href = job.download_url;
          downloadZipLink.style.display = "inline-flex";

          btnStartBatch.disabled = false;
          btnStartBatch.innerText = "🔄 Re-generate Batch";
        } else if (job.status === "failed") {
          clearInterval(state.pollInterval);
          alert(`Batch process failed: ${job.error || "Unknown error"}`);
          btnStartBatch.disabled = false;
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 1000);
  }

  function formatApiError(err) {
    if (!err) return "Unknown error occurred";
    if (typeof err.detail === "string") return err.detail;
    if (Array.isArray(err.detail)) {
      return err.detail.map(e => e.msg || JSON.stringify(e)).join(", ");
    }
    if (typeof err.detail === "object" && err.detail !== null) return JSON.stringify(err.detail);
    return err.message || JSON.stringify(err);
  }

  function escapeHtml(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
});
