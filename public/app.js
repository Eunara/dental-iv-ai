// State
    let selectedFile = null;
    let currentAuditData = null;
    let currentFilter = 'all';
    let currentSearch = '';

    // Sample Delta Dental Data for Demo Testing
    const SAMPLE_BREAKDOWN_DATA = {
      insurance_details: {
        patient_name: "Katherine Birdwell",
        carrier: "Delta Dental PPO",
        effective_date: "01/01/2026",
        network_status: "In Network",
        plan_benefits: "Calendar Year",
        fee_schedule: "Delta Dental PPO",
        payment_recipient: "Patient or Office",
        annual_maximum: 2000,
        remaining_maximum: 2000,
        preventive_applies_to_max: false,
        deductible_individual: 50,
        deductible_remaining: 50,
        deductible_applies_to: "Basic & Major Services Only (Waived on Preventive)",
        missing_tooth_clause: true,
        waiting_period: false
      },
      coverage_levels: {
        preventive: "100%",
        basic: "80%",
        major: "60%",
        endo: "80%",
        oral_surgery: "80%",
        implants: "NC",
        night_guard: "NC",
        waiting_period_details: "Basic 6mo Major 12",
        ortho: "50%",
        ortho_max: "$2,000",
        ortho_age_limit: "NL"
      },
      procedure_codes: [
        // 1. D4346
        { code: "D4346", description: "Scaling in presence of generalized moderate or severe gingival inflammation", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Shared freq with D1110" },
        // 2. D1110
        { code: "D1110", description: "Prophy (Adult Cleaning)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Adult Prophylaxis" },
        // 3. D0274
        { code: "D0274", description: "BTW (Bitewings - Four Radiographic Images)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Bitewings 4 films" },
        // 4. D0210 / D0330
        { code: "D0210 / D0330", description: "FMX (Complete Series) / Pano (Panoramic Image)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "1x5yr", age_limit: "None", is_eligible: false, history_dates: "01/22/2025", downgrade_rule: "None", notes: "Shared freq FMX / Pano • History on file 01/22/2025" },
        // 5. D0220
        { code: "D0220", description: "PA's (Intraoral - Periapical First Radiographic Image)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "NF", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "No frequency limitation (NF)" },
        // 6. D9110
        { code: "D9110", description: "Palliative (Emergency Treatment of Dental Pain)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Emergency palliative" },
        // 7. D0120
        { code: "D0120", description: "Exam (Periodic Oral Evaluation)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Periodic evaluation" },
        // 8. D0140
        { code: "D0140", description: "Limited Exam (Problem Focused)", coverage_percentage: "100%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "None", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Combined/Additional: Additional" },
        // 9. D1351
        { code: "D1351", description: "Sealant (Per Tooth)", coverage_percentage: "80%", deductible_applied: false, frequency_limitation: "1X24m", age_limit: "15", is_eligible: true, history_dates: "History", downgrade_rule: "None", notes: "Sealant age limit: 15" },
        // 10. D1206
        { code: "D1206", description: "Flouride (Fluoride Varnish / Application)", coverage_percentage: "90%", deductible_applied: false, frequency_limitation: "2x1yr", age_limit: "18", is_eligible: false, history_dates: "History", downgrade_rule: "None", notes: "Fluoride age limit: 18 (Exceeded)" },
        // 11. D4341
        { code: "D4341", description: "SRP (Periodontal Scaling and Root Planing - 4+ teeth/quad)", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "1x1yr", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Quads Per Visit: All • Perio History: None" },
        // 12. D4910
        { code: "D4910", description: "Perio Maint (Periodontal Maintenance)", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "NF", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Freq w/ Prophy: Addition • PMV Perio History: None" },
        // 13. D2391
        { code: "D2391", description: "Filling (Resin-based Composite - 1 Surface, Posterior)", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "1x1yr", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "No", notes: "Basic TX • Downgrade: No" },
        // 14. D2740
        { code: "D2740", description: "Crown (Porcelain/Ceramic Substrate)", coverage_percentage: "60%", deductible_applied: true, frequency_limitation: "60 months", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "No", notes: "Major TX • Downgrade: No • Prep or Seat: Seat • Freq: 60 months" },
        // 15. D2920
        { code: "D2920", description: "Crown Recement", coverage_percentage: "60%", deductible_applied: true, frequency_limitation: "NF", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Major TX • Frequency: NF" },
        // 16. D7140
        { code: "D7140", description: "Simple ext (Simple Extraction)", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "1 per tooth lifetime", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Oral Surgery" },
        // 17. D7210
        { code: "D7210", description: "Surgical ext (Surgical Extraction)", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "1 per tooth lifetime", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Oral Surgery" },
        // 18. D9222 / D9223
        { code: "D9222 / D9223", description: "Sedation / General Anesthesia", coverage_percentage: "80%", deductible_applied: true, frequency_limitation: "With surgery", age_limit: "None", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Billed to Med First?: No" },
        // 19. D9944
        { code: "D9944", description: "Night Guard (Occlusal Guard)", coverage_percentage: "NC", deductible_applied: false, frequency_limitation: "Not Covered", age_limit: "None", is_eligible: false, history_dates: "None", downgrade_rule: "None", notes: "Not Covered (NC)" },
        // 20. D6010
        { code: "D6010", description: "Implants (Surgical Placement of Endosteal Implant)", coverage_percentage: "NC", deductible_applied: false, frequency_limitation: "Not Covered", age_limit: "None", is_eligible: false, history_dates: "None", downgrade_rule: "None", notes: "Not Covered (NC)" },
        // 21. Ortho
        { code: "Ortho", description: "Ortho (Orthodontics)", coverage_percentage: "50%", deductible_applied: false, frequency_limitation: "Lifetime", age_limit: "NL", is_eligible: true, history_dates: "None", downgrade_rule: "None", notes: "Lifetime Max: $2,000 • Age Limit: NL (No Limit)" }
      ]
    };

    // HTML escape utility
    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Exact 21 Procedure Clinical Sequence Mapping (Strict order from plan.txt & Excel breakdown form)
    const CLINICAL_PROCEDURE_ORDER = [
      'D4346',
      'D1110',
      'D0274',
      'D0210', 'D0330', 'D0210 / D0330',
      'D0220',
      'D9110',
      'D0120',
      'D0140',
      'D1351',
      'D1206',
      'D4341',
      'D4910',
      'D2391',
      'D2740',
      'D2920',
      'D7140',
      'D7210',
      'D9222', 'D9223', 'D9222 / D9223',
      'D9944',
      'D6010',
      'ORTHO', 'D8080', 'D8090', 'D8670'
    ];

    function getProcedureOrderRank(code) {
      if (!code) return 999;
      const c = String(code).trim().toUpperCase();
      for (let i = 0; i < CLINICAL_PROCEDURE_ORDER.length; i++) {
        const target = CLINICAL_PROCEDURE_ORDER[i];
        if (c === target || c.includes(target) || target.includes(c)) {
          return i;
        }
      }
      return 900;
    }

    // Strict categorization into the 5 clinical breakdown categories:
    // 1. Preventative, 2. Periodontal, 3. Restorative (D2391), 4. Major, 5. Ortho
    function categorizeProcedureCode(item) {
      if (!item) return 'major';
      const code = String(item.code || '').toUpperCase().trim();
      const desc = String(item.description || '').toLowerCase();

      // 1. Preventative
      if (
        code.includes('D4346') ||
        code.includes('D1110') ||
        code.includes('D0274') ||
        code.includes('D0210') ||
        code.includes('D0330') ||
        code.includes('D0220') ||
        code.includes('D9110') ||
        code.includes('D0120') ||
        code.includes('D0140') ||
        code.includes('D1351') ||
        code.includes('D1206') ||
        code.includes('D1120') ||
        code.includes('D0150') ||
        code.includes('D0180') ||
        code.includes('D0272') ||
        code.includes('D0230') ||
        code.includes('D1208') ||
        desc.includes('prophy') ||
        desc.includes('exam') ||
        desc.includes('bitewing') ||
        desc.includes('fluoride') ||
        desc.includes('flouride') ||
        desc.includes('sealant') ||
        desc.includes('palliative')
      ) {
        return 'preventative';
      }

      // 2. Periodontal
      if (
        code.includes('D4341') ||
        code.includes('D4910') ||
        code.includes('D4342') ||
        code.includes('D4381') ||
        desc.includes('srp') ||
        desc.includes('scaling and root') ||
        desc.includes('perio maint') ||
        desc.includes('periodontal')
      ) {
        return 'periodontal';
      }

      // 3. Restorative (user: 2391 - mao rani nga code ang sa restorative)
      if (
        code.includes('D2391') ||
        code.includes('2391') ||
        (code.startsWith('D2') && !code.includes('D2740') && !code.includes('D2920') && (desc.includes('filling') || desc.includes('composite') || desc.includes('amalgam') || desc.includes('resin')))
      ) {
        return 'restorative';
      }

      // 5. Ortho
      if (
        code.includes('ORTHO') ||
        code.includes('D8080') ||
        code.includes('D8090') ||
        code.includes('D8670') ||
        desc.includes('ortho')
      ) {
        return 'ortho';
      }

      // 4. Major (D2740, D2920, D7140, D7210, D9222/D9223, D9944, D6010, etc.)
      return 'major';
    }

    // File State
    let selectedFiles = [];

    // History Storage Key
    const HISTORY_STORAGE_KEY = 'dentverify_audit_history';

    // Elements
    const dropzoneField = document.getElementById('dropzoneField');
    const fileInput = document.getElementById('fileInput');
    const filesListContainer = document.getElementById('filesListContainer');
    const filesItemsGrid = document.getElementById('filesItemsGrid');
    const filesCountText = document.getElementById('filesCountText');
    const addMoreFilesBtn = document.getElementById('addMoreFilesBtn');
    const patientNameInput = document.getElementById('patientNameInput');
    const patientHeroBadge = document.getElementById('patientHeroBadge');
    const patientHeroName = document.getElementById('patientHeroName');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const auditorLoading = document.getElementById('auditorLoading');
    const loadingTicker = document.getElementById('loadingTicker');
    const uiAlertError = document.getElementById('uiAlertError');
    const errorTitleText = document.getElementById('errorTitleText');
    const errorDetailsText = document.getElementById('errorDetailsText');
    const retryVerifyBtn = document.getElementById('retryVerifyBtn');
    const dismissAlertBtn = document.getElementById('dismissAlertBtn');
    const reportDashboard = document.getElementById('reportDashboard');
    const newVerificationBtn = document.getElementById('newVerificationBtn');
    const loadSampleBtn = document.getElementById('loadSampleBtn');

    // History Modal elements
    const historyModal = document.getElementById('historyModal');
    const openHistoryBtn = document.getElementById('openHistoryBtn');
    const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
    const btnCloseHistoryFooterBtn = document.getElementById('btnCloseHistoryFooterBtn');
    const btnClearHistoryBtn = document.getElementById('btnClearHistoryBtn');
    const historyListContainer = document.getElementById('historyListContainer');
    const headerHistoryCount = document.getElementById('headerHistoryCount');
    const historyModalCount = document.getElementById('historyModalCount');

    // Table elements
    const cdtSearchInput = document.getElementById('cdtSearchInput');
    const filterChips = document.querySelectorAll('.filter-chip');
    const cdtTableBody = document.getElementById('cdtTableBody');
    const codesCountPill = document.getElementById('codesCountPill');

    // PMS Modal elements
    const pmsModal = document.getElementById('pmsModal');
    const openPmsModalBtn = document.getElementById('openPmsModalBtn');
    const closePmsModalBtn = document.getElementById('closePmsModalBtn');
    const pmsNoteContent = document.getElementById('pmsNoteContent');
    const copyPmsNoteBtn = document.getElementById('copyPmsNoteBtn');
    const toastPill = document.getElementById('toastPill');
    const toastPillMessage = document.getElementById('toastPillMessage');

    // Drag and drop handlers
    ['dragenter', 'dragover'].forEach(name => {
      dropzoneField.addEventListener(name, (e) => {
        e.preventDefault();
        dropzoneField.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzoneField.addEventListener(name, (e) => {
        e.preventDefault();
        dropzoneField.classList.remove('dragover');
      });
    });

    dropzoneField.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleIncomingFiles(Array.from(e.dataTransfer.files));
      }
    });

    dropzoneField.addEventListener('click', () => {
      fileInput.click();
    });

    addMoreFilesBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleIncomingFiles(Array.from(e.target.files));
      }
      fileInput.value = ''; // Reset so the same file can be re-selected if removed
    });

    function formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function handleIncomingFiles(newFiles) {
      hideAlert();
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

      for (const f of newFiles) {
        if (!validTypes.includes(f.type) && !/\.(pdf|png|jpe?g|webp)$/i.test(f.name)) {
          showAlert(`"${f.name}" is not a supported format. Please use PDF, PNG, JPG, or WEBP.`);
          continue;
        }

        // Check if already added
        const exists = selectedFiles.some(existing => existing.name === f.name && existing.size === f.size);
        if (!exists) {
          if (selectedFiles.length >= 10) {
            showAlert('Maximum 10 files allowed at once.');
            break;
          }
          selectedFiles.push(f);
        }
      }

      renderFilesList();
    }

    function renderFilesList() {
      if (selectedFiles.length === 0) {
        filesListContainer.classList.remove('active');
        dropzoneField.style.display = 'block';
        return;
      }

      filesListContainer.classList.add('active');
      dropzoneField.style.display = 'none';

      const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
      filesCountText.textContent = `${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''} Attached (${formatFileSize(totalSize)})`;

      filesItemsGrid.innerHTML = '';
      selectedFiles.forEach((file, index) => {
        const ext = file.name.split('.').pop().toUpperCase().slice(0, 4) || 'DOC';
        
        const row = document.createElement('div');
        row.className = 'file-item-row';
        row.innerHTML = `
          <div class="file-item-left">
            <div class="file-item-badge">${escapeHtml(ext)}</div>
            <div class="file-item-info">
              <div class="file-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
              <div class="file-item-meta">${formatFileSize(file.size)} • Page/File #${index + 1}</div>
            </div>
          </div>
          <button type="button" class="btn-icon-danger remove-single-file-btn" data-index="${index}" title="Remove this file">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;

        const removeBtn = row.querySelector('.remove-single-file-btn');
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedFiles.splice(index, 1);
          renderFilesList();
        });

        filesItemsGrid.appendChild(row);
      });
    }

    // Loading ticker animation
    let loadingTickerTimer = null;
    const tickerSteps = [
      'Extracting document text & tabular grids...',
      'Auditing network benefit tier (In vs Out of Network)...',
      'Calculating annual maximums & individual deductibles...',
      'Exhaustively mapping CDT procedure codes (D0100 - D9999)...',
      'Evaluating frequency limitations & history dates...',
      'Validating amalgam downgrade clauses & tooth exclusions...',
      'Finalizing clinical PMS note formatting...'
    ];

    function startAuditorLoading() {
      auditorLoading.classList.add('active');
      analyzeBtn.disabled = true;
      hideAlert();
      let stepIndex = 0;
      loadingTicker.textContent = tickerSteps[0];
      loadingTickerTimer = setInterval(() => {
        stepIndex = (stepIndex + 1) % tickerSteps.length;
        loadingTicker.textContent = tickerSteps[stepIndex];
      }, 2200);
    }

    function stopAuditorLoading() {
      auditorLoading.classList.remove('active');
      analyzeBtn.disabled = false;
      if (loadingTickerTimer) clearInterval(loadingTickerTimer);
    }

    function showAlert(msg, title = 'Verification Notice') {
      if (typeof msg === 'object' && msg !== null) {
        title = msg.title || title;
        msg = msg.message || JSON.stringify(msg);
      }
      if (errorTitleText) errorTitleText.textContent = title;
      if (errorDetailsText) errorDetailsText.textContent = msg;
      uiAlertError.classList.add('active');
    }

    function hideAlert() {
      uiAlertError.classList.remove('active');
    }

    if (retryVerifyBtn) {
      retryVerifyBtn.addEventListener('click', () => {
        hideAlert();
        analyzeBtn.click();
      });
    }

    if (dismissAlertBtn) {
      dismissAlertBtn.addEventListener('click', () => {
        hideAlert();
      });
    }

    function displayToast(msg) {
      toastPillMessage.textContent = msg;
      toastPill.classList.add('show');
      setTimeout(() => {
        toastPill.classList.remove('show');
      }, 3000);
    }

    // Demo Sample Trigger
    loadSampleBtn.addEventListener('click', () => {
      hideAlert();
      currentAuditData = JSON.parse(JSON.stringify(SAMPLE_BREAKDOWN_DATA));
      const enteredName = patientNameInput ? patientNameInput.value.trim() : '';
      if (enteredName) {
        currentAuditData.insurance_details.patient_name = enteredName;
      }
      renderReportDashboard(currentAuditData);
      saveAuditToHistory(currentAuditData);
      displayToast('Loaded sample Delta Dental breakdown.');
    });

    // Reset Verification and Form State without reloading page
    function resetVerificationState() {
      selectedFiles = [];
      currentAuditData = null;
      if (fileInput) fileInput.value = '';
      if (patientNameInput) patientNameInput.value = '';
      if (filesListContainer) filesListContainer.classList.remove('active');
      if (dropzoneField) dropzoneField.style.display = 'block';

      // Hide Report Dashboard (IV Information)
      if (reportDashboard) {
        reportDashboard.classList.remove('active');
        reportDashboard.style.display = 'none';
      }

      // Show Upload Form and Hero section
      const heroSec = document.querySelector('.hero-section');
      if (heroSec) heroSec.style.display = 'flex';
      const formPan = document.getElementById('formPanel');
      if (formPan) formPan.style.display = 'block';

      if (patientHeroBadge) patientHeroBadge.style.display = 'none';
      hideAlert();
      stopAuditorLoading();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Form submission
    analyzeBtn.addEventListener('click', async () => {
      hideAlert();

      if (selectedFiles.length === 0) {
        showAlert('Palihug pag-upload o pag-drag ug dental breakdown file (PDF o Image) sa dili pa mag-analyze.', 'Wala pay File Gi-upload');
        return;
      }

      const pref = document.querySelector('input[name="network_preference"]:checked')?.value || 'auto';
      const patientNameVal = patientNameInput ? patientNameInput.value.trim() : '';

      const formData = new FormData();
      
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('network_preference', pref);
      if (patientNameVal) {
        formData.append('patient_name', patientNameVal);
      }

      // Append customized AI role or CDT prompt from settings if configured
      const customSys = localStorage.getItem('dentverify_system_instruction') || (settingSystemInstruction ? settingSystemInstruction.value.trim() : '');
      const customPr = localStorage.getItem('dentverify_custom_prompt') || (settingCustomPrompt ? settingCustomPrompt.value.trim() : '');
      if (customSys) formData.append('system_instruction', customSys);
      if (customPr) formData.append('custom_prompt', customPr);

      startAuditorLoading();

      try {
        const response = await fetch('/api/verify', {
          method: 'POST',
          body: formData,
        });

        let resData = null;
        let isJson = false;
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          try {
            resData = await response.json();
            isJson = true;
          } catch (jsonErr) {
            console.error('Error parsing JSON from server:', jsonErr);
          }
        }

        // If HTTP status is not successful (e.g. 504 Timeout, 503 Overload, 502, 429, 500)
        if (!response.ok) {
          if (resData && resData.error) {
            let errorTitle = 'AI Verification Notice';
            if (resData.error_type === 'API_OVERLOAD') {
              errorTitle = '⚠️ Google Gemini API Overload (503 High Demand)';
            } else if (resData.error_type === 'RATE_LIMIT') {
              errorTitle = '⚠️ Gemini Free Quota / Rate Limit (429)';
            } else if (resData.error_type === 'TIMEOUT') {
              errorTitle = '⏱️ Processing Timeout';
            } else if (resData.error_type === 'AUTH_ERROR') {
              errorTitle = '⚠️ Gemini API Key Issue (403)';
            }
            showAlert(resData.error, errorTitle);
            return;
          }

          // If server or Nginx returned an HTML error page without JSON
          if (response.status === 504) {
            showAlert('Nadugay pag-proseso ang Google Gemini tungod sa kadako sa dokumento o temporaryong taas nga trapik sa Google network. Dili kinahanglan i-reload ang panid — i-click lang ang "Sulayi Pag-usab" sa ubos.', '⏱️ 504 Gateway Timeout (Gemini AI Busy)');
            return;
          } else if (response.status === 503) {
            showAlert('Temporaryong taas kaayo ang demand sa Google Gemini AI karon (Global demand spike). Palihug paghulat og 5-10 segundos unya i-click ang "Sulayi Pag-usab".', '⚠️ 503 Gemini API Overload');
            return;
          } else if (response.status === 429) {
            showAlert('Nalapas ang libreng request limit sa Gemini API key karon. Palihug pahuwayi kadiyot (1-2 minutos) sa dili pa mosulay pag-usab.', '⚠️ 429 Rate Limit Reached');
            return;
          } else if (response.status === 502) {
            showAlert('Ang server nag-restart o temporaryong busy. Palihug paghulat og 5 ka segundo unya i-click ang "Sulayi Pag-usab".', '🔌 502 Bad Gateway');
            return;
          } else if (response.status === 413) {
            showAlert('Dako ra kaayo ang gi-upload nga file (maximum 30MB). Palihug pag-upload og mas gamay nga file o bahina ang mga pahina.', '📁 413 File Too Large');
            return;
          } else {
            showAlert(`Adunay problema sa server (HTTP Status ${response.status}). Palihug i-click ang "Sulayi Pag-usab".`, `⚠️ Server Error (${response.status})`);
            return;
          }
        }

        if (!resData || !resData.success) {
          showAlert(resData?.error || 'Wala nagmalampuson ang insurance verification. Palihug sulayi pag-usab.', 'Verification Notice');
          return;
        }

        currentAuditData = resData.data;

        // If user explicitly entered a patient name on the form, keep it
        if (patientNameVal && (!currentAuditData.insurance_details.patient_name || currentAuditData.insurance_details.patient_name === 'N/A')) {
          currentAuditData.insurance_details.patient_name = patientNameVal;
        }

        renderReportDashboard(currentAuditData);
        saveAuditToHistory(currentAuditData);
      } catch (err) {
        console.error('Audit verification error:', err);
        let errorMsg = err.message || 'Adunay problema sa pagkonektar sa server.';
        let errorTitle = 'Network / Server Error';

        if (errorMsg.includes('Unexpected token') || errorMsg.includes('JSON')) {
          errorTitle = '⚠️ API Overload / Gateway Timeout (504)';
          errorMsg = 'Nakadawat ang browser og HTML imbes JSON gikan sa server. Kasagaran kini mahitabo kung nag-timeout o busy ang Google Gemini API sa pag-proseso sa file. Dili kinahanglan i-reload ang panid — i-click lang ang "Sulayi Pag-usab" button sa ubos!';
        }

        showAlert(errorMsg, errorTitle);
      } finally {
        stopAuditorLoading();
      }
    });

    // Money formatter
    function fmtMoney(amount) {
      if (amount === null || amount === undefined) return 'Unlimited';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
    }

    // Render verification report
    function renderReportDashboard(data) {
      const details = data.insurance_details || {};
      const levels = data.coverage_levels || {};

      // Patient Name Display
      if (details.patient_name && details.patient_name.trim() !== '' && details.patient_name.toLowerCase() !== 'n/a') {
        patientHeroName.textContent = details.patient_name.trim();
        patientHeroBadge.style.display = 'inline-flex';
      } else {
        patientHeroBadge.style.display = 'none';
      }

      // Carrier & Network
      document.getElementById('carrierNameDisplay').textContent = details.carrier || 'Delta Dental PPO';
      document.getElementById('planEffectiveDateDisplay').textContent = 'Effective: ' + (details.effective_date || '01/01/2026');
      
      const netBadge = document.getElementById('networkStatusBadge');
      const netStatus = details.network_status || 'In Network';
      netBadge.textContent = netStatus;
      if (netStatus.toLowerCase().includes('out')) {
        netBadge.className = 'network-indicator-pill out-network';
      } else {
        netBadge.className = 'network-indicator-pill in-network';
      }

      const planBenefitsDisplay = document.getElementById('planBenefitsDisplay');
      if (planBenefitsDisplay) {
        planBenefitsDisplay.textContent = 'Plan: ' + (details.plan_benefits || 'Calendar Year');
      }

      const feeScheduleDisplay = document.getElementById('feeScheduleDisplay');
      if (feeScheduleDisplay) {
        feeScheduleDisplay.textContent = 'Fee: ' + (details.fee_schedule || (details.carrier ? details.carrier + ' PPO' : 'Delta Dental PPO'));
      }

      const paymentToDisplay = document.getElementById('paymentToDisplay');
      if (paymentToDisplay) {
        paymentToDisplay.textContent = 'Pay To: ' + (details.payment_recipient || 'Patient or Office');
      }

      // Annual Max Card
      document.getElementById('hudAnnualMax').textContent = fmtMoney(details.annual_maximum);
      document.getElementById('hudRemainingMax').textContent = 'Remaining: ' + fmtMoney(details.remaining_maximum);
      
      let maxPct = 0;
      if (details.annual_maximum && details.remaining_maximum !== null && details.remaining_maximum !== undefined) {
        const used = Math.max(0, details.annual_maximum - details.remaining_maximum);
        maxPct = Math.min(100, Math.round((used / details.annual_maximum) * 100));
        document.getElementById('hudMaxPctUsed').textContent = `${maxPct}% used (${fmtMoney(used)})`;
        document.getElementById('meterMaxBar').style.width = `${Math.max(5, 100 - maxPct)}%`;
      } else {
        document.getElementById('hudMaxPctUsed').textContent = 'No usage recorded';
        document.getElementById('meterMaxBar').style.width = '100%';
      }

      // Individual Deductible Card
      document.getElementById('hudDeductible').textContent = fmtMoney(details.deductible_individual);
      if (details.deductible_remaining !== null && details.deductible_remaining !== undefined) {
        document.getElementById('hudRemainingDed').textContent = 'Remaining: ' + fmtMoney(details.deductible_remaining);
        if (details.deductible_remaining === 0) {
          document.getElementById('hudDedMetStatus').textContent = '100% Met';
          document.getElementById('meterDedBar').style.width = '100%';
        } else {
          document.getElementById('hudDedMetStatus').textContent = 'Active Balance';
          document.getElementById('meterDedBar').style.width = '35%';
        }
      } else {
        document.getElementById('hudRemainingDed').textContent = 'Remaining: $0 (Met or None)';
        document.getElementById('hudDedMetStatus').textContent = 'Met / N/A';
        document.getElementById('meterDedBar').style.width = '100%';
      }

      // Deductible Scope Card
      document.getElementById('hudDedApplies').textContent = details.deductible_applies_to || 'Basic & Major Services';
      const prevCounts = Boolean(details.preventive_applies_to_max);
      document.getElementById('chipPrevMaxDot').className = prevCounts ? 'rule-status-circle warn' : 'rule-status-circle good';
      document.getElementById('chipPrevMaxText').textContent = prevCounts ? 'Prev counts toward annual max' : 'Preventive does NOT apply to max';

      // Rules Row
      const rulesRow = document.getElementById('rulesRow');
      rulesRow.innerHTML = '';

      // Missing tooth clause
      const mtChip = document.createElement('div');
      mtChip.className = 'rule-chip';
      const hasMT = Boolean(details.missing_tooth_clause);
      mtChip.innerHTML = `
        <span class="rule-status-circle ${hasMT ? 'warn' : 'good'}"></span>
        <span><strong>Missing Tooth Clause:</strong> ${hasMT ? 'Applies (Yes)' : 'No (Waived)'}</span>
      `;
      rulesRow.appendChild(mtChip);

      // Waiting periods
      const wpChip = document.createElement('div');
      wpChip.className = 'rule-chip';
      const hasWP = Boolean(details.waiting_period);
      wpChip.innerHTML = `
        <span class="rule-status-circle ${hasWP ? 'warn' : 'good'}"></span>
        <span><strong>Waiting Period:</strong> ${hasWP ? 'Yes (' + (levels.waiting_period_details || 'Present') + ')' : 'No (Waived: ' + (levels.waiting_period_details || 'Basic 6mo Major 12') + ')'}</span>
      `;
      rulesRow.appendChild(wpChip);

      // Ortho limits
      if (levels.ortho_max || levels.ortho_age_limit || levels.ortho) {
        const orthoChip = document.createElement('div');
        orthoChip.className = 'rule-chip';
        orthoChip.innerHTML = `
          <span class="rule-status-circle neutral"></span>
          <span><strong>Ortho Terms:</strong> Coverage ${levels.ortho || '50%'} • Max ${levels.ortho_max || '$2,000'} • Age Limit: ${levels.ortho_age_limit || 'NL'}</span>
        `;
        rulesRow.appendChild(orthoChip);
      }

      // Category Matrix Cards (Clinical Excel Categories)
      const categoryCardsGrid = document.getElementById('categoryCardsGrid');
      categoryCardsGrid.innerHTML = '';

      const hasMTC = Boolean(details.missing_tooth_clause);
      const implantsVal = levels.implants || 'NC';
      const isImplantCovered = implantsVal && !implantsVal.toLowerCase().includes('nc') && !implantsVal.includes('0%');
      const nightGuardVal = levels.night_guard || 'NC';
      const isNightGuardCovered = nightGuardVal && !nightGuardVal.toLowerCase().includes('nc') && !nightGuardVal.includes('0%');

      const catMatrix = [
        {
          code: 'PREVENTATIVE',
          name: 'Preventive / Diag',
          val: levels.preventive || '100%',
          sub: 'Ded Applied: No',
          color: 'emerald'
        },
        {
          code: 'BASIC',
          name: 'Basic Restorative',
          val: levels.basic || '80%',
          sub: 'Ded Applied: Yes',
          color: 'cyan'
        },
        {
          code: 'MAJOR',
          name: 'Major Restorative',
          val: levels.major || '60%',
          sub: 'Ded Applied: Yes',
          color: 'indigo'
        },
        {
          code: 'ENDO',
          name: 'Endodontics',
          val: levels.endo || levels.basic || '80%',
          sub: 'Root Canals',
          color: 'cyan'
        },
        {
          code: 'ORAL SURGERY',
          name: 'Oral Surgery',
          val: levels.oral_surgery || levels.basic || '80%',
          sub: 'Extractions',
          color: 'cyan'
        },
        {
          code: 'IMPLANTS D6010',
          name: 'Implant Placement',
          val: implantsVal,
          sub: isImplantCovered ? 'Covered Benefit' : 'Not Covered (NC)',
          color: isImplantCovered ? 'cyan' : 'rose'
        },
        {
          code: 'NIGHT GUARD',
          name: 'D9944 Guard',
          val: nightGuardVal,
          sub: isNightGuardCovered ? 'Covered Benefit' : 'Not Covered (NC)',
          color: isNightGuardCovered ? 'cyan' : 'rose'
        },
        {
          code: 'MISSING TOOTH',
          name: 'Pre-existing Excl.',
          val: hasMTC ? 'Yes' : 'No',
          sub: hasMTC ? 'Clause Active' : 'Waived',
          color: hasMTC ? 'amber' : 'emerald'
        },
        {
          code: 'WAITING PERIOD',
          name: 'Waiting Period',
          val: hasWP ? 'Yes' : 'No',
          sub: hasWP ? (levels.waiting_period_details || 'Basic/Major') : 'No (Waived)',
          color: hasWP ? 'amber' : 'emerald'
        },
      ];

      if (levels.ortho || levels.ortho_max) {
        catMatrix.push({
          code: 'ORTHO',
          name: 'Orthodontics',
          val: levels.ortho || '50%',
          sub: `Max: ${levels.ortho_max || '$2,000'} • Age: ${levels.ortho_age_limit || 'NL'}`,
          color: 'neutral'
        });
      }

      catMatrix.forEach(item => {
        const cBox = document.createElement('div');
        cBox.className = `category-box cat-card-${item.color}`;
        cBox.innerHTML = `
          <div class="category-code-tag">${item.code}</div>
          <div class="category-name-text">${item.name}</div>
          <div class="category-percentage-num">${item.val}</div>
          <div class="category-sub-note">${item.sub}</div>
        `;
        categoryCardsGrid.appendChild(cBox);
      });

      // Initialize Treatment Copay Estimator (Option 2)
      setupCopayEstimator(data);

      // Render Clean Bordered Excel Breakdown Sheet (Option 4)
      renderExcelBreakdownSheet(data);

      // Populate CDT Codes Table
      renderCdtTable();

      // Hide Upload Section so ONLY IV Information is visible
      const heroSec = document.querySelector('.hero-section');
      if (heroSec) heroSec.style.display = 'none';
      const formPan = document.getElementById('formPanel');
      if (formPan) formPan.style.display = 'none';

      // Show Report Dashboard
      reportDashboard.classList.add('active');
      reportDashboard.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Render CDT Table
    function renderCdtTable() {
      const allCodes = currentAuditData?.procedure_codes || [];
      cdtTableBody.innerHTML = '';

      const query = currentSearch.trim().toLowerCase();

      const filtered = allCodes.filter(item => {
        const textMatch = 
          (item.code || '').toLowerCase().includes(query) ||
          (item.description || '').toLowerCase().includes(query) ||
          (item.notes || '').toLowerCase().includes(query) ||
          (item.downgrade_rule || '').toLowerCase().includes(query);

        if (!textMatch) return false;

        const cat = categorizeProcedureCode(item);

        if (currentFilter === 'preventative') {
          return cat === 'preventative';
        } else if (currentFilter === 'periodontal') {
          return cat === 'periodontal';
        } else if (currentFilter === 'restorative') {
          return cat === 'restorative';
        } else if (currentFilter === 'major') {
          return cat === 'major';
        } else if (currentFilter === 'ortho') {
          return cat === 'ortho';
        } else if (currentFilter === 'eligible') {
          return item.is_eligible === true;
        } else if (currentFilter === 'downgrades') {
          return item.downgrade_rule && item.downgrade_rule.toLowerCase() !== 'none' && item.downgrade_rule !== '';
        }

        return true;
      });

      // Strictly sort by Clinical 1-to-21 sequence
      filtered.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));

      codesCountPill.textContent = `${filtered.length} of ${allCodes.length} codes`;

      if (filtered.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="10" style="text-align: center; color: var(--text-muted); padding: 3rem;">No procedure codes found matching current filter/query.</td>`;
        cdtTableBody.appendChild(tr);
        return;
      }

      // Group into the 5 clinical categories requested by user:
      // 1. Preventative, 2. Periodontal, 3. Restorative (2391), 4. Major, 5. Ortho
      const categoriesDef = [
        { key: 'preventative', title: 'PREVENTATIVE', badgeStyle: 'background: #fce7f3; color: #9d174d; border: 1px solid #fbcfe8;', desc: 'D4346, Prophy, Bitewings, FMX/Pano, PA\'s, Palliative, Exams, Sealants, Fluoride' },
        { key: 'periodontal', title: 'PERIODONTAL', badgeStyle: 'background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;', desc: 'D4341 (SRP), D4910 (Perio Maintenance)' },
        { key: 'restorative', title: 'RESTORATIVE (2391)', badgeStyle: 'background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff;', desc: 'D2391 (Posterior Composite Filling)' },
        { key: 'major', title: 'MAJOR', badgeStyle: 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;', desc: 'D2740 (Crown), D2920 (Recement), D7140/D7210 (Extractions), D9222/D9223 (Sedation), D9944 (Night Guard)' },
        { key: 'ortho', title: 'ORTHO', badgeStyle: 'background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;', desc: 'Comprehensive Orthodontic Treatment' },
      ];

      categoriesDef.forEach(catDef => {
        const catCodes = filtered.filter(item => categorizeProcedureCode(item) === catDef.key);
        if (catCodes.length === 0) return;

        // Category header row
        const catRow = document.createElement('tr');
        catRow.className = 'category-header-row';
        catRow.innerHTML = `
          <td colspan="10" style="background: rgba(15, 23, 42, 0.95); padding: 0.65rem 0.85rem; border-top: 2px solid rgba(56, 189, 248, 0.25); border-bottom: 1px solid rgba(56, 189, 248, 0.2);">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="${catDef.badgeStyle} font-weight: 800; font-size: 0.78rem; padding: 2px 9px; border-radius: 4px; letter-spacing: 0.04em;">${catDef.title}</span>
                <span style="font-size: 0.78rem; color: var(--text-secondary);">${catDef.desc}</span>
              </div>
              <span style="font-size: 0.74rem; color: var(--cyan-bright); font-family: var(--font-mono); font-weight: 700;">${catCodes.length} procedure${catCodes.length > 1 ? 's' : ''}</span>
            </div>
          </td>
        `;
        cdtTableBody.appendChild(catRow);

        catCodes.forEach(p => {
          const tr = document.createElement('tr');

          // Status badge
          const statusBadge = p.is_eligible
            ? `<span class="badge-status-eligible"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>Eligible</span>`
            : `<span class="badge-status-ineligible"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Ineligible</span>`;

          // Downgrade pill
          let downgradeCell = `<span style="color: var(--text-muted); font-size: 0.8rem;">None</span>`;
          if (p.downgrade_rule && p.downgrade_rule.toLowerCase() !== 'none') {
            downgradeCell = `<span class="downgrade-flag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 2 22 22 22 12 2"></polygon><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>${escapeHtml(p.downgrade_rule)}</span>`;
          }

          // Ded Applies
          const dedCell = p.deductible_applied ? `<span class="tag-ded-yes">Applies</span>` : `<span class="tag-ded-no">Waived</span>`;

          tr.innerHTML = `
            <td><span class="cdt-badge">${escapeHtml(p.code || 'CDT')}</span></td>
            <td class="desc-text">${escapeHtml(p.description || '-')}</td>
            <td><span class="pct-badge-num" style="color: #38bdf8;">${escapeHtml(p.coverage_percentage || '0%')}</span></td>
            <td>${dedCell}</td>
            <td>${escapeHtml(p.frequency_limitation || '-')}</td>
            <td>${escapeHtml(p.age_limit || 'None')}</td>
            <td>${statusBadge}</td>
            <td class="history-text">${escapeHtml(p.history_dates || 'None')}</td>
            <td>${downgradeCell}</td>
            <td class="notes-snippet">${escapeHtml(p.notes || '-')}</td>
          `;

          cdtTableBody.appendChild(tr);
        });
      });
    }

    // Search and filter listeners
    cdtSearchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      renderCdtTable();
    });

    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        renderCdtTable();
      });
    });

    // Reset button (resets state cleanly without reload)
    newVerificationBtn.addEventListener('click', () => {
      resetVerificationState();
    });

    const bottomNewBreakdownBtn = document.getElementById('bottomNewBreakdownBtn');
    if (bottomNewBreakdownBtn) {
      bottomNewBreakdownBtn.addEventListener('click', () => {
        resetVerificationState();
      });
    }

    // Format PMS Text
    function buildPmsNote() {
      if (!currentAuditData) return '';
      const d = currentAuditData.insurance_details || {};
      const c = currentAuditData.coverage_levels || {};
      const codes = (currentAuditData.procedure_codes || []).slice();

      // Strictly sort by clinical 1-to-21 sequence
      codes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));

      const today = new Date().toLocaleDateString('en-US');

      let txt = `==========================================================\n`;
      txt += `DENTAL INSURANCE VERIFICATION AUDIT [${today}]\n`;
      txt += `==========================================================\n`;
      if (d.patient_name && d.patient_name.trim() !== '' && d.patient_name.toLowerCase() !== 'n/a') {
        txt += `PATIENT NAME:         ${d.patient_name.trim()}\n`;
      }
      txt += `CARRIER:              ${d.carrier || 'Delta Dental PPO'}\n`;
      txt += `NETWORK STATUS:       ${d.network_status || 'In Network'}\n`;
      txt += `PLAN BENEFITS:        ${d.plan_benefits || 'Calendar Year'}\n`;
      txt += `FEE SCHEDULE:         ${d.fee_schedule || 'Delta Dental PPO'}\n`;
      txt += `PAYMENT GOES TO:      ${d.payment_recipient || 'Patient or Office'}\n`;
      txt += `EFFECTIVE DATE:       ${d.effective_date || '01/01/2026'}\n`;
      txt += `ANNUAL MAXIMUM:       ${fmtMoney(d.annual_maximum)} | REMAINING: ${fmtMoney(d.remaining_maximum)}\n`;
      txt += `INDIVIDUAL DED:       ${fmtMoney(d.deductible_individual)} | REMAINING: ${fmtMoney(d.deductible_remaining)}\n`;
      txt += `DEDUCTIBLE APPLIES:   ${d.deductible_applies_to || 'Basic & Major'}\n`;
      txt += `PREVENTIVE TO MAX:    ${d.preventive_applies_to_max ? 'YES (Counts toward max)' : 'NO (Waived from max)'}\n`;
      txt += `MISSING TOOTH CLAUSE: ${d.missing_tooth_clause ? 'YES' : 'NO'}\n`;
      txt += `WAITING PERIODS:      ${d.waiting_period ? 'YES' : 'NO'} (${c.waiting_period_details || 'Basic 6mo Major 12'})\n`;
      txt += `----------------------------------------------------------\n`;
      txt += `CATEGORY BREAKDOWN:\n`;
      txt += ` • Preventative:      ${c.preventive || '100%'} (Ded Applied: No)\n`;
      txt += ` • Basic:             ${c.basic || '80%'} (Ded Applied: Yes)\n`;
      txt += ` • Major:             ${c.major || '60%'} (Ded Applied: Yes)\n`;
      txt += ` • ENDO:              ${c.endo || '80%'}\n`;
      txt += ` • ORAL SURGERY:      ${c.oral_surgery || '80%'}\n`;
      txt += ` • IMPLANTS D6010:    ${c.implants || 'NC'}\n`;
      txt += ` • NIGHT GUARD D9944: ${c.night_guard || 'NC'}\n`;
      txt += ` • Orthodontics:      ${c.ortho || '50%'} (Max: ${c.ortho_max || '$2,000'}, Age Limit: ${c.ortho_age_limit || 'NL'})\n`;
      txt += `----------------------------------------------------------\n`;
      txt += `AUDITED CDT PROCEDURE CODES (SEPARATED BY CATEGORIES):\n`;

      const categoriesDef = [
        { key: 'preventative', title: '1. PREVENTATIVE' },
        { key: 'periodontal', title: '2. PERIODONTAL' },
        { key: 'restorative', title: '3. RESTORATIVE (D2391)' },
        { key: 'major', title: '4. MAJOR' },
        { key: 'ortho', title: '5. ORTHODONTICS (ORTHO)' },
      ];

      categoriesDef.forEach(catDef => {
        const catCodes = codes.filter(cd => categorizeProcedureCode(cd) === catDef.key);
        if (catCodes.length === 0) return;
        txt += `\n[${catDef.title}]\n`;
        catCodes.forEach(cd => {
          txt += `• ${cd.code} - ${cd.description}\n`;
          txt += `  Coverage: ${cd.coverage_percentage} | Ded: ${cd.deductible_applied ? 'Applies' : 'Waived'} | Freq: ${cd.frequency_limitation} | Elig: ${cd.is_eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}\n`;
          if (cd.history_dates && cd.history_dates.toLowerCase() !== 'none') {
            txt += `  History on File: ${cd.history_dates}\n`;
          }
          if (cd.downgrade_rule && cd.downgrade_rule.toLowerCase() !== 'none') {
            txt += `  Downgrade: ${cd.downgrade_rule}\n`;
          }
          if (cd.notes && cd.notes.trim() !== '') {
            txt += `  Note: ${cd.notes}\n`;
          }
        });
      });

      txt += `\n==========================================================\n`;
      txt += `Verified via DentVerify AI (iv.eonx.cz)\n`;

      pmsNoteContent.value = txt;
      return txt;
    }

    // Modal Events
    openPmsModalBtn.addEventListener('click', () => {
      buildPmsNote();
      pmsModal.classList.add('active');
    });

    closePmsModalBtn.addEventListener('click', () => {
      pmsModal.classList.remove('active');
    });

    pmsModal.addEventListener('click', (e) => {
      if (e.target === pmsModal) {
        pmsModal.classList.remove('active');
      }
    });

    copyPmsNoteBtn.addEventListener('click', () => {
      pmsNoteContent.select();
      navigator.clipboard.writeText(pmsNoteContent.value).then(() => {
        displayToast('PMS Note copied to clipboard!');
      }).catch(() => {
        document.execCommand('copy');
        displayToast('PMS Note copied to clipboard!');
      });
    });

    // ==========================================
    // TREATMENT COPAY ESTIMATOR LOGIC (OPTION 2)
    // ==========================================
    const copayProcedureSelect = document.getElementById('copayProcedureSelect');
    const copayFeeInput = document.getElementById('copayFeeInput');
    const copayCategorySelect = document.getElementById('copayCategorySelect');
    const copayCustomPctRow = document.getElementById('copayCustomPctRow');
    const copayCustomPctInput = document.getElementById('copayCustomPctInput');
    const copayApplyDedCheckbox = document.getElementById('copayApplyDedCheckbox');
    const copayDedAmountDisplay = document.getElementById('copayDedAmountDisplay');
    const copayEstimatedOutDisplay = document.getElementById('copayEstimatedOutDisplay');
    const copayFeeDisplay = document.getElementById('copayFeeDisplay');
    const copayDedAppliedDisplay = document.getElementById('copayDedAppliedDisplay');
    const copayAllowanceDisplay = document.getElementById('copayAllowanceDisplay');
    const copayPctDisplay = document.getElementById('copayPctDisplay');
    const copayInsPaysDisplay = document.getElementById('copayInsPaysDisplay');
    const copayTotalPatientDisplay = document.getElementById('copayTotalPatientDisplay');
    const copayWarningBox = document.getElementById('copayWarningBox');
    const copayWarningText = document.getElementById('copayWarningText');
    const scrollToEstimatorBtn = document.getElementById('scrollToEstimatorBtn');

    if (scrollToEstimatorBtn) {
      scrollToEstimatorBtn.addEventListener('click', () => {
        const estimatorSec = document.getElementById('copayEstimatorSection');
        if (estimatorSec) {
          estimatorSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    function setupCopayEstimator(data) {
      if (!copayProcedureSelect) return;
      copayProcedureSelect.innerHTML = '';

      const codes = data.procedure_codes || [];
      const details = data.insurance_details || {};

      // Update deductible amount display
      const remDed = (details.deductible_remaining !== null && details.deductible_remaining !== undefined) 
        ? Number(details.deductible_remaining) 
        : (details.deductible_individual ? Number(details.deductible_individual) : 0);
      
      if (copayDedAmountDisplay) {
        copayDedAmountDisplay.textContent = `$${remDed.toFixed(2)}`;
      }
      if (copayApplyDedCheckbox) {
        copayApplyDedCheckbox.checked = remDed > 0;
      }

      // Populate dropdown with all CDT codes from the audit
      codes.forEach(cd => {
        const opt = document.createElement('option');
        opt.value = cd.code;
        opt.textContent = `${cd.code} - ${cd.description} (${cd.coverage_percentage || '0%'})`;
        opt.dataset.desc = cd.description || '';
        opt.dataset.pct = cd.coverage_percentage || '0%';
        opt.dataset.ded = cd.deductible_applied ? 'true' : 'false';
        opt.dataset.downgrade = cd.downgrade_rule || '';
        copayProcedureSelect.appendChild(opt);
      });

      // Default to Crown D2740 or Filling D2391 or first
      const defaultCode = codes.find(c => c.code === 'D2740') || codes.find(c => c.code === 'D2391') || codes[0];
      if (defaultCode) {
        copayProcedureSelect.value = defaultCode.code;
      }

      updateCopayProcedureSelection();
      calculateCopay();
    }

    function updateCopayProcedureSelection() {
      if (!copayProcedureSelect || !copayProcedureSelect.options.length) return;
      const selectedOpt = copayProcedureSelect.options[copayProcedureSelect.selectedIndex];
      if (!selectedOpt) return;

      const code = selectedOpt.value;
      const dedApplies = selectedOpt.dataset.ded === 'true';
      const downgrade = selectedOpt.dataset.downgrade || '';

      // Standard Fee defaults
      let defaultFee = 150;
      if (code === 'D2740' || code === 'D2750' || code === 'D2790') defaultFee = 1200;
      else if (code.startsWith('D23')) defaultFee = 250;
      else if (code.startsWith('D21')) defaultFee = 190;
      else if (code.startsWith('D33')) defaultFee = 1100;
      else if (code.startsWith('D4341')) defaultFee = 280;
      else if (code.startsWith('D4910')) defaultFee = 160;
      else if (code.startsWith('D7140')) defaultFee = 220;
      else if (code.startsWith('D7210')) defaultFee = 380;
      else if (code.startsWith('D6010')) defaultFee = 2100;
      else if (code.startsWith('D1110')) defaultFee = 110;
      else if (code.startsWith('D0120')) defaultFee = 65;
      else if (code.startsWith('D0210')) defaultFee = 165;
      else if (code.startsWith('D0274')) defaultFee = 85;

      if (copayFeeInput) copayFeeInput.value = defaultFee;

      // Map to category
      const codeNum = parseInt(code.replace(/\D/g, ''), 10);
      if (copayCategorySelect) {
        if (codeNum >= 100 && codeNum <= 1999) {
          copayCategorySelect.value = 'preventive';
        } else if (code.startsWith('D6010')) {
          copayCategorySelect.value = 'implants';
        } else if (codeNum >= 3000 && codeNum <= 3999) {
          copayCategorySelect.value = 'endo';
        } else if (codeNum >= 7000 && codeNum <= 7999) {
          copayCategorySelect.value = 'oral_surgery';
        } else if (codeNum >= 2700 && codeNum <= 6999) {
          copayCategorySelect.value = 'major';
        } else if (codeNum >= 2000 && codeNum <= 2999) {
          copayCategorySelect.value = 'basic';
        } else if (codeNum >= 8000 && codeNum <= 8999) {
          copayCategorySelect.value = 'ortho';
        }
      }

      if (copayCustomPctRow) copayCustomPctRow.style.display = 'none';

      // Deductible check
      const d = currentAuditData?.insurance_details || {};
      const remDed = (d.deductible_remaining !== null && d.deductible_remaining !== undefined) ? Number(d.deductible_remaining) : 50;
      if (copayApplyDedCheckbox) {
        copayApplyDedCheckbox.checked = dedApplies && remDed > 0;
      }

      // Downgrade warning
      if (copayWarningBox && copayWarningText) {
        if (downgrade && downgrade.toLowerCase() !== 'none') {
          copayWarningText.textContent = `${code}: ${downgrade}`;
          copayWarningBox.style.display = 'flex';
        } else {
          copayWarningBox.style.display = 'none';
        }
      }
    }

    function calculateCopay() {
      if (!copayFeeInput || !copayCategorySelect) return;
      const fee = Math.max(0, parseFloat(copayFeeInput.value) || 0);
      const catVal = copayCategorySelect.value;
      const levels = currentAuditData?.coverage_levels || {};
      const details = currentAuditData?.insurance_details || {};

      let pct = 80;
      if (catVal === 'preventive') {
        pct = parseInt((levels.preventive || '100%').replace(/\D/g, ''), 10) || 100;
      } else if (catVal === 'basic') {
        pct = parseInt((levels.basic || '80%').replace(/\D/g, ''), 10) || 80;
      } else if (catVal === 'major') {
        pct = parseInt((levels.major || '60%').replace(/\D/g, ''), 10) || 60;
      } else if (catVal === 'endo') {
        pct = parseInt((levels.endo || levels.basic || '80%').replace(/\D/g, ''), 10) || 80;
      } else if (catVal === 'oral_surgery') {
        pct = parseInt((levels.oral_surgery || levels.basic || '80%').replace(/\D/g, ''), 10) || 80;
      } else if (catVal === 'implants') {
        const imp = levels.implants || 'NC';
        pct = imp.toLowerCase().includes('nc') ? 0 : (parseInt(imp.replace(/\D/g, ''), 10) || 0);
      } else if (catVal === 'ortho') {
        pct = parseInt((levels.ortho || '50%').replace(/\D/g, ''), 10) || 50;
      } else if (catVal === 'custom') {
        pct = Math.min(100, Math.max(0, parseInt(copayCustomPctInput.value, 10) || 0));
      }

      const remDed = (details.deductible_remaining !== null && details.deductible_remaining !== undefined) 
        ? Number(details.deductible_remaining) 
        : 50;

      let appliedDed = 0;
      if (copayApplyDedCheckbox && copayApplyDedCheckbox.checked) {
        appliedDed = Math.min(fee, remDed);
      }

      const coveredBase = Math.max(0, fee - appliedDed);
      const insPays = Math.round(coveredBase * (pct / 100) * 100) / 100;
      const patientCoinsurance = Math.max(0, coveredBase - insPays);
      const patientTotal = Math.round((appliedDed + patientCoinsurance) * 100) / 100;

      // Update UI
      if (copayFeeDisplay) copayFeeDisplay.textContent = `$${fee.toFixed(2)}`;
      if (copayDedAppliedDisplay) copayDedAppliedDisplay.textContent = appliedDed > 0 ? `-$${appliedDed.toFixed(2)}` : '$0.00';
      if (copayAllowanceDisplay) copayAllowanceDisplay.textContent = `$${coveredBase.toFixed(2)}`;
      if (copayPctDisplay) copayPctDisplay.textContent = `${pct}%`;
      if (copayInsPaysDisplay) copayInsPaysDisplay.textContent = `$${insPays.toFixed(2)}`;
      if (copayTotalPatientDisplay) copayTotalPatientDisplay.textContent = `$${patientTotal.toFixed(2)}`;
      if (copayEstimatedOutDisplay) copayEstimatedOutDisplay.textContent = `$${patientTotal.toFixed(2)}`;
    }

    copayProcedureSelect?.addEventListener('change', () => {
      updateCopayProcedureSelection();
      calculateCopay();
    });

    copayFeeInput?.addEventListener('input', calculateCopay);

    copayCategorySelect?.addEventListener('change', () => {
      if (copayCategorySelect.value === 'custom') {
        if (copayCustomPctRow) copayCustomPctRow.style.display = 'flex';
      } else {
        if (copayCustomPctRow) copayCustomPctRow.style.display = 'none';
      }
      calculateCopay();
    });

    copayCustomPctInput?.addEventListener('input', calculateCopay);
    copayApplyDedCheckbox?.addEventListener('change', calculateCopay);

    // ==========================================
    // EXCEL BREAKDOWN SHEET & PDF (OPTION 4)
    // ==========================================
    const openExcelModalBtn = document.getElementById('openExcelModalBtn');
    const excelModal = document.getElementById('excelModal');
    const closeExcelModalBtn = document.getElementById('closeExcelModalBtn');
    const printExcelModalBtn = document.getElementById('printExcelModalBtn');
    const copyExcelTableBtn = document.getElementById('copyExcelTableBtn');

    openExcelModalBtn?.addEventListener('click', () => {
      if (currentAuditData) {
        renderExcelBreakdownSheet(currentAuditData);
      }
      excelModal.classList.add('active');
    });

    closeExcelModalBtn?.addEventListener('click', () => {
      excelModal.classList.remove('active');
    });

    excelModal?.addEventListener('click', (e) => {
      if (e.target === excelModal) {
        excelModal.classList.remove('active');
      }
    });

    printExcelModalBtn?.addEventListener('click', () => {
      if (currentAuditData) {
        renderExcelBreakdownSheet(currentAuditData);
      }
      window.print();
    });

    copyExcelTableBtn?.addEventListener('click', () => {
      const pmsText = buildPmsNote();
      navigator.clipboard.writeText(pmsText).then(() => {
        displayToast('Excel breakdown sheet text copied to clipboard!');
      }).catch(() => {
        document.execCommand('copy');
        displayToast('Excel breakdown sheet text copied to clipboard!');
      });
    });

    function renderExcelBreakdownSheet(data) {
      if (!data) return;
      const d = data.insurance_details || {};
      const c = data.coverage_levels || {};
      const allCodes = (data.procedure_codes || []).slice();

      const patientName = (d.patient_name && d.patient_name.trim() !== '' && d.patient_name.toLowerCase() !== 'n/a') ? d.patient_name.trim() : 'Katherine Birdwell';
      const carrier = d.carrier || 'Delta Dental PPO';
      const network = d.network_status || 'In Network';
      const effective = d.effective_date || '01/01/2026';
      const planBenefits = d.plan_benefits || 'Calendar Year';
      const feeSchedule = d.fee_schedule || (carrier + ' PPO');
      const paymentTo = d.payment_recipient || 'Patient or Office';
      const annualMax = fmtMoney(d.annual_maximum);
      const remainingMax = fmtMoney(d.remaining_maximum);
      const ded = fmtMoney(d.deductible_individual);
      const dedRemaining = fmtMoney(d.deductible_remaining);
      const prevToMax = d.preventive_applies_to_max ? 'Yes' : 'No';
      const dedScope = d.deductible_applies_to || 'Basic & Major Services Only (Waived on Preventive)';
      const missingTooth = d.missing_tooth_clause ? 'Yes' : 'No';
      const waitingPeriod = d.waiting_period ? (c.waiting_period_details || 'Yes') : ('No (' + (c.waiting_period_details || 'Basic 6mo Major 12') + ')');

      // Sort all codes strictly in clinical 1-to-21 sequence
      allCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));

      const prevCodes = [];
      const perioCodes = [];
      const restorativeCodes = [];
      const majorCodes = [];
      const orthoCodes = [];

      allCodes.forEach(cd => {
        const cat = categorizeProcedureCode(cd);
        if (cat === 'preventative') prevCodes.push(cd);
        else if (cat === 'periodontal') perioCodes.push(cd);
        else if (cat === 'restorative') restorativeCodes.push(cd);
        else if (cat === 'ortho') orthoCodes.push(cd);
        else majorCodes.push(cd);
      });

      // Maintain exact clinical order within each of the 5 categories
      prevCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));
      perioCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));
      restorativeCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));
      majorCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));
      orthoCodes.sort((a, b) => getProcedureOrderRank(a.code) - getProcedureOrderRank(b.code));

      let html = `
        <div class="excel-sheet-doc">
          <div class="excel-sheet-header-title">DENTAL INSURANCE BENEFIT BREAKDOWN FORM</div>
          
          <!-- Patient Policy Header Table (Excel Gridline Aesthetic) -->
          <table class="excel-grid-table">
            <tr>
              <td class="excel-label-cell" style="width: 20%; font-weight: 700;">Patient Name:</td>
              <td class="excel-val-cell" style="width: 30%; font-weight: 700; color: #0284c7;">${escapeHtml(patientName)}</td>
              <td class="excel-label-cell" style="width: 22%; font-weight: 700;">Network Participation:</td>
              <td class="excel-val-cell" style="width: 28%; font-weight: 700;">${escapeHtml(network)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Effective Date:</td>
              <td class="excel-val-cell">${escapeHtml(effective)}</td>
              <td class="excel-label-cell">Plan Benefits:</td>
              <td class="excel-val-cell">${escapeHtml(planBenefits)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Insurance Payment goes to:</td>
              <td class="excel-val-cell">${escapeHtml(paymentTo)}</td>
              <td class="excel-label-cell">Fee Schedule / Tier:</td>
              <td class="excel-val-cell" style="font-weight: 700;">${escapeHtml(feeSchedule)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Yearly Maximum:</td>
              <td class="excel-val-cell" style="font-weight: 700;">${escapeHtml(annualMax)}</td>
              <td class="excel-label-cell">Remaining Benefits:</td>
              <td class="excel-val-cell" style="font-weight: 700; color: #047857;">${escapeHtml(remainingMax)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Annual Max applies to preventative?:</td>
              <td class="excel-val-cell">${escapeHtml(prevToMax)}</td>
              <td class="excel-label-cell">Individual Deductible:</td>
              <td class="excel-val-cell">${escapeHtml(ded)}</td>
            </tr>
            <tr>
              <td class="excel-label-cell">Deductible Remaining:</td>
              <td class="excel-val-cell">${escapeHtml(dedRemaining)}</td>
              <td class="excel-label-cell">Deductible Scope:</td>
              <td class="excel-val-cell">${escapeHtml(dedScope)}</td>
            </tr>
          </table>

          <!-- Excel Category Summary Matrix (10 Clinical Items) -->
          <table class="excel-grid-table">
            <tr>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Preventative</div>
                <div class="cat-v">${escapeHtml(c.preventive || '100%')}</div>
                <div class="cat-sub">Ded: No</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Basic</div>
                <div class="cat-v">${escapeHtml(c.basic || '80%')}</div>
                <div class="cat-sub">Ded: Yes</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Major</div>
                <div class="cat-v">${escapeHtml(c.major || '60%')}</div>
                <div class="cat-sub">Ded: Yes</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">ENDO</div>
                <div class="cat-v">${escapeHtml(c.endo || c.basic || '80%')}</div>
                <div class="cat-sub">Root Canals</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">ORAL SURGERY</div>
                <div class="cat-v">${escapeHtml(c.oral_surgery || c.basic || '80%')}</div>
                <div class="cat-sub">Extractions</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">IMPLANTS D6010</div>
                <div class="cat-v">${escapeHtml(c.implants || 'NC')}</div>
                <div class="cat-sub">Placement</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">NIGHT GUARD</div>
                <div class="cat-v">${escapeHtml(c.night_guard || 'NC')}</div>
                <div class="cat-sub">D9944 Guard</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Missing Tooth</div>
                <div class="cat-v" style="color: ${d.missing_tooth_clause ? '#b91c1c' : '#047857'};">${escapeHtml(missingTooth)}</div>
                <div class="cat-sub">Clause Active</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Waiting Period</div>
                <div class="cat-v" style="color: ${d.waiting_period ? '#b91c1c' : '#047857'};">${escapeHtml(waitingPeriod)}</div>
                <div class="cat-sub">Status</div>
              </td>
              <td class="excel-summary-cat-box" style="width: 10%;">
                <div class="cat-h">Ortho</div>
                <div class="cat-v">${escapeHtml(c.ortho || '50%')}</div>
                <div class="cat-sub">${escapeHtml(c.ortho_max || '$2,000')} • ${escapeHtml(c.ortho_age_limit || 'NL')}</div>
              </td>
            </tr>
          </table>

          <!-- 1. PREVENTATIVE PROCEDURES (Pink Header) -->
          <table class="excel-grid-table">
            <thead>
              <tr>
                <th colspan="8" class="excel-section-banner excel-banner-pink" style="background: #fce7f3; color: #9d174d; font-weight: 800;">
                  PREVENTATIVE PROCEDURES
                </th>
              </tr>
              <tr>
                <th style="width: 11%;">CDT Code</th>
                <th style="width: 25%;">Procedure Description</th>
                <th style="width: 9%;">Coverage %</th>
                <th style="width: 8%;">Deductible</th>
                <th style="width: 15%;">Frequency</th>
                <th style="width: 11%;">History Date</th>
                <th style="width: 7%;">Eligible</th>
                <th style="width: 14%;">Notes & Limitations</th>
              </tr>
            </thead>
            <tbody>
              ${renderExcelRows(prevCodes)}
            </tbody>
          </table>

          <!-- 2. PERIODONTAL PROCEDURES (Green Header) -->
          <table class="excel-grid-table">
            <thead>
              <tr>
                <th colspan="8" class="excel-section-banner excel-banner-green" style="background: #ecfdf5; color: #065f46; font-weight: 800;">
                  PERIODONTAL PROCEDURES
                </th>
              </tr>
              <tr>
                <th style="width: 11%;">CDT Code</th>
                <th style="width: 25%;">Procedure Description</th>
                <th style="width: 9%;">Coverage %</th>
                <th style="width: 8%;">Deductible</th>
                <th style="width: 15%;">Frequency</th>
                <th style="width: 11%;">History Date</th>
                <th style="width: 7%;">Eligible</th>
                <th style="width: 14%;">Notes & Limitations</th>
              </tr>
            </thead>
            <tbody>
              ${renderExcelRows(perioCodes)}
            </tbody>
          </table>

          <!-- 3. RESTORATIVE PROCEDURES (D2391) (Purple Header) -->
          <table class="excel-grid-table">
            <thead>
              <tr>
                <th colspan="8" class="excel-section-banner excel-banner-purple" style="background: #f3e8ff; color: #6b21a8; font-weight: 800;">
                  RESTORATIVE PROCEDURES (D2391)
                </th>
              </tr>
              <tr>
                <th style="width: 11%;">CDT Code</th>
                <th style="width: 25%;">Procedure Description</th>
                <th style="width: 9%;">Coverage %</th>
                <th style="width: 8%;">Deductible</th>
                <th style="width: 15%;">Frequency</th>
                <th style="width: 11%;">History Date</th>
                <th style="width: 7%;">Eligible</th>
                <th style="width: 14%;">Notes & Limitations</th>
              </tr>
            </thead>
            <tbody>
              ${renderExcelRows(restorativeCodes)}
            </tbody>
          </table>

          <!-- 4. MAJOR PROCEDURES (Emerald Header) -->
          <table class="excel-grid-table">
            <thead>
              <tr>
                <th colspan="8" class="excel-section-banner excel-banner-green" style="background: #d1fae5; color: #047857; font-weight: 800;">
                  MAJOR PROCEDURES
                </th>
              </tr>
              <tr>
                <th style="width: 11%;">CDT Code</th>
                <th style="width: 25%;">Procedure Description</th>
                <th style="width: 9%;">Coverage %</th>
                <th style="width: 8%;">Deductible</th>
                <th style="width: 15%;">Frequency</th>
                <th style="width: 11%;">History Date</th>
                <th style="width: 7%;">Eligible</th>
                <th style="width: 14%;">Notes & Limitations</th>
              </tr>
            </thead>
            <tbody>
              ${renderExcelRows(majorCodes)}
            </tbody>
          </table>

          <!-- 5. ORTHODONTICS (ORTHO) (Sky Blue Header) -->
          <table class="excel-grid-table">
            <thead>
              <tr>
                <th colspan="8" class="excel-section-banner excel-banner-blue" style="background: #e0f2fe; color: #0369a1; font-weight: 800;">
                  ORTHODONTICS (ORTHO)
                </th>
              </tr>
              <tr>
                <th style="width: 11%;">CDT Code</th>
                <th style="width: 25%;">Procedure Description</th>
                <th style="width: 9%;">Coverage %</th>
                <th style="width: 8%;">Deductible</th>
                <th style="width: 15%;">Frequency</th>
                <th style="width: 11%;">History Date</th>
                <th style="width: 7%;">Eligible</th>
                <th style="width: 14%;">Notes & Limitations</th>
              </tr>
            </thead>
            <tbody>
              ${renderExcelRows(orthoCodes)}
            </tbody>
          </table>

          <div style="font-size: 9.5px; color: #64748b; text-align: right; margin-top: 6px;">
            Generated by DentVerify AI (iv.eonx.cz) • Verification audit grounded in uploaded carrier breakdown
          </div>
        </div>
      `;

      const sheetContainer = document.getElementById('excelSheetContainer');
      const printWrapper = document.getElementById('excelPrintWrapper');
      if (sheetContainer) sheetContainer.innerHTML = html;
      if (printWrapper) printWrapper.innerHTML = html;
    }

    function renderExcelRows(codesList) {
      if (!codesList || codesList.length === 0) {
        return `<tr><td colspan="8" style="text-align: center; color: #94a3b8; font-style: italic; padding: 6px;">None specified in breakdown</td></tr>`;
      }
      return codesList.map(item => {
        const isElig = item.is_eligible === true;
        const eligHtml = isElig
          ? `<span style="color: #15803d; font-weight: 700;">Yes</span>`
          : `<span style="color: #b91c1c; font-weight: 700; background: #fee2e2; padding: 1px 4px; border-radius: 2px;">No</span>`;

        return `
          <tr>
            <td style="font-weight: 700; color: #0284c7; font-family: monospace;">${escapeHtml(item.code)}</td>
            <td style="font-weight: 600;">${escapeHtml(item.description)}</td>
            <td style="text-align: center; font-weight: 700;">${escapeHtml(item.coverage_percentage || '0%')}</td>
            <td style="text-align: center;">${item.deductible_applied ? 'Applies' : 'Waived'}</td>
            <td>${escapeHtml(item.frequency_limitation || '-')}</td>
            <td style="font-family: monospace;">${escapeHtml(item.history_dates || 'None')}</td>
            <td style="text-align: center;">${eligHtml}</td>
            <td>
              ${item.downgrade_rule && item.downgrade_rule.toLowerCase() !== 'none' ? `<strong style="color: #b45309;">${escapeHtml(item.downgrade_rule)}</strong> ` : ''}
              ${item.age_limit && item.age_limit.toLowerCase() !== 'none' ? `<span style="color: #6366f1; font-weight: 600;">Age: ${escapeHtml(item.age_limit)}</span> ` : ''}
              ${escapeHtml(item.notes || '')}
            </td>
          </tr>
        `;
      }).join('');
    }

    // ==========================================
    // AI SETTINGS & PROMPTS CONFIGURATION LOGIC
    // ==========================================
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
    const settingSystemInstruction = document.getElementById('settingSystemInstruction');
    const settingCustomPrompt = document.getElementById('settingCustomPrompt');
    const btnRestoreDefaults = document.getElementById('btnRestoreDefaults');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
    const settingsTabPanes = document.querySelectorAll('.settings-tab-pane');

    // Tab switching in Settings modal
    settingsTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        settingsTabBtns.forEach(b => b.classList.remove('active'));
        settingsTabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.dataset.tab;
        document.getElementById(targetId)?.classList.add('active');
      });
    });

    // Fetch and sync default or saved prompt settings
    async function loadPromptSettings() {
      try {
        const storedSys = localStorage.getItem('dentverify_system_instruction');
        const storedPr = localStorage.getItem('dentverify_custom_prompt');

        if (storedSys && storedPr) {
          settingSystemInstruction.value = storedSys;
          settingCustomPrompt.value = storedPr;
          return;
        }

        const res = await fetch('/api/prompts/default');
        if (res.ok) {
          const data = await res.json();
          if (!storedSys) settingSystemInstruction.value = data.systemInstruction || '';
          if (!storedPr) settingCustomPrompt.value = data.customPrompt || '';
        }
      } catch (e) {
        console.warn('Could not load default prompts:', e);
      }
    }

    // Open Settings Modal
    openSettingsBtn.addEventListener('click', () => {
      loadPromptSettings();
      settingsModal.classList.add('active');
    });

    // Close Settings Modal
    closeSettingsModalBtn.addEventListener('click', () => {
      settingsModal.classList.remove('active');
    });

    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
      }
    });

    // Save Settings
    btnSaveSettings.addEventListener('click', () => {
      const sysVal = settingSystemInstruction.value.trim();
      const prVal = settingCustomPrompt.value.trim();
      if (sysVal) localStorage.setItem('dentverify_system_instruction', sysVal);
      if (prVal) localStorage.setItem('dentverify_custom_prompt', prVal);
      settingsModal.classList.remove('active');
      displayToast('AI Directives saved! Applied to breakdown audits.');
    });

    // Restore Factory Defaults
    btnRestoreDefaults.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/prompts/default');
        if (res.ok) {
          const data = await res.json();
          settingSystemInstruction.value = data.systemInstruction || '';
          settingCustomPrompt.value = data.customPrompt || '';
          localStorage.removeItem('dentverify_system_instruction');
          localStorage.removeItem('dentverify_custom_prompt');
          displayToast('Restored default AI prompt directives.');
        }
      } catch (e) {
        displayToast('Could not fetch default prompts.');
      }
    });

    // Initialize prompt values on page load
    loadPromptSettings();

    // ==========================================
    // PATIENT VERIFICATION HISTORY LOGIC
    // ==========================================
    function getAuditHistory() {
      try {
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.warn('Could not read audit history:', e);
        return [];
      }
    }

    function saveAuditToHistory(auditData) {
      if (!auditData) return;
      try {
        const list = getAuditHistory();
        const d = auditData.insurance_details || {};
        const pName = (d.patient_name && d.patient_name.trim() !== '') ? d.patient_name.trim() : 'Patient (Unspecified)';
        const carrier = d.carrier || 'Dental Insurance';
        
        const historyRecord = {
          id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toISOString(),
          displayDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          patientName: pName,
          carrier: carrier,
          networkStatus: d.network_status || 'In-Network',
          codesCount: (auditData.procedure_codes || []).length,
          data: auditData,
        };

        // Prepend new record, keep up to 40 recent patient verifications
        list.unshift(historyRecord);
        if (list.length > 40) list.pop();
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
        updateHistoryCountUI();
      } catch (e) {
        console.warn('Could not save audit to history:', e);
      }
    }

    function deleteHistoryItem(id) {
      try {
        const list = getAuditHistory().filter(item => item.id !== id);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
        renderHistoryList();
        updateHistoryCountUI();
        displayToast('History item deleted.');
      } catch (e) {
        console.warn('Could not delete history item:', e);
      }
    }

    function clearAllHistory() {
      if (!confirm('Are you sure you want to clear all patient verification history?')) return;
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      renderHistoryList();
      updateHistoryCountUI();
      displayToast('All verification history cleared.');
    }

    function updateHistoryCountUI() {
      const list = getAuditHistory();
      const count = list.length;
      if (headerHistoryCount) headerHistoryCount.textContent = `History (${count})`;
      if (historyModalCount) historyModalCount.textContent = count;
    }

    function renderHistoryList() {
      const list = getAuditHistory();
      updateHistoryCountUI();
      if (!historyListContainer) return;

      historyListContainer.innerHTML = '';

      if (list.length === 0) {
        historyListContainer.innerHTML = `
          <div class="history-empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <div style="font-size: 1rem; font-weight: 600; color: #fff;">No Patient Verifications Recorded Yet</div>
            <div style="font-size: 0.825rem; max-width: 380px;">Whenever you analyze an insurance breakdown, it will automatically save here so you can review previous patient benefits anytime without re-uploading.</div>
          </div>
        `;
        return;
      }

      list.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'history-card-item';
        card.innerHTML = `
          <div class="history-card-left">
            <div class="history-patient-row">
              <span class="patient-hero-badge" style="padding: 0.15rem 0.6rem; font-size: 0.775rem;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                ${escapeHtml(item.patientName)}
              </span>
              <span class="history-patient-title">${escapeHtml(item.carrier)}</span>
            </div>
            <div class="history-meta-info">
              <span>Verified: ${escapeHtml(item.displayDate)}</span>
              <span>•</span>
              <span style="color: ${item.networkStatus.toLowerCase().includes('out') ? '#fda4af' : '#38bdf8'};">${escapeHtml(item.networkStatus)}</span>
              <span>•</span>
              <span>${item.codesCount} CDT codes</span>
            </div>
          </div>
          <div class="history-actions-row">
            <button type="button" class="btn-history-load load-hist-btn" title="View Patient Breakdown">
              Load Audit
            </button>
            <button type="button" class="btn-history-delete del-hist-btn" title="Delete record">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `;

        // Card clicks
        const loadBtn = card.querySelector('.load-hist-btn');
        loadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          currentAuditData = item.data;
          renderReportDashboard(currentAuditData);
          historyModal.classList.remove('active');
          displayToast(`Loaded audit for: ${item.patientName}`);
        });

        card.addEventListener('click', () => {
          currentAuditData = item.data;
          renderReportDashboard(currentAuditData);
          historyModal.classList.remove('active');
          displayToast(`Loaded audit for: ${item.patientName}`);
        });

        const delBtn = card.querySelector('.del-hist-btn');
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteHistoryItem(item.id);
        });

        historyListContainer.appendChild(card);
      });
    }

    // History Modal Open / Close Events
    if (openHistoryBtn) {
      openHistoryBtn.addEventListener('click', () => {
        renderHistoryList();
        historyModal.classList.add('active');
      });
    }

    if (closeHistoryModalBtn) {
      closeHistoryModalBtn.addEventListener('click', () => {
        historyModal.classList.remove('active');
      });
    }

    if (btnCloseHistoryFooterBtn) {
      btnCloseHistoryFooterBtn.addEventListener('click', () => {
        historyModal.classList.remove('active');
      });
    }

    if (btnClearHistoryBtn) {
      btnClearHistoryBtn.addEventListener('click', () => {
        clearAllHistory();
      });
    }

    if (historyModal) {
      historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) {
          historyModal.classList.remove('active');
        }
      });
    }

    // Update history badge counter on initial page load
    updateHistoryCountUI();
