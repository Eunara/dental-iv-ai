require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenAI, Type } = require('@google/genai');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'f9f25bef7e2851f7f9e4860182e5d2138931b1d42d7fbf34430115661edc656a';

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
app.use(cookieParser());

// Auth Extraction Middleware (Attaches req.user if valid token provided)
const authMiddleware = async (req, res, next) => {
  let token = req.cookies?.dentverify_token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userRes = await db.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.practice_id, p.name as practice_name 
       FROM dentverify.users u 
       JOIN dentverify.practices p ON u.practice_id = p.id 
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );
    if (userRes.rows.length > 0) {
      req.user = userRes.rows[0];
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  next();
};
app.use(authMiddleware);

// HIPAA Audit Logging Helper
async function recordAuditLog(req, action, targetId = null, metadata = {}) {
  try {
    const userId = req.user?.id || null;
    const practiceId = req.user?.practice_id || null;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    await db.query(
      `INSERT INTO dentverify.audit_logs (practice_id, user_id, action, target_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [practiceId, userId, action, targetId, String(ip).slice(0, 45), userAgent, metadata]
    );
  } catch (err) {
    console.error('Audit logging error:', err);
  }
}

// Rate Limiter for Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Strict Response Schema for Gemini
const dentalBreakdownSchema = {
  type: Type.OBJECT,
  properties: {
    insurance_details: {
      type: Type.OBJECT,
      properties: {
        patient_name: {
          type: Type.STRING,
          description: 'Patient Full Name if found on the document (e.g. Katherine Birdwell). Omit SSN or subscriber ID.',
          nullable: true,
        },
        dob: {
          type: Type.STRING,
          description: 'Patient Date of Birth if found on the document (e.g. 05/14/1990, None, N/A)',
          nullable: true,
        },
        carrier: {
          type: Type.STRING,
          description: 'Dental Insurance Company / Carrier Name (e.g. METLIFE, Delta Dental, Ameritas, Cigna, Guardian, Blue Cross Blue Shield).',
        },
        insurance_address: {
          type: Type.STRING,
          description: 'Dental Insurance Claims Mailing Address if found on the document (e.g. P.O. Box 981282 El Paso, TX - 79998, N/A if not found)',
          nullable: true,
        },
        insurance_phone: {
          type: Type.STRING,
          description: 'Dental Insurance Phone Number (e.g. (877) 638-3379, N/A if not found)',
          nullable: true,
        },
        payor_id: {
          type: Type.STRING,
          description: 'Electronic Claims Payor ID if found on the document (e.g. 65978, N/A if not found)',
          nullable: true,
        },
        group_name: {
          type: Type.STRING,
          description: 'Employer Name or Group Policy Name if found on the document (e.g. American Airlines, Boeing, Acme Corp, N/A if not found). Return N/A if not found.',
          nullable: true,
        },
        plan_name: {
          type: Type.STRING,
          description: 'Specific Dental Plan Name or Product Name (e.g. SoundCare, Classic PPO, High Option, N/A). Return N/A if not found.',
          nullable: true,
        },
        group_number: {
          type: Type.STRING,
          description: 'Group Policy Number if found on the document (e.g. 316130, N/A if not found)',
          nullable: true,
        },
        effective_date: {
          type: Type.STRING,
          description: 'Policy effective date or coverage benefit period (e.g. 01/01/2026)',
        },
        termed_date: {
          type: Type.STRING,
          description: 'Termination or termed date if policy is terminated, or "None" / "Active" if coverage is currently active',
          nullable: true,
        },
        policy_status: {
          type: Type.STRING,
          description: 'Active or Termed status (e.g. Active, Termed / Inactive)',
          nullable: true,
        },
        network_status: {
          type: Type.STRING,
          description: 'Network status detected (e.g., In-Network, Out-of-Network, PPO, Premier)',
        },
        plan_benefits: {
          type: Type.STRING,
          description: 'Plan benefits period or type (e.g. Calendar Year, Contract Year, Fiscal Year)',
          nullable: true,
        },
        fee_schedule: {
          type: Type.STRING,
          description: 'Fee Schedule or network tier (e.g. Delta Dental PPO, Standard Fee, UCR)',
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
          description: 'Orthodontic age limitation (e.g., NL, No Limit, 14 Maximum, Up to age 19)',
        },
        ortho_remaining: {
          type: Type.STRING,
          description: 'Orthodontic remaining benefit balance (e.g., $1,000, $2,000, N/A)',
          nullable: true,
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
            description: 'Standard short frequency limitation rule (e.g., 2x1yr for 2 per calendar year, 2x12m for 2 in 12 rolling months, 1x1yr, 1x5yr, 1x24m, NF for no frequency, 1/LT for lifetime). MUST format long descriptions into compact notations like 2x1yr or 2x12m.',
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
1. STRICT HIPAA & PRIVACY DIRECTIVES
==================================================
- Transient Processing: Process the uploaded document purely in memory. Never store, log, or persist data.
- Necessary Policy Identifiers: Extract Patient / Subscriber Name, DOB, Employer Name / Group Name, Group Number, Insurance Company Name, Insurance Claims Address, Phone, Payor ID, Effective Date, and Termed Date solely for clinical policy verification and claims filing.
- Strict PII Exclusions: Strictly omit SSN, member/subscriber ID numbers, patient personal street addresses, or payment card numbers. (Note: Claims mailing address of the insurance company itself is standard institutional data and MUST be captured).
- Scope: Restrict all extraction strictly to policy details, financial rules, network tiers, CDT codes, coverage percentages, frequencies, and clinical history dates.

==================================================
2. CORE AUDITING & CALCULATION RULES
==================================================
1. Network Prioritization & Tiering:
   - If a network tier (In-Network or Out-of-Network) is specified by the user or document, strictly extract benefit percentages, maximums, and deductibles for that selected tier.
   - If dual-column tables (In-Net vs Out-of-Net) exist and no preference is specified, prioritize In-Network while noting Out-of-Network variations in the notes.

2. Policy, Carrier, Claims Address, Employer/Group & Termed Date Validation:
   - Extract Dental Insurance Company / Carrier Name accurately (Ins Company, e.g. METLIFE, Delta Dental, Ameritas, Cigna, Guardian, Blue Cross Blue Shield).
   - Extract Insurance Claims Mailing Address (Ins Address, e.g. P.O. Box 981282 El Paso, TX - 79998). If not found, return "N/A".
   - Extract Insurance Phone Number (Ins Ph #, e.g. (877) 638-3379) and Electronic Payor ID (PayorID). If not found, return "N/A".
   - Extract Employer Name / Group Name (e.g. American Airlines, Boeing). If labeled as "Employer Name" or "Group Name", map to group_name. If not found, strictly return "N/A". Never invent dummy names (e.g. Acme Corp).
   - Extract Group Policy Number (Group #, e.g. 316130). If not found, return "N/A".
   - Extract Effective Date and Termed Date (Termination Date).
   - If a Termed Date exists and is on or before the current date, set policy_status to "Termed / Inactive".
   - If no termed date exists or it is in the future, set policy_status to "Active".
   - Do NOT extract or include secondary insurance.

3. Financials & Deductible Allocation:
   - Accurately parse Annual Maximum, Remaining Maximum, Individual Deductible, and Remaining Deductible.
   - Explicitly verify whether Deductible applies to Preventive/Diagnostic (e.g., "Preventive Ded Applied: No").
   - Explicitly verify if Preventive services count toward the Annual Maximum (e.g., "Preventive applies to Max: No").
   - Check and flag Missing Tooth Clauses (MTC) and Waiting Periods (flag 'None' or 'No' if waived or not applicable, e.g. "Basic 6mo Major 12").

4. Frequency, Calendar Year Resets, & Shared Rules:
   - MANDATORY SHORT FREQUENCY NOTATION FORMATTING:
     You MUST standardize and abbreviate all long frequency sentences into concise clinical dental breakdown notation:
     * "two of any ... within a calendar year" -> "2x1yr"
     * "two of any ... within a 12 months" or "2 in 12 months" -> "2x12m"
     * "one of any ... within a calendar year" -> "1x1yr"
     * "one of any ... within a 12 months" -> "1x12m"
     * "two per year" or "twice a year" -> "2x1yr"
     * "once every 5 years" or "1 in 60 months" -> "1x5yr" (or "1x60m")
     * "once every 3 years" or "1 in 36 months" -> "1x3yr" (or "1x36m")
     * "once every 2 years" or "1 in 24 months" -> "1x24m"
     * "no frequency limit", "no limitation", "unlimited" -> "NF"
     * "once per lifetime", "1 per lifetime", "lifetime limit" -> "1/LT"
     * "1 per tooth lifetime" -> "1/tooth LT"
     Never output long paragraphs or redundant code enumerations in the frequency_limitation column. Keep it clean and short like "2x1yr" or "2x12m". Put extra procedure references or details in the "notes" column if needed.
   - Calendar Year vs Rolling Months:
     * When plan is "Calendar Year" (or frequency is 2x1yr, 1x1yr): Benefits and procedure counts reset on January 1 of each calendar year. If a patient's last service date was in a prior calendar year (e.g., last exam was 10/25/2025 and current year is 2026), the patient IS ELIGIBLE (is_eligible: true).
     * When frequency is rolling months (e.g., 2x12m): A rolling 12-month window applies from the previous service date. If only 1 procedure was used within the last 12 months, 1 procedure remains available.
   - MANDATORY D0210 & D0330 SHARED FREQUENCY & ELIGIBILITY:
     * D0210 (Full Mouth Series / FMX) and D0330 (Panoramic Image / Pano) ALWAYS share frequency limitations (typically 1 in 36 or 60 months / 5 years).
     * Cross-Code History: If a history date exists on EITHER D0210 OR D0330, apply that history date to BOTH codes mutually.
     * If frequency period has NOT elapsed from the history date, BOTH D0210 and D0330 must be marked is_eligible: false, with the next eligible date stated in notes.
     * If frequency period has elapsed or history is "None", mark is_eligible: true.
   - Detect other shared frequencies (e.g., D4346 shared with D1110).
   - Identify quadrant limitations for Periodontics (e.g., SRP max 2 quads per visit vs all quads allowed).

5. Age Limitations (Minimum vs Maximum Age Thresholds):
   - MINIMUM AGE LIMITATIONS (Adult Procedures e.g. D1110 Adult Prophy, D4346 Gingival Scaling):
     * When age limit is specified as "14 and over", "14+", "14 & older", or "min 14", this is a MINIMUM age threshold: The patient must be at least that age to qualify.
     * If patient age is greater than or equal to this minimum (e.g., patient is 27 years old, which is >= 14), the patient IS FULLY ELIGIBLE (is_eligible: true). They are NOT ineligible!
     * Only mark is_eligible: false if patient age is strictly less than the minimum age threshold (e.g. a child under 14).
   - MAXIMUM AGE LIMITATIONS (Pediatric / Youth Procedures e.g. D1206 Fluoride, D1351 Sealants, D1120 Child Prophy, Orthodontics):
     * When age limit is specified as "Through age 14", "Under 19", "Through age 18", or "Up to 14", this is a MAXIMUM age limit: The patient must NOT exceed this age.
     * If patient age strictly exceeds this maximum limit (e.g. 27 > 14 for Sealants or Fluoride), mark is_eligible: false and state in notes: "Ineligible: Patient age (27) exceeds plan age limit (14)".

6. Exclusions & Not Covered (NC):
   - If a code or service is marked as Not Covered (NC) or excluded by the plan (e.g., Adult Fluoride D1206 NC, Crown Recement D2920 NC, Night Guard D9944 NC, Implants D6010 NC):
     * Set coverage_percentage to "0%" or "NC"
     * Set is_eligible to false
     * Add "Not Covered by Plan" or "NC" in notes.

7. Clinical History & Downgrades:
   - Extract exact previous claim/service dates for history. If no history is recorded, write "None".
   - Restorative Downgrades: Explicitly check if posterior composite fillings (D2391–D2394) are downgraded to amalgam allowances.
   - Crown Limitations: Note if replacement frequency applies to prep date or seat date (e.g., "Seat", "1 in 60 months from seat date").

==================================================
3. OUTPUT FORMAT
==================================================
Return output strictly in the pre-configured JSON schema. Do not output conversational explanations or markdown text outside the JSON.`;

const DEFAULT_CDT_CODES_PROMPT = `Carefully audit the attached dental insurance breakdown document or portal screenshot.
Extract all insurance financials, coverage percentage tiers, patient/policy details, and procedure code benefits based on the selected network tier.

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
   - D1206: Topical Application of Fluoride Varnish (Check age limit, e.g. age 18)
   - D1208: Topical Application of Fluoride - Excluding Varnish
   - D1351: Sealant - Per Tooth (Check age limit, e.g. age 14 or 15)

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

CRITICAL CLINICAL PROCEDURE SEQUENCE BY CATEGORIES:
Audit the attached insurance breakdown sheet and extract the Procedure Table.
Strictly capture Orthodontic terms in the header (Ortho Lifetime Max, Remaining Ortho, Ortho Coverage %, and Ortho Age Limit).
Strictly maintain the following sequence and exact order of procedure codes in the procedure_codes array:

CATEGORY 1: PREVENTATIVE
1. D4346 (Scaling in presence of gingival inflammation)
2. D1110 (Prophy / Adult Cleaning)
3. D0274 (BTW / Bitewings)
4. D0210 / D0330 (FMX / Pano) - MANDATORY: D0210 and D0330 ALWAYS share frequency (e.g., 1x5yr, 1 in 36m, or 1 in 60m). If either code has a previous service date, apply it to BOTH and calculate if the frequency period has elapsed. If not elapsed, mark is_eligible: false and state the next eligible date in notes.
5. D0220 (PA's)
6. D9110 (Palliative)
7. D0120 (Exam / Periodic Oral Evaluation) - Check Calendar Year reset (e.g. 2x1yr resets on Jan 1)
8. D0140 (Limited Exam)
9. D1351 (Sealant) - Ineligible if patient age exceeds plan age limit (e.g., 14 or 15)
10. D1206 (Flouride) - Ineligible if patient age exceeds plan age limit (e.g., 18 or 19)

CATEGORY 2: PERIODONTAL
11. D4341 (SRP)
12. D4910 (Perio Maint)

CATEGORY 3: RESTORATIVE (D2391 is the only code for restorative)
13. D2391 (Filling / Composite)

CATEGORY 4: MAJOR
14. D2740 (Crown)
15. D2920 (Crown Recement)
16. D7140 (Simple ext)
17. D7210 (Surgical ext)
18. D9222 / D9223 (Sedation / Anesthesia)
19. D9944 (Night Guard)
20. D6010 (Implants, if present)

For each code in this exact order, strictly extract:
- Coverage Percentage
- Frequency Limitation (e.g. 2x1yr, 1x5yr, NF, 1X24m, 2x12m)
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

// ==========================================
// DATE & ELIGIBILITY UTILITY FUNCTIONS
// ==========================================

// Helper: parse date from various string formats (MM/DD/YYYY, YYYY-MM-DD, MM/YYYY, etc.)
function parseDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (/^(none|no|n\/a|na|history|null|undefined|-)$/i.test(s)) return null;

  // MM/DD/YYYY or M/D/YYYY
  const mdy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (mdy) {
    const m = parseInt(mdy[1], 10) - 1;
    const d = parseInt(mdy[2], 10);
    let y = parseInt(mdy[3], 10);
    if (y < 100) y += 2000;
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // YYYY-MM-DD
  const ymd = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10) - 1;
    const d = parseInt(ymd[3], 10);
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // MM/YYYY or M/YYYY
  const my = s.match(/^(\d{1,2})[\/\-\.](\d{2,4})$/);
  if (my) {
    const m = parseInt(my[1], 10) - 1;
    let y = parseInt(my[2], 10);
    if (y < 100) y += 2000;
    const dt = new Date(y, m, 1);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }
  return null;
}

function formatDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// Helper: standardizes long frequency sentences into concise clinical dental notation
function formatFrequencyNotation(freqStr) {
  if (!freqStr) return '-';
  const raw = String(freqStr).trim();
  const s = raw.toLowerCase();

  // If already standard compact notation (e.g. 2x1yr, 2x12m, 1x5yr, 1x24m, NF, 1/LT)
  if (/^\d+x\d+(?:yr|y|m|mo)$/i.test(raw) || /^(nf|none|n\/a|1\/lt|1\/tooth lt)$/i.test(raw)) {
    return raw;
  }

  // Check for "no frequency" / "unlimited"
  if (/no\s*frequency|unlimited|none|no\s*limit/i.test(s)) {
    return 'NF';
  }

  // Lifetime
  if (/lifetime/i.test(s)) {
    if (/tooth/i.test(s)) return '1/tooth LT';
    return '1/LT';
  }

  // Count determination (e.g. two / twice / 2 vs one / once / 1 vs 4 vs 3)
  let count = 1;
  if (/two|twice|\b2\b/i.test(s)) {
    count = 2;
  } else if (/four|\b4\b/i.test(s)) {
    count = 4;
  } else if (/three|\b3\b/i.test(s)) {
    count = 3;
  } else if (/one|once|\b1\b/i.test(s)) {
    count = 1;
  }

  // Period determination: Calendar year vs rolling months vs years
  if (/calendar\s*year/i.test(s)) {
    return `${count}x1yr`;
  }

  // Months pattern (e.g. "within 12 months", "in 12 months", "12m", "24m", "60 months", "36 months")
  const mMatch = s.match(/(\d+)\s*(?:m|mo|mos|month|months)\b/);
  if (mMatch) {
    const months = parseInt(mMatch[1], 10);
    if (months === 12) {
      return `${count}x12m`;
    }
    if (months === 24) {
      return `${count}x24m`;
    }
    if (months === 36) {
      return `${count}x36m`;
    }
    if (months === 60) {
      return `${count}x5yr`;
    }
    return `${count}x${months}m`;
  }

  // Years pattern (e.g. "within 1 year", "per year", "every 5 years", "in 3 years")
  const yMatch = s.match(/(\d+)\s*(?:y|yr|yrs|year|years)\b/);
  if (yMatch) {
    const years = parseInt(yMatch[1], 10);
    return `${count}x${years}yr`;
  }

  if (/per\s*year|a\s*year|every\s*year|annual/i.test(s)) {
    return `${count}x1yr`;
  }

  // If already relatively short (<= 12 chars), return cleaned string
  if (raw.length <= 12) {
    return raw;
  }

  // Fallback: if long sentence has calendar, return 2x1yr / 1x1yr
  if (/calendar/i.test(s)) return `${count}x1yr`;
  if (/12\s*m/i.test(s)) return `${count}x12m`;

  return raw;
}

// Helper: parse frequency months (default 60 months / 5 years)
function parseFrequencyMonths(freqStr) {
  if (!freqStr) return 60;
  const str = String(freqStr).toLowerCase();

  // Months: "60 months", "1 in 36m", "36mo", "24m"
  const mMatch = str.match(/(\d+)\s*(?:m|mo|mos|month|months)\b/);
  if (mMatch) {
    const m = parseInt(mMatch[1], 10);
    if (m > 0) return m;
  }

  // Years: "1x5yr", "1 in 5 years", "3 years", "1/5yr", "5y"
  const yMatch = str.match(/(\d+)\s*(?:y|yr|yrs|year|years)\b/);
  if (yMatch) {
    const y = parseInt(yMatch[1], 10);
    if (y > 0) return y * 12;
  }

  // Generic "1 in 60" or "1/36"
  const numMatch = str.match(/1\s*(?:in|\/|x)\s*(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 12) return n;
    if (n > 0 && n <= 10) return n * 12;
  }

  return 60;
}

// Helper: calculate patient age in years as of a specific date
function calculateAge(dobStr, asOfDate = new Date()) {
  const birthDate = parseDate(dobStr);
  if (!birthDate) return null;
  let age = asOfDate.getFullYear() - birthDate.getFullYear();
  const m = asOfDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && asOfDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

// ==========================================
// 1. POLICY TERMED DATE & STATUS VALIDATOR
// ==========================================
/**
 * Evaluates policy termed_date against the current verification date.
 * If termed_date is in the past, marks policy_status = "Termed / Inactive".
 * Otherwise marks policy_status = "Active".
 */
function enforcePolicyTermedRules(insuranceDetails) {
  if (!insuranceDetails) return insuranceDetails;
  const termedStr = String(insuranceDetails.termed_date || '').trim();
  const today = new Date();

  if (!termedStr || /^(none|active|n\/a|na|-)$/i.test(termedStr)) {
    insuranceDetails.policy_status = 'Active';
    insuranceDetails.termed_date = insuranceDetails.termed_date || 'Active (None)';
    return insuranceDetails;
  }

  const termedDt = parseDate(termedStr);
  if (termedDt) {
    const endOfTermedDay = new Date(termedDt.getFullYear(), termedDt.getMonth(), termedDt.getDate(), 23, 59, 59);
    if (today > endOfTermedDay) {
      insuranceDetails.policy_status = 'Termed / Inactive';
    } else {
      insuranceDetails.policy_status = 'Active';
    }
  } else if (/term/i.test(termedStr) || /inact/i.test(termedStr)) {
    insuranceDetails.policy_status = 'Termed / Inactive';
  } else {
    insuranceDetails.policy_status = 'Active';
  }
  return insuranceDetails;
}

// ==========================================
// 2. AGE LIMIT & CALENDAR YEAR FREQUENCY VALIDATOR
// ==========================================
/**
 * Dental RCM Policy Rules:
 * - Age Limits (D1206 Fluoride, D1351 Sealants, Ortho):
 *   If patient's age > plan's maximum age limit, patient is marked is_eligible: false.
 * - Calendar Year vs Rolling Months:
 *   If plan is Calendar Year (or freq is 2x1yr, 1x1yr), benefits reset on Jan 1.
 *   Prior-year history dates (e.g. 10/25/2025 vs current 2026) are ELIGIBLE.
 *   If frequency is rolling (2x12m), 12-month rolling window applies.
 */
function enforceAgeLimitAndFrequencyRules(procedureCodes, insuranceDetails = {}) {
  if (!Array.isArray(procedureCodes) || procedureCodes.length === 0) {
    return procedureCodes;
  }

  const patientDob = insuranceDetails.dob || '';
  const patientAge = calculateAge(patientDob);
  const planBenefits = String(insuranceDetails.plan_benefits || '').toLowerCase();
  const isCalendarYearPlan = planBenefits.includes('calendar') || !planBenefits.includes('contract');
  const today = new Date();
  const currentYear = today.getFullYear();

  procedureCodes.forEach(item => {
    if (!item) return;
    const code = String(item.code || '').toUpperCase();
    const ageLimStr = String(item.age_limit || '').trim();
    const freqStr = String(item.frequency_limitation || '').trim().toLowerCase();
    const histStr = String(item.history_dates || '').trim();

    // 1. AGE LIMITATION CHECK (Minimum vs Maximum Age Thresholds)
    if (patientAge !== null && ageLimStr && !/^(none|nl|no limit|n\/a|-)$/i.test(ageLimStr)) {
      const match = ageLimStr.match(/(\d+)/);
      if (match) {
        const targetAge = parseInt(match[1], 10);

        const hasMinKeywords = /(and\s*over|and\s*older|&\s*over|&\s*older|\+|and\s*up|or\s*older|or\s*over|min\b|minimum|>=|>|over)/i.test(ageLimStr);
        const isAdultCode = code.includes('D1110') || code.includes('D4346');
        const hasMaxKeywords = /(under|through|up\s*to|to\s*age|and\s*under|&\s*under|or\s*younger|max\b|maximum|<=|<)/i.test(ageLimStr);

        const isMinAge = hasMinKeywords || (isAdultCode && !hasMaxKeywords);

        if (isMinAge) {
          // Minimum Age Requirement (e.g. D1110, D4346: 14 and over)
          if (patientAge < targetAge) {
            item.is_eligible = false;
            const ageNote = `Ineligible: Patient age (${patientAge}) is below plan minimum age requirement (${targetAge})`;
            if (!item.notes || !item.notes.includes('below plan minimum age')) {
              item.notes = item.notes ? `${item.notes} • ${ageNote}` : ageNote;
            }
          } else {
            // Patient meets or exceeds minimum age (e.g. 27 >= 14 -> ELIGIBLE!)
            if (item.notes && item.notes.includes('exceeds plan age limit')) {
              item.notes = item.notes
                .replace(/\s*•\s*Ineligible:\s*Patient age \(\d+\) exceeds plan age limit \(\d+\)/gi, '')
                .replace(/Ineligible:\s*Patient age \(\d+\) exceeds plan age limit \(\d+\)\s*•\s*/gi, '')
                .replace(/Ineligible:\s*Patient age \(\d+\) exceeds plan age limit \(\d+\)/gi, '')
                .trim();
            }
            if (!histStr || /^(none|n\/a|-)$/i.test(histStr)) {
              item.is_eligible = true;
            }
          }
        } else {
          // Maximum Age Limitation (e.g. D1206 Fluoride, D1351 Sealants, Ortho, D1120 Child Prophy)
          const isStrictlyUnder = /under\s*\d+|<\s*\d+/i.test(ageLimStr);
          const exceedsMax = isStrictlyUnder ? (patientAge >= targetAge) : (patientAge > targetAge);

          if (exceedsMax) {
            item.is_eligible = false;
            const ageNote = `Ineligible: Patient age (${patientAge}) exceeds plan age limit (${targetAge})`;
            if (!item.notes || !item.notes.includes('exceeds plan age limit')) {
              item.notes = item.notes ? `${item.notes} • ${ageNote}` : ageNote;
            }
          }
        }
      }
    }

    // Skip D0210/D0330 as it has its own shared handler
    if (code.includes('D0210') || code.includes('D0330')) {
      return;
    }

    // 2. CALENDAR YEAR VS ROLLING MONTHS FREQUENCY LOGIC
    const histDate = parseDate(histStr);
    if (histDate) {
      const isYearlyFreq = /2x1yr|1x1yr|2xyr|1xyr|2\s*in\s*1\s*year|1\s*in\s*1\s*year|calendar/i.test(freqStr);
      const isRollingFreq = /2x12m|1x12m|12\s*m|12\s*mo|rolling/i.test(freqStr);

      if (isCalendarYearPlan && isYearlyFreq) {
        // Calendar Year basis: resets on January 1st!
        if (histDate.getFullYear() < currentYear) {
          item.is_eligible = true;
          const resetNote = `Eligible (Benefit reset for Calendar Year ${currentYear}; Last service: ${formatDate(histDate)})`;
          if (!item.notes || !item.notes.includes('Calendar Year')) {
            item.notes = item.notes ? `${item.notes} • ${resetNote}` : resetNote;
          }
        }
      } else if (isRollingFreq) {
        const twelveMonthsAgo = new Date(today);
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        if (histDate >= twelveMonthsAgo) {
          if (/2x12m|2\s*in\s*12/i.test(freqStr)) {
            item.is_eligible = true;
            const rollNote = `Eligible: 1 of 2 procedures remaining in rolling 12m (Last service: ${formatDate(histDate)})`;
            if (!item.notes || !item.notes.includes('rolling 12m')) {
              item.notes = item.notes ? `${item.notes} • ${rollNote}` : rollNote;
            }
          }
        }
      }
    }

    // 3. MANDATORY COMPACT FREQUENCY STRING NORMALIZATION
    if (item.frequency_limitation) {
      item.frequency_limitation = formatFrequencyNotation(item.frequency_limitation);
    }
  });

  return procedureCodes;
}

// ==========================================
// 3. D0210 & D0330 SHARED FREQUENCY & ELIGIBILITY VALIDATOR
// ==========================================
/**
 * Dental RCM Policy Rule:
 * CDT codes D0210 (Full Mouth Series / FMX) and D0330 (Panoramic Image / Pano)
 * ALWAYS share the same frequency limitation (typically 1 in 36 or 60 months / 5 years).
 * If a previous service history date exists on EITHER code, that history applies
 * to BOTH codes mutually. Validates against the frequency limitation to determine
 * whether patient is currently eligible or ineligible, computing the next eligible date.
 */
function enforceSharedFmxPanoRules(procedureCodes) {
  if (!Array.isArray(procedureCodes) || procedureCodes.length === 0) {
    return procedureCodes;
  }

  // 1. Identify all items matching D0210 or D0330
  const fmxPanoItems = procedureCodes.filter(item => {
    if (!item) return false;
    const code = String(item.code || '').toUpperCase();
    const desc = String(item.description || '').toLowerCase();
    return (
      code.includes('D0210') ||
      code.includes('D0330') ||
      desc.includes('fmx') ||
      desc.includes('pano') ||
      desc.includes('panoramic') ||
      desc.includes('complete series') ||
      desc.includes('intraoral - comprehensive series')
    );
  });

  if (fmxPanoItems.length === 0) {
    return procedureCodes;
  }

  // 2. Extract shared frequency text
  let sharedFreqText = '';
  let foundFreqMonths = null;

  for (const item of fmxPanoItems) {
    const freq = String(item.frequency_limitation || '').trim();
    if (freq && !/^(nf|none|no|n\/a|-)$/i.test(freq)) {
      sharedFreqText = freq;
      foundFreqMonths = parseFrequencyMonths(freq);
      break;
    }
  }

  if (!sharedFreqText) {
    sharedFreqText = '1x5yr';
    foundFreqMonths = 60;
  }
  const frequencyMonths = foundFreqMonths || 60;

  // 3. Find latest history date among all FMX/Pano items
  let latestHistoryDate = null;
  let rawHistoryStr = 'None';

  for (const item of fmxPanoItems) {
    const histStr = String(item.history_dates || '').trim();
    const parsed = parseDate(histStr);
    if (parsed) {
      if (!latestHistoryDate || parsed > latestHistoryDate) {
        latestHistoryDate = parsed;
        rawHistoryStr = histStr;
      }
    }
  }

  const today = new Date();
  let isEligible = true;
  let nextEligibleDate = null;
  let formattedNextDate = '';
  let formattedHistDate = '';

  if (latestHistoryDate) {
    formattedHistDate = formatDate(latestHistoryDate);
    nextEligibleDate = new Date(latestHistoryDate.getTime());
    nextEligibleDate.setMonth(nextEligibleDate.getMonth() + frequencyMonths);
    formattedNextDate = formatDate(nextEligibleDate);

    // If today is before next eligible date, patient is strictly NOT eligible
    if (today < nextEligibleDate) {
      isEligible = false;
    } else {
      isEligible = true;
    }
  }

  // 4. Synchronize each matching item with validated shared values
  fmxPanoItems.forEach(item => {
    const codeUpper = String(item.code || '').toUpperCase();
    const isCombo = codeUpper.includes('D0210') && codeUpper.includes('D0330');
    const isFmxOnly = codeUpper.includes('D0210') && !codeUpper.includes('D0330');
    const isPanoOnly = codeUpper.includes('D0330') && !codeUpper.includes('D0210');

    // Build shared frequency label
    let sharedFreqLabel = sharedFreqText;
    if (!sharedFreqLabel.toLowerCase().includes('shared')) {
      if (isCombo) {
        sharedFreqLabel = `${sharedFreqLabel} (Shared D0210/D0330)`;
      } else if (isFmxOnly) {
        sharedFreqLabel = `${sharedFreqLabel} (Shared w/ D0330)`;
      } else if (isPanoOnly) {
        sharedFreqLabel = `${sharedFreqLabel} (Shared w/ D0210)`;
      } else {
        sharedFreqLabel = `${sharedFreqLabel} (Shared)`;
      }
    }
    item.frequency_limitation = sharedFreqLabel;

    // Check if not covered
    const covStr = String(item.coverage_percentage || '').trim().toUpperCase();
    const isCoveredBenefit = covStr !== '0%' && covStr !== 'NC' && !covStr.includes('NOT COVERED');

    if (!isCoveredBenefit) {
      item.is_eligible = false;
      item.notes = item.notes ? `${item.notes} • Not Covered` : 'Not Covered by Plan';
      return;
    }

    if (latestHistoryDate) {
      item.history_dates = formattedHistDate;
      item.is_eligible = isEligible;

      const partnerNote = isCombo
        ? 'Shared freq D0210 & D0330'
        : (isFmxOnly ? 'Shared freq with D0330 Pano' : 'Shared freq with D0210 FMX');

      if (!isEligible) {
        item.notes = `${partnerNote} • Ineligible until ${formattedNextDate} (Last: ${formattedHistDate}, Freq: ${sharedFreqText})`;
      } else {
        item.notes = `${partnerNote} • Eligible (Frequency satisfied: Last service ${formattedHistDate})`;
      }
    } else {
      item.history_dates = 'None';
      item.is_eligible = true;
      const partnerNote = isCombo
        ? 'Shared freq D0210 & D0330'
        : (isFmxOnly ? 'Shared freq with D0330' : 'Shared freq with D0210');

      if (!item.notes || !item.notes.toLowerCase().includes('shared')) {
        item.notes = item.notes ? `${partnerNote} • ${item.notes}` : partnerNote;
      }
    }
  });

  return procedureCodes;
}

// ==========================================
// AUTHENTICATION ENDPOINTS (HIPAA COMPLIANT)
// ==========================================

// 1. POST /api/auth/login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const userRes = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.practice_id, u.is_active, p.name as practice_name 
       FROM dentverify.users u 
       JOIN dentverify.practices p ON u.practice_id = p.id 
       WHERE LOWER(u.email) = LOWER($1)`,
      [email.trim()]
    );

    if (userRes.rows.length === 0) {
      await recordAuditLog(req, 'LOGIN_FAILED', null, { email: email.trim(), reason: 'User not found' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'This clinic user account is deactivated.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await recordAuditLog(req, 'LOGIN_FAILED', user.id, { reason: 'Password mismatch' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT (12 hours expiration with rolling session)
    const token = jwt.sign(
      { userId: user.id, practiceId: user.practice_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Update last_login_at
    await db.query('UPDATE dentverify.users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Set secure HttpOnly cookie
    res.cookie('dentverify_token', token, {
      httpOnly: true,
      secure: false, // set true in strict SSL production
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
    });

    req.user = user;
    await recordAuditLog(req, 'LOGIN_SUCCESS', user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        practice_id: user.practice_id,
        practice_name: user.practice_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// 2. GET /api/auth/me
app.get('/api/auth/me', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      full_name: req.user.full_name,
      role: req.user.role,
      practice_id: req.user.practice_id,
      practice_name: req.user.practice_name,
    },
  });
});

// 3. POST /api/auth/logout
app.post('/api/auth/logout', async (req, res) => {
  await recordAuditLog(req, 'LOGOUT', req.user?.id);
  res.clearCookie('dentverify_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ==========================================
// PERSISTENT VERIFICATION HISTORY ENDPOINTS
// ==========================================

// GET /api/verifications (List history records)
app.get('/api/verifications', async (req, res) => {
  try {
    const practiceId = req.user?.practice_id;
    const queryStr = practiceId
      ? `SELECT id, carrier, patient_name_enc, patient_name_masked, member_id_enc, dob_enc, network_status, created_at,
                breakdown_json->'insurance_details'->>'plan_benefits' as plan_benefits,
                breakdown_json->'insurance_details'->>'effective_date' as effective_date,
                breakdown_json->'insurance_details'->>'policy_status' as policy_status
         FROM dentverify.verifications
         WHERE practice_id = $1
         ORDER BY created_at DESC
         LIMIT 100;`
      : `SELECT id, carrier, patient_name_enc, patient_name_masked, member_id_enc, dob_enc, network_status, created_at,
                breakdown_json->'insurance_details'->>'plan_benefits' as plan_benefits,
                breakdown_json->'insurance_details'->>'effective_date' as effective_date,
                breakdown_json->'insurance_details'->>'policy_status' as policy_status
         FROM dentverify.verifications
         ORDER BY created_at DESC
         LIMIT 100;`;

    const result = practiceId ? await db.query(queryStr, [practiceId]) : await db.query(queryStr);

    const records = result.rows.map(row => {
      const decryptedName = db.decryptField(row.patient_name_enc);
      const decryptedDob = db.decryptField(row.dob_enc);
      return {
        id: row.id,
        carrier: row.carrier || 'Dental Insurance',
        patient_name: decryptedName || row.patient_name_masked || 'N/A',
        dob: decryptedDob || 'N/A',
        network_status: row.network_status || 'In-Network',
        plan_benefits: row.plan_benefits || 'Calendar Year',
        effective_date: row.effective_date || '01/01/2026',
        policy_status: row.policy_status || 'Active',
        created_at: row.created_at,
      };
    });

    await recordAuditLog(req, 'VIEW_HISTORY_LIST', null, { count: records.length });
    res.json({ success: true, history: records });
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ error: 'Failed to retrieve verification history.' });
  }
});

// GET /api/verifications/:id (Fetch full breakdown JSON)
app.get('/api/verifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT id, carrier, patient_name_enc, member_id_enc, dob_enc, network_status, breakdown_json, created_at 
       FROM dentverify.verifications 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Verification record not found.' });
    }

    const row = result.rows[0];
    const breakdown = row.breakdown_json;

    // Decrypt patient details in returned JSON
    if (breakdown.insurance_details) {
      breakdown.insurance_details.patient_name = db.decryptField(row.patient_name_enc) || breakdown.insurance_details.patient_name;
      if (row.dob_enc) {
        breakdown.insurance_details.dob = db.decryptField(row.dob_enc) || breakdown.insurance_details.dob;
      }
    }

    await recordAuditLog(req, 'VIEW_BREAKDOWN_RECORD', id);
    res.json({ success: true, record: breakdown });
  } catch (err) {
    console.error('Record fetch error:', err);
    res.status(500).json({ error: 'Failed to load verification record.' });
  }
});

// DELETE /api/verifications/:id (Soft-delete or purge)
app.delete('/api/verifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM dentverify.verifications WHERE id = $1`, [id]);
    await recordAuditLog(req, 'DELETE_BREAKDOWN_RECORD', id);
    res.json({ success: true, message: 'Record deleted successfully.' });
  } catch (err) {
    console.error('Record delete error:', err);
    res.status(500).json({ error: 'Failed to delete verification record.' });
  }
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
      'gemini-2.5-flash',
      'gemini-flash-latest',
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

    // Deterministic validation 1: Policy Termed Date & Active Status
    if (parsedResult && parsedResult.insurance_details) {
      if (req.body.patient_name && req.body.patient_name.trim()) {
        if (!parsedResult.insurance_details.patient_name || parsedResult.insurance_details.patient_name === 'N/A') {
          parsedResult.insurance_details.patient_name = req.body.patient_name.trim();
        }
      }
      if (req.body.dob && req.body.dob.trim()) {
        if (!parsedResult.insurance_details.dob || parsedResult.insurance_details.dob === 'N/A') {
          parsedResult.insurance_details.dob = req.body.dob.trim();
        }
      }

      // Sanitize Employer/Group Name, Claims Address, Phone, Payor ID
      const ins = parsedResult.insurance_details;
      delete ins.secondary_insurance;
      if (!ins.group_name || /^(none|na|null|undefined|-)$/i.test(String(ins.group_name).trim())) {
        ins.group_name = 'N/A';
      }
      if (!ins.plan_name || /^(none|na|null|undefined|-)$/i.test(String(ins.plan_name).trim())) {
        ins.plan_name = 'N/A';
      }
      if (!ins.group_number || /^(none|na|null|undefined|-)$/i.test(String(ins.group_number).trim())) {
        ins.group_number = 'N/A';
      }
      if (!ins.insurance_address || /^(none|na|null|undefined|-)$/i.test(String(ins.insurance_address).trim())) {
        ins.insurance_address = 'N/A';
      }
      if (!ins.insurance_phone || /^(none|na|null|undefined|-)$/i.test(String(ins.insurance_phone).trim())) {
        ins.insurance_phone = 'N/A';
      }
      if (!ins.payor_id || /^(none|na|null|undefined|-)$/i.test(String(ins.payor_id).trim())) {
        ins.payor_id = 'N/A';
      }
      if (!ins.carrier || /^(none|na|null|undefined|-)$/i.test(String(ins.carrier).trim())) {
        ins.carrier = 'Dental Insurance';
      }

      parsedResult.insurance_details = enforcePolicyTermedRules(parsedResult.insurance_details);
    }

    // Deterministic validation 2: CDT D0210 & D0330 shared frequency & history eligibility
    if (parsedResult && Array.isArray(parsedResult.procedure_codes)) {
      parsedResult.procedure_codes = enforceSharedFmxPanoRules(parsedResult.procedure_codes);
      parsedResult.procedure_codes = enforceAgeLimitAndFrequencyRules(parsedResult.procedure_codes, parsedResult.insurance_details || {});
    }

    // Persist to PostgreSQL Database with AES-256-GCM Field Encryption
    let savedVerificationId = null;
    try {
      const ins = parsedResult.insurance_details || {};
      const practiceId = req.user?.practice_id || null;
      const userId = req.user?.id || null;
      const rawPatientName = ins.patient_name || 'N/A';
      const patientNameEnc = db.encryptField(rawPatientName);
      const maskedName = rawPatientName.length > 3
        ? `${rawPatientName[0]}*** ${rawPatientName.slice(-2)}`
        : rawPatientName;
      const dobEnc = db.encryptField(ins.dob || '');
      const memberIdEnc = db.encryptField(ins.member_id || ins.subscriber_id || '');

      const insertRes = await db.query(
        `INSERT INTO dentverify.verifications (
           practice_id, user_id, source, carrier, patient_name_enc, patient_name_masked,
           member_id_enc, dob_enc, network_status, breakdown_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id;`,
        [
          practiceId,
          userId,
          'manual_upload',
          ins.carrier || 'Dental Insurance',
          patientNameEnc,
          maskedName,
          memberIdEnc,
          dobEnc,
          ins.network_status || 'In-Network',
          JSON.stringify(parsedResult),
        ]
      );

      if (insertRes.rows.length > 0) {
        savedVerificationId = insertRes.rows[0].id;
        await recordAuditLog(req, 'VERIFY_DOCUMENT_ANALYSIS', savedVerificationId, {
          carrier: ins.carrier,
          model: usedModel,
          fileCount: uploadedFiles.length,
        });
      }
    } catch (dbSaveErr) {
      console.error('Failed to persist verification record to PostgreSQL:', dbSaveErr);
    }

    res.json({
      success: true,
      meta: {
        verification_id: savedVerificationId,
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
    const rawMsg = (error.message || error.toString() || '').toLowerCase();
    const errStatus = error.status || error.code || null;
    let userMessage = error.message || 'An unexpected error occurred during analysis.';
    let errorType = 'SERVER_ERROR';

    if (errStatus === 503 || rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('unavailable') || rawMsg.includes('overload')) {
      errorType = 'API_OVERLOAD';
      userMessage = '⚠️ Google Gemini API Overload (503 High Demand): Temporaryong taas kaayo ang demand sa Google AI models karon. Palihug hulat og 5-15 segundos unya i-click usab ang "Analyze Breakdown".';
    } else if (errStatus === 429 || rawMsg.includes('429') || rawMsg.includes('quota') || rawMsg.includes('resource has been exhausted') || rawMsg.includes('rate limit')) {
      errorType = 'RATE_LIMIT';
      userMessage = '⚠️ Gemini Free Quota / Rate Limit Reached (429): Naabot ang libreng request limit sa Google API key karon. Palihug pahuwayi kadiyot (1-2 minutos) sa dili pa mosulay pag-usab.';
    } else if (errStatus === 403 || rawMsg.includes('api_key_invalid') || rawMsg.includes('403') || rawMsg.includes('permission denied')) {
      errorType = 'AUTH_ERROR';
      userMessage = '⚠️ Invalid API Key (403): Dili balido o kulang og permissions ang Gemini API key sa server .env.';
    } else if (rawMsg.includes('timeout') || errStatus === 504 || rawMsg.includes('etimedout') || rawMsg.includes('esockettimedout')) {
      errorType = 'TIMEOUT';
      userMessage = '⏱️ Processing Timeout: Nadugay pag-proseso ang AI tungod sa kadako sa file o trapik sa internet. Palihug sulayi pag-usab.';
    }

    res.status(500).json({
      success: false,
      error: userMessage,
      error_type: errorType,
      raw_error: error.message || String(error),
      status_code: errStatus,
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
app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`====================================================`);
  console.log(`Dental Insurance Verification Web App running!`);
  console.log(`Local URL: http://localhost:${PORT}`);
  console.log(`Domain:    https://dentverify.com`);
  const activeModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  console.log(`Model:     ${activeModel} (Google Gen AI SDK)`);
  console.log(`====================================================`);
});
