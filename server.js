require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Multer for memory buffer storage (up to 25MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max file size
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Unsupported file format. Please upload a PDF, PNG, JPG, or WEBP document.'
        )
      );
    }
  },
});

// Disable client caching for fast updates
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));
app.use(express.json());

// Strict Response Schema for Gemini
const dentalBreakdownSchema = {
  type: Type.OBJECT,
  properties: {
    insurance_details: {
      type: Type.OBJECT,
      properties: {
        patient_name: {
          type: Type.STRING,
          description: 'Patient Full Name if found on the document (e.g. Katherine Birdwell). Omit SSN, DOB, or other sensitive IDs.',
          nullable: true,
        },
        carrier: {
          type: Type.STRING,
          description: 'Dental Insurance Carrier Name (e.g. Delta Dental, MetLife, Cigna, Guardian)',
        },
        effective_date: {
          type: Type.STRING,
          description: 'Policy effective date or coverage benefit period (e.g. 01/01/2026)',
        },
        network_status: {
          type: Type.STRING,
          description: 'Network status detected (e.g., In-Network, Out-of-Network, PPO, Premier)',
        },
        plan_benefits: {
          type: Type.STRING,
          description: 'Plan benefits period or type (e.g. Calendar Year, Fiscal Year)',
          nullable: true,
        },
        fee_schedule: {
          type: Type.STRING,
          description: 'Fee Schedule or network tier (e.g. Delta Dental PPO, Standard Fee)',
          nullable: true,
        },
        payment_recipient: {
          type: Type.STRING,
          description: 'Insurance payment recipient (e.g. Patient or Office)',
          nullable: true,
        },
        annual_maximum: {
          type: Type.NUMBER,
          description: 'Individual annual maximum benefit in dollars (null if unlimited or not specified)',
          nullable: true,
        },
        remaining_maximum: {
          type: Type.NUMBER,
          description: 'Remaining annual maximum benefit in dollars (null if unlimited or not specified)',
          nullable: true,
        },
        preventive_applies_to_max: {
          type: Type.BOOLEAN,
          description: 'Whether preventive/diagnostic procedures count against the annual maximum',
          nullable: true,
        },
        deductible_individual: {
          type: Type.NUMBER,
          description: 'Individual annual deductible amount in dollars (null if $0 or none)',
          nullable: true,
        },
        deductible_remaining: {
          type: Type.NUMBER,
          description: 'Remaining deductible balance in dollars (null if $0 or none)',
          nullable: true,
        },
        deductible_applies_to: {
          type: Type.STRING,
          description: 'Categories where deductible applies (e.g., Basic & Major only, All categories, Waived on Preventive)',
        },
        missing_tooth_clause: {
          type: Type.BOOLEAN,
          description: 'True if missing tooth clause applies or is present, false otherwise',
          nullable: true,
        },
        waiting_period: {
          type: Type.BOOLEAN,
          description: 'True if there are waiting periods on Basic or Major services, false otherwise',
          nullable: true,
        },
      },
      required: [
        'carrier',
        'effective_date',
        'network_status',
        'deductible_applies_to',
      ],
    },
    coverage_levels: {
      type: Type.OBJECT,
      properties: {
        preventive: {
          type: Type.STRING,
          description: 'Preventive coverage % (e.g., 100%, 80%)',
        },
        basic: {
          type: Type.STRING,
          description: 'Basic restorative coverage % (e.g., 80%, 70%)',
        },
        major: {
          type: Type.STRING,
          description: 'Major coverage % (e.g., 60%, 50%, 0%)',
        },
        endo: {
          type: Type.STRING,
          description: 'Endodontics coverage % (e.g., 80%, Basic, 50%)',
        },
        oral_surgery: {
          type: Type.STRING,
          description: 'Oral surgery coverage % (e.g., 80%, Basic, 50%)',
        },
        implants: {
          type: Type.STRING,
          description: 'Implants D6010 coverage % or status (e.g., NC / Not Covered, 50%, 60%, 0%)',
        },
        night_guard: {
          type: Type.STRING,
          description: 'Night guard D9944 coverage % or status (e.g., NC / Not Covered, 50%, 0%)',
          nullable: true,
        },
        waiting_period_details: {
          type: Type.STRING,
          description: 'Waiting period details (e.g. Basic 6mo Major 12, None, No)',
          nullable: true,
        },
        ortho: {
          type: Type.STRING,
          description: 'Orthodontics coverage % (e.g., 50%, Not Covered, 0%)',
        },
        ortho_max: {
          type: Type.STRING,
          description: 'Orthodontic lifetime maximum benefit (e.g., $2,000, $1500, N/A)',
        },
        ortho_age_limit: {
          type: Type.STRING,
          description: 'Orthodontic age limitation (e.g., NL, No Limit, Up to age 19)',
        },
      },
      required: [
        'preventive',
        'basic',
        'major',
        'endo',
        'oral_surgery',
        'implants',
        'ortho',
      ],
    },
    procedure_codes: {
      type: Type.ARRAY,
      description: 'Comprehensive, exhaustive list of all CDT codes found in the breakdown document',
      items: {
        type: Type.OBJECT,
        properties: {
          code: {
            type: Type.STRING,
            description: 'CDT procedure code (e.g., D4346, D1110, D0274, D0210, D0330, D0220, D9110, D0120, D0140, D1351, D1206, D4341, D4910, D2391, D2740, D2920, D7140, D7210, D9222, D9223, D9944, D6010, Ortho)',
          },
          description: {
            type: Type.STRING,
            description: 'Standard CDT nomenclature or breakdown description',
          },
          coverage_percentage: {
            type: Type.STRING,
            description: 'Coverage percentage (e.g., 100%, 80%, 60%, 40%, 0% or NC)',
          },
          deductible_applied: {
            type: Type.BOOLEAN,
            description: 'Whether deductible applies to this procedure code',
            nullable: true,
          },
          frequency_limitation: {
            type: Type.STRING,
            description: 'Frequency limitation rule (e.g., 2x1yr, 1x5yr, 1X24m, NF, 1 in 150 days, 1/LT)',
          },
          age_limit: {
            type: Type.STRING,
            description: 'Age limit (e.g., 15, 18, Under 19, NL, None)',
          },
          is_eligible: {
            type: Type.BOOLEAN,
            description: 'Whether patient is eligible or covered based on current verification and frequency history',
          },
          history_dates: {
            type: Type.STRING,
            description: 'Previous service date, last claimed date, or "None"',
          },
          downgrade_rule: {
            type: Type.STRING,
            description: 'Downgrade rule (e.g., Downgraded to Amalgam on posterior, None, No)',
          },
          notes: {
            type: Type.STRING,
            description: 'Clinical / Billing limitation notes (e.g., Shared freq with D1110, Seat date used, All quads per visit, Additional exam)',
          },
        },
        required: [
          'code',
          'description',
          'coverage_percentage',
          'frequency_limitation',
          'age_limit',
          'is_eligible',
          'history_dates',
          'downgrade_rule',
          'notes',
        ],
      },
    },
  },
  required: ['insurance_details', 'coverage_levels', 'procedure_codes'],
};

