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
          description: 'Patient Full Name if found on the document (e.g. John Doe). Omit SSN, DOB, or other sensitive IDs.',
          nullable: true,
        },
        carrier: {
          type: Type.STRING,
          description: 'Dental Insurance Carrier Name (e.g. Delta Dental, MetLife, Cigna, Guardian)',
        },
        effective_date: {
          type: Type.STRING,
          description: 'Policy effective date or coverage benefit period',
        },
        network_status: {
          type: Type.STRING,
          description: 'Network status detected (e.g., In-Network, Out-of-Network, PPO, Premier)',
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
          description: 'Major coverage % (e.g., 50%, 0%)',
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
        waiting_period_details: {
          type: Type.STRING,
          description: 'Waiting period details (e.g. Basic 6mo Major 12mo, None, No)',
          nullable: true,
        },
        ortho: {
          type: Type.STRING,
          description: 'Orthodontics coverage % (e.g., 50%, Not Covered, 0%)',
        },
        ortho_max: {
          type: Type.STRING,
          description: 'Orthodontic lifetime maximum benefit (e.g., $1000, $1500, N/A)',
        },
        ortho_age_limit: {
          type: Type.STRING,
          description: 'Orthodontic age limitation (e.g., Up to age 19, Adult & Child, None, NL)',
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
            description: 'CDT procedure code (e.g., D0120, D0140, D0150, D1110, D4346, D0274, D0210, D0330, D0220, D1206, D1351, D4341, D4910, D2391, D2740, D2920, D7140, D7210, D9110, D9944)',
          },
          description: {
            type: Type.STRING,
            description: 'Standard CDT nomenclature or breakdown description',
          },
          coverage_percentage: {
            type: Type.STRING,
            description: 'Coverage percentage (e.g., 100%, 80%, 50%, 0% if NC)',
          },
          deductible_applied: {
            type: Type.BOOLEAN,
            description: 'Whether deductible applies to this procedure code',
            nullable: true,
          },
          frequency_limitation: {
            type: Type.STRING,
            description: 'Frequency limitation rule (e.g., 1 in 150 days, 2 per benefit year, 1 in 36 months, 1/LT, NF)',
          },
          age_limit: {
            type: Type.STRING,
            description: 'Age limit (e.g., Under 14, Under 19, No limit, None)',
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
            description: 'Downgrade rule (e.g., Downgraded to Amalgam on posterior, None)',
          },
          notes: {
            type: Type.STRING,
            description: 'Clinical / Billing limitation notes (e.g., Shared freq with D1110, Seat date used, All quads per visit)',
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
const DEFAULT_SYSTEM_INSTRUCTION = `You are an expert dental revenue cycle management (RCM) billing auditor and clinical dental insurance verification specialist.
Your mission is to audit dental breakdown sheets, fee schedules, or insurance web portal eligibility screenshots and extract 100% accurate benefit calculations.

CORE RULES:
1. Patient Identification: Extract the Patient's Name if clearly present on the breakdown document into insurance_details.patient_name. PRIVACY MANDATE: Strictly DO NOT extract, store, or output Date of Birth (DOB), Social Security Number (SSN), or Member ID numbers to ensure high data privacy.
2. Network Prioritization: If the user specifies a network tier (In-Network or Out-of-Network), strictly extract benefits for that tier. If dual-column tables exist, prioritize that tier.
3. Benefit Categories: Accurately extract coverage levels: Preventative (%), Basic (%), Major (%), ENDO (%), ORAL SURGERY (%), and IMPLANTS D6010 (coverage % or 'NC' if not covered).
4. Clauses & Limitations: Clearly note Missing Tooth Clause (true if Yes, false if No) and Waiting Periods (true if Yes, false if No, with details like 'Basic 6mo Major 12mo' in coverage_levels.waiting_period_details).
5. Exhaustive Procedure Extraction: Search thoroughly for all listed CDT codes across Diagnostic, Preventive, Periodontics, Restorative, Major Prosthodontics, Endodontics, Oral Surgery, Adjunctive, and Orthodontics.
6. Frequency & Sharing: Accurately capture frequency rules (e.g., 2 in 12 rolling months, 1 in 150 days, 1 in 36m, 1/LT, NF / No Frequency) and shared frequencies (e.g., D4346 shared with D1110; D0330 shared with D0210).
7. Not Covered (NC): If a code or service is excluded or marked Not Covered, set coverage_percentage to '0%' or 'NC' and is_eligible to false.
8. History & Downgrades: Extract last service/claim dates (write 'None' if none). Note amalgam downgrades on posterior composites (D2391-D2394), prep or seat dates on crowns, and missing tooth clauses.`;

const DEFAULT_CDT_CODES_PROMPT = `Carefully audit the attached dental insurance breakdown document.
Extract all insurance financials, coverage percentage tiers, and procedure code benefits.

YOU MUST SPECIFICALLY AUDIT AND EXTRACT THE FOLLOWING REQUIRED CDT PROCEDURES IF PRESENT OR COVERED:

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