// ==========================================
// DEFAULT CLINICAL RCM PROMPT DIRECTIVES
// ==========================================
const DEFAULT_SYSTEM_INSTRUCTION = `You are an expert dental revenue cycle management (RCM) billing auditor and clinical dental insurance verification specialist operating under strict HIPAA compliance rules.

Your mission is to audit dental breakdown sheets, fee schedules, or insurance web portal eligibility screenshots, extract 100% accurate benefit calculations, and return the data strictly formatted according to the defined JSON schema.

==================================================
1. STRICT HIPAA & PRIVACY DIRECTIVES (ZERO PHI)
==================================================
- Transient Processing: Process the uploaded document purely in memory. Never store, log, or persist data.
- Absolute Zero Sensitive PHI: Never extract or output Protected Health Information (PHI) or Personally Identifiable Information (PII) such as dates of birth (DOB), Social Security Numbers (SSN), member/subscriber IDs, group numbers, addresses, or phone numbers.
- Patient Name: Patient Name may be extracted solely for clinical verification matching.
- Scope: Restrict all extraction strictly to plan financial rules, network tiers, CDT codes, coverage percentages, frequencies, and clinical history dates.

==================================================
2. CORE AUDITING & CALCULATION RULES
==================================================
1. Network Prioritization & Tiering:
   - If a network tier (In-Network or Out-of-Network) is specified by the user or document, strictly extract benefit percentages, maximums, and deductibles for that selected tier.
   - If dual-column tables (In-Net vs Out-of-Net) exist and no preference is specified, prioritize In-Network while noting Out-of-Network variations in the notes.

2. Financials & Deductible Allocation:
   - Accurately parse Annual Maximum, Remaining Maximum, Individual Deductible, and Remaining Deductible.
   - Explicitly verify whether Deductible applies to Preventive/Diagnostic (e.g., "Preventive Ded Applied: No").
   - Explicitly verify if Preventive services count toward the Annual Maximum (e.g., "Preventive applies to Max: No").
   - Check and flag Missing Tooth Clauses (MTC) and Waiting Periods (flag 'None' or 'No' if waived or not applicable, e.g. "Basic 6mo Major 12").

3. Frequency & Shared Rules:
   - Accurately capture exact wording for frequencies (e.g., "1 in 150 days", "2 in 12 rolling months", "2x1yr", "1x5yr", "1 in 36 months", "1 per lifetime / 1/LT", or "NF" for No Frequency).
   - Detect shared frequencies (e.g., D4346 shared with D1110; D0330 shared with D0210).
   - Identify quadrant limitations for Periodontics (e.g., SRP max 2 quads per visit vs all quads allowed).

4. Exclusions & Not Covered (NC):
   - If a code or service is marked as Not Covered (NC) or excluded by the plan (e.g., Adult Fluoride D1206 NC, Crown Recement D2920 NC, Night Guard D9944 NC, Implants D6010 NC):
     * Set coverage_percentage to "0%" or "NC"
     * Set is_eligible to false
     * Add "Not Covered by Plan" or "NC" in notes.

5. Clinical History & Downgrades:
   - Extract exact previous claim/service dates for history. If no history is recorded, write "None".
   - Restorative Downgrades: Explicitly check if posterior composite fillings (D2391–D2394) are downgraded to amalgam allowances.
   - Crown Limitations: Note if replacement frequency applies to prep date or seat date (e.g., "Seat", "1 in 60 months from seat date").

==================================================
3. OUTPUT FORMAT
==================================================
Return output strictly in the pre-configured JSON schema. Do not output conversational explanations or markdown text outside the JSON.`;

const DEFAULT_CDT_CODES_PROMPT = `Carefully audit the attached dental insurance breakdown document or portal screenshot.
Extract all insurance financials, coverage percentage tiers, and procedure code benefits based on the selected network tier.

YOU MUST SPECIFICALLY AUDIT AND EXTRACT THE REQUIRED CDT PROCEDURES IF PRESENT OR COVERED:

1. DIAGNOSTIC & PREVENTIVE:
   - D0120: Periodic Oral Evaluation (Exam)
   - D0140: Limited Oral Evaluation (Problem Focused)
   - D0150: Comprehensive Oral Evaluation (New Patient Exam)
   - D0180: Comprehensive Periodontal Evaluation
   - D1110: Prophylaxis (Cleaning) - Adult
   - D1120: Prophylaxis (Cleaning) - Child
   - D4346: Scaling in presence of generalized moderate or severe gingival inflammation
   - D0210: Complete Intraoral Series of Radiographic Images (FMX)
   - D0330: Panoramic Radiographic Image (Pano)
   - D0272: Bitewings - Two Radiographic Images
   - D0274: Bitewings - Four Radiographic Images
   - D0220: Intraoral - Periapical First Radiographic Image (PA)
   - D0230: Intraoral - Periapical Each Additional Radiographic Image
   - D1206: Topical Application of Fluoride Varnish
   - D1208: Topical Application of Fluoride - Excluding Varnish
   - D1351: Sealant - Per Tooth

2. PERIODONTICS:
   - D4341: Periodontal Scaling and Root Planing (SRP) - Four or more teeth per quadrant
   - D4342: Periodontal Scaling and Root Planing (SRP) - One to three teeth per quadrant
   - D4910: Periodontal Maintenance
   - D4381: Localized delivery of antimicrobial agents

3. RESTORATIVE (BASIC):
   - D2140 / D2150 / D2160 / D2161: Amalgam Fillings (1, 2, 3, 4+ surfaces)
   - D2330 / D2331 / D2332 / D2335: Resin-based Composite - Anterior (1, 2, 3, 4+ surfaces)
   - D2391 / D2392 / D2393 / D2394: Resin-based Composite - Posterior (1, 2, 3, 4+ surfaces)

4. MAJOR RESTORATIVE & PROSTHODONTICS:
   - D2740: Crown - Porcelain/Ceramic Substrate
   - D2750: Crown - Porcelain Fused to High Noble Metal
   - D2790: Crown - Full Cast High Noble Metal
   - D2920: Re-cement or re-bond crown
   - D2950: Core Buildup, including any pins
   - D2954: Prefabricated Post and Core in addition to crown
   - D6010: Surgical Placement of Implant Body: Endosteal Implant
   - D6058 / D6065: Implant Supported Crowns
   - D5110 / D5120: Complete Denture (Maxillary / Mandibular)
   - D5213 / D5214: Partial Denture (Maxillary / Mandibular)

5. ENDODONTICS:
   - D3310: Endodontic Therapy - Anterior Tooth (Excluding Final Restoration)
   - D3320: Endodontic Therapy - Premolar Tooth (Excluding Final Restoration)
   - D3330: Endodontic Therapy - Molar Tooth (Excluding Final Restoration)

6. ORAL SURGERY & ADJUNCTIVE:
   - D7140: Extraction, Erupted Tooth or Exposed Root
   - D7210: Extraction, Erupted Tooth Requiring Removal of Bone and/or Sectioning of Tooth
   - D7220 / D7230 / D7240: Impacted Tooth Extractions (Soft Tissue, Partially Bony, Completely Bony)
   - D9110: Palliative Emergency Treatment of Dental Pain - Minor Procedure
   - D9222 / D9223: Deep Sedation / General Anesthesia (15-minute increments)
   - D9944: Occlusal Guard (Night Guard) - Hard Appliance, Full Arch

7. ORTHODONTICS:
   - D8080: Comprehensive Orthodontic Treatment of the Adolescent Dentition
   - D8090: Comprehensive Orthodontic Treatment of the Adult Dentition
   - D8670: Periodic Orthodontic Treatment Visit

CRITICAL CLINICAL PROCEDURE SEQUENCE:
Audit the attached insurance breakdown sheet and extract the Procedure Table.
Strictly maintain the following sequence and exact order of procedure codes in the procedure_codes array:
1. D4346 (Scaling in presence of gingival inflammation)
2. D1110 (Prophy / Adult Cleaning)
3. D0274 (BTW / Bitewings)
4. D0210 / D0330 (FMX / Pano)
5. D0220 (PA's)
6. D9110 (Palliative)
7. D0120 (Exam / Periodic Oral Evaluation)
8. D0140 (Limited Exam)
9. D1351 (Sealant)
10. D1206 (Flouride)
11. D4341 (SRP)
12. D4910 (Perio Maint)
13. D2391 (Filling / Composite)
14. D2740 (Crown)
15. D2920 (Crown Recement)
16. D7140 (Simple ext)
17. D7210 (Surgical ext)
18. D9222 / D9223 (Sedation / Anesthesia)
19. D9944 (Night Guard)
20. D6010 (Implants)
21. Ortho (Orthodontics)

For each code in this exact order, strictly extract:
- Coverage Percentage
- Frequency Limitation (e.g. 2x1yr, 1x5yr, NF, 1X24m)
- History Date (or 'None')
- Eligible (true / false)
- Age Limit (if applicable, e.g. Sealant 15, Fluoride 18, NL)
- Deductible Applied (true / false)
- Downgrade Rule & Clinical Notes (e.g., Seat/Prep date, Quads per visit, Additional/Shared frequency)

Also extract any additional CDT procedure codes found in the breakdown sheet.
Return clean, structured JSON adhering strictly to the response schema.`;

// Endpoint to provide default prompts to the frontend settings modal
app.get('/api/prompts/default', (req, res) => {
  res.json({
    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
    customPrompt: DEFAULT_CDT_CODES_PROMPT,
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  });
});

// Verification Endpoint (Supports single or multiple files)
app.post('/api/verify', upload.array('files', 10), async (req, res) => {
  try {
    const uploadedFiles = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);

    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        error: 'No file uploaded. Please upload one or more PDF, PNG, JPG, or WEBP dental breakdown files.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please add your Gemini API key to the .env file.',
      });
    }

    const networkPreference = (req.body.network_preference || 'auto').toLowerCase();

    // Map network preference into clear instructions
    let networkInstruction = '';
    if (networkPreference === 'in_network') {
      networkInstruction =
        'CRITICAL NETWORK DIRECTIVE: The user explicitly requested IN-NETWORK tier benefits. ' +
        'If the document shows dual-column tables (In-Network vs Out-of-Network), you MUST strictly extract all coverage percentages, deductible amounts, annual maximums, and procedure code benefits from the IN-NETWORK column/tier. ' +
        'Set insurance_details.network_status to "In-Network".';
    } else if (networkPreference === 'out_network') {
      networkInstruction =
        'CRITICAL NETWORK DIRECTIVE: The user explicitly requested OUT-OF-NETWORK tier benefits. ' +
        'If the document shows dual-column tables (In-Network vs Out-of-Network), you MUST strictly extract all coverage percentages, deductible amounts, annual maximums, and procedure code benefits from the OUT-OF-NETWORK column/tier. ' +
        'Set insurance_details.network_status to "Out-of-Network".';
    } else {
      networkInstruction =
        'NETWORK DIRECTIVE: Auto-detect network status from the document. ' +
        'If both In-Network and Out-of-Network tiers are present and not specified, default to extracting In-Network benefits and note "In-Network" in network_status, unless only Out-of-Network benefits apply.';
    }

    // Support frontend prompt customization with fallback to defaults
    const systemInstruction = req.body.system_instruction && req.body.system_instruction.trim()
      ? req.body.system_instruction.trim()
      : DEFAULT_SYSTEM_INSTRUCTION;

    const basePrompt = req.body.custom_prompt && req.body.custom_prompt.trim()
      ? req.body.custom_prompt.trim()
      : DEFAULT_CDT_CODES_PROMPT;

    const multiFileNote = uploadedFiles.length > 1
      ? `\n\nNOTE ON MULTIPLE DOCUMENTS: The user has uploaded ${uploadedFiles.length} files/pages representing different pages or sections of the dental insurance breakdown or portal eligibility history. Cross-examine and synthesize information from ALL uploaded files to produce one unified, comprehensive audit output without omitting codes.`
      : '';

    const userPrompt = `${networkInstruction}${multiFileNote}\n\n${basePrompt}`;

    // Initialize Google Gen AI client
    const ai = new GoogleGenAI({ apiKey });

    // Format all uploaded files as inlineData parts for Gemini
    const fileContentParts = uploadedFiles.map((file) => {
      let mimeType = file.mimetype;
      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
      return {
        inlineData: {
          data: file.buffer.toString('base64'),
          mimeType: mimeType,
        },
      };
    });

    // Candidate models to try in priority order for resilience
    const candidateModels = [
      process.env.GEMINI_MODEL,
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
    ].filter(Boolean);
    const modelsToTry = [...new Set(candidateModels)];

    async function executeWithFallback() {
      let lastError;
      for (const currentModel of modelsToTry) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`[Gemini Request] Calling model: ${currentModel} (Attempt ${attempt}, Files: ${uploadedFiles.length})...`);
            const res = await ai.models.generateContent({
              model: currentModel,
              contents: [
                ...fileContentParts,
                {
                  text: userPrompt,
                },
              ],
              config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: dentalBreakdownSchema,
                temperature: 0.1,
              },
            });
            return { response: res, usedModel: currentModel };
          } catch (err) {
            lastError = err;
            const errMsg = (err.message || '').toLowerCase();
            const is503 = err.status === 503 || errMsg.includes('503') || errMsg.includes('high demand');
            if (is503) {
              console.warn(`[Gemini 503 Spike] Model ${currentModel} is experiencing high demand. Falling back to alternative model...`);
              break; // Try next model immediately
            }
            if (err.status === 429 && attempt < 2) {
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }
            throw err;
          }
        }
      }
      throw lastError;
    }

    const { response, usedModel } = await executeWithFallback();

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini model returned an empty response.');
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON output:', responseText);
      throw new Error('Failed to parse structured JSON from Gemini response.');
    }

    res.json({
      success: true,
      meta: {
        files: uploadedFiles.map(f => ({
          filename: f.originalname,
          fileSize: f.size,
          mimeType: f.mimetype,
        })),
        fileCount: uploadedFiles.length,
        network_preference: networkPreference,
        model: usedModel,
        analyzed_at: new Date().toISOString(),
      },
      data: parsedResult,
    });
  } catch (error) {
    console.error('Error during dental breakdown verification:', error);
    let userMessage = error.message || 'An unexpected error occurred during analysis.';
    
    // Human-friendly error translation for common Gemini API errors
    if (userMessage.includes('503') || userMessage.toLowerCase().includes('high demand')) {
      userMessage = 'Google Gemini API is currently experiencing a temporary high-demand spike. Please click "Analyze Breakdown" again in a few seconds.';
    } else if (userMessage.includes('429') || userMessage.toLowerCase().includes('quota') || userMessage.toLowerCase().includes('rate limit')) {
      userMessage = 'Gemini API rate limit reached. Please wait a moment before trying again.';
    } else if (userMessage.includes('API_KEY_INVALID') || userMessage.includes('403')) {
      userMessage = 'Invalid Gemini API key. Please check your GEMINI_API_KEY in the .env file.';
    }

    res.status(500).json({
      error: userMessage,
      details: error.status || error.code || null,
    });
  }
});

// Error handling middleware for Multer and unexpected errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File size exceeds maximum limit of 25MB.',
      });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Bad request.' });
  }
  next();
});

// Start Express server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Dental Insurance Verification Web App running!`);
  console.log(`Local URL: http://localhost:${PORT}`);
  console.log(`Domain:    https://iv.eonx.cz`);
  const activeModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  console.log(`Model:     ${activeModel} (Google Gen AI SDK)`);
  console.log(`====================================================`);
});
