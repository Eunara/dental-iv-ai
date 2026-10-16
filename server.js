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
app.set('trust proxy', 1);
app.disable('x-powered-by');

const PORT = process.env.PORT || 3000;
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ CRITICAL SECURITY ERROR: Valid JWT_SECRET is required in .env');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// Configure Multer for memory buffer storage (up to 25MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 }, // 25 MB max file size, max 10 files
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

// Strict HTTP Security Headers & Anti-Scraping / Anti-Caching Directives
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  dotfiles: 'deny',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Helper: Redact plaintext PHI (patient_name, dob, member_id) inside breakdown_json before storing in PostgreSQL
// (Encrypted versions are stored in patient_name_enc, dob_enc, member_id_enc and decrypted only for authorized clinic sessions)
function sanitizeBreakdownForStorage(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') return breakdown;
  const copy = JSON.parse(JSON.stringify(breakdown));
  if (copy.insurance_details && typeof copy.insurance_details === 'object') {
    copy.insurance_details.patient_name = '[ENCRYPTED_AES256]';
    copy.insurance_details.dob = '[ENCRYPTED_AES256]';
    delete copy.insurance_details.member_id;
    delete copy.insurance_details.subscriber_id;
    delete copy.insurance_details.ssn;
  }
  return copy;
}

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
       LEFT JOIN dentverify.practices p ON u.practice_id = p.id 
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );
    if (userRes.rows.length > 0) {
      const u = userRes.rows[0];
      // If owner switched active clinic workspace, honor decoded.activePracticeId
      if (u.role === 'owner' && decoded.activePracticeId) {
        const pRes = await db.query('SELECT id, name FROM dentverify.practices WHERE id = $1', [decoded.activePracticeId]);
        if (pRes.rows.length > 0) {
          u.home_practice_id = u.practice_id;
          u.practice_id = pRes.rows[0].id;
          u.practice_name = pRes.rows[0].name;
        }
      } else if (u.role === 'owner' && !u.practice_id) {
        u.practice_name = 'Master Owner (Admin Control)';
      }
      req.user = u;
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

// Rate Limiters for Brute-Force & Scraping Protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts from this IP. Please try again in 15 minutes.' },
});

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 150, // 150 API requests per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});
app.use('/api/', apiLimiter);

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
          description: 'Dental Insurance Company Claims Submission Mailing Address ONLY (typically a P.O. Box, e.g. P.O. Box 981282, El Paso, TX 79998). CRITICAL: NEVER extract the patient, subscriber, employer, or dentist physical street/home address (such as on MetLife portal printouts where the subscriber home address is listed near the top). If no insurance P.O. Box / Claims Address is explicitly labeled, return "N/A".',
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
        ortho_payment_terms: {
          type: Type.STRING,
          description: 'Orthodontic payment schedule or payout terms if stated in the breakdown (e.g., Monthly, Quarterly, Yearly, Lump Sum / At Banding, Automatic Monthly Payments, or N/A if not specified)',
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
   - Extract Insurance Claims Mailing Address (Ins Address, e.g. P.O. Box 981282, El Paso, TX 79998-1282). CRITICAL BUG PREVENTION (METLIFE & PORTALS): NEVER extract the Patient's, Subscriber's, Employer's, or Dentist's physical/residential street address! On MetLife printouts, the street address near the patient/subscriber name is the patient's home address — DO NOT extract it! Only extract an institutional Insurance Claims P.O. Box / Claims Department address, or return "N/A".
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
   - Calendar Year vs Rolling Months & Multi-Year Strict Eligibility Math:
     * CRITICAL RULE: Eligibility (is_eligible) MUST be strictly determined by comparing History Date(s) against Frequency Limitation! Never mark a procedure is_eligible: true if its history date is still within the restricted frequency window!
     * When plan is "Calendar Year" and frequency is 1x1yr, 2x1yr, 3x1yr, or 4x1yr: Benefits reset on January 1 of each calendar year. If the patient has already used the allowed number of visits in the CURRENT calendar year (e.g., 1 visit in current year for 1x1yr, or 2 visits in current year for 2x1yr), you MUST mark is_eligible: false! If last service was in a prior calendar year, mark is_eligible: true.
     * When frequency is rolling months or multi-year (e.g., 1x6m, 1x12m, 2x12m, 1x24m, 1x36m, 1x3yr, 1x60m, 1x5yr): Calculate next_eligible_date = last_service_date + frequency_period. If current date < next_eligible_date (and allowed count is exhausted), you MUST mark is_eligible: false!
   - MANDATORY D0210 & D0330 SHARED FREQUENCY & ELIGIBILITY (STRICT):
     * D0210 (Full Mouth Series / FMX) and D0330 (Panoramic Image / Pano) ALWAYS share frequency limitations.
     * On Delta Dental plans, D0210 / D0330 frequency is 1x5yr (1 in 60 months / 5 years) unless the document explicitly states "36 months" or "3 years". Never guess 1x3yr when a Delta Dental printout says "Limitations apply" — use 1x5yr!
     * Cross-Code History: If a history date exists on EITHER D0210 OR D0330 (or in their notes), apply that history date to BOTH codes mutually.
     * STRICT MATH: Add the frequency period (e.g., 5 years / 60 months, or 3 years / 36 months) to the latest history date. If that Next Eligible Date is in the future (after today), BOTH D0210 and D0330 MUST be marked is_eligible: false, with the exact Next Eligible Date stated in notes.
     * Only if no history exists ("None") or the full frequency period has already elapsed as of today, mark is_eligible: true.
   - Detect other shared frequencies (e.g., D4346 shared with D1110; D0120 shared with D0140/D0150).
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
Strictly capture Orthodontic terms in the header (Ortho Lifetime Max, Remaining Ortho, Ortho Coverage %, Ortho Age Limit, and Ortho Payment Terms such as Monthly, Quarterly, Yearly, Lump Sum / At Banding, or N/A if not stated).
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

// ==========================================
// BUILT-IN CDT CODE MEMORY DICTIONARY (LOCKED MEANINGS)
// ==========================================
const CDT_CODE_DICTIONARY = Object.freeze({
  'D4346': 'Scaling in presence of gingival inflammation',
  'D1110': 'Prophy (Adult Cleaning)',
  'D1120': 'Prophy (Child Cleaning)',
  'D0274': 'BTW (Bitewings - Four Radiographic Images)',
  'D0272': 'BTW (Bitewings - Two Radiographic Images)',
  'D0210 / D0330': 'FMX (Complete Series) / Pano (Panoramic Image)',
  'D0210': 'FMX (Intraoral - Complete Series of Radiographic Images)',
  'D0330': 'Pano (Panoramic Radiographic Image)',
  'D0220': "PA's (Intraoral - Periapical First Radiographic Image)",
  'D0230': "PA's (Intraoral - Periapical Each Additional Image)",
  'D9110': 'Palliative (Emergency Treatment of Dental Pain)',
  'D0120': 'Exam (Periodic Oral Evaluation)',
  'D0140': 'Limited Exam (Problem Focused Oral Evaluation)',
  'D0150': 'Comprehensive Oral Evaluation (New or Established Patient)',
  'D0180': 'Comprehensive Periodontal Evaluation',
  'D1351': 'Sealant (Per Tooth)',
  'D1354': 'Interim Caries Arresting Medicament Application (SDF)',
  'D1206': 'Fluoride (Topical Application of Fluoride Varnish)',
  'D1208': 'Topical Application of Fluoride (Excluding Varnish)',
  'D1510': 'Space Maintainer (Fixed, Unilateral)',
  'D4341': 'SRP (Periodontal Scaling & Root Planing - 4+ Teeth per Quad)',
  'D4342': 'SRP (Periodontal Scaling & Root Planing - 1 to 3 Teeth per Quad)',
  'D4910': 'Perio Maint (Periodontal Maintenance)',
  'D4355': 'Full Mouth Debridement',
  'D4381': 'Localized Delivery of Antimicrobial Agents (Arestin)',
  'D2391': 'Filling / Composite (Resin-Based Composite - 1 Surface, Posterior)',
  'D2392': 'Filling / Composite (Resin-Based Composite - 2 Surfaces, Posterior)',
  'D2393': 'Filling / Composite (Resin-Based Composite - 3 Surfaces, Posterior)',
  'D2394': 'Filling / Composite (Resin-Based Composite - 4+ Surfaces, Posterior)',
  'D2330': 'Filling / Composite (Resin-Based Composite - 1 Surface, Anterior)',
  'D2331': 'Filling / Composite (Resin-Based Composite - 2 Surfaces, Anterior)',
  'D2332': 'Filling / Composite (Resin-Based Composite - 3 Surfaces, Anterior)',
  'D2335': 'Filling / Composite (Resin-Based Composite - 4+ Surfaces / Incisal, Anterior)',
  'D2140': 'Amalgam - One Surface, Primary or Permanent',
  'D2150': 'Amalgam - Two Surfaces, Primary or Permanent',
  'D2160': 'Amalgam - Three Surfaces, Primary or Permanent',
  'D2740': 'Crown (Porcelain / Ceramic Substrate)',
  'D2750': 'Crown (Porcelain Fused to High Noble Metal)',
  'D2751': 'Crown (Porcelain Fused to Predominantly Base Metal)',
  'D2752': 'Crown (Porcelain Fused to Noble Metal)',
  'D2790': 'Crown (Full Cast High Noble Metal)',
  'D2920': 'Crown Recement (Re-cement or Re-bond Crown)',
  'D2950': 'Core Buildup, Including Any Pins When Required',
  'D2954': 'Prefabricated Post and Core in Addition to Crown',
  'D3310': 'Endodontic Therapy, Anterior Tooth (Excluding Final Restoration)',
  'D3320': 'Endodontic Therapy, Premolar Tooth (Excluding Final Restoration)',
  'D3330': 'Endodontic Therapy, Molar Tooth (Excluding Final Restoration)',
  'D3220': 'Therapeutic Pulpotomy',
  'D5110': 'Complete Denture - Maxillary',
  'D5120': 'Complete Denture - Mandibular',
  'D5213': 'Maxillary Partial Denture - Cast Metal Framework',
  'D5214': 'Mandibular Partial Denture - Cast Metal Framework',
  'D6010': 'Implants (Surgical Placement of Implant Body: Endosteal Implant)',
  'D6058': 'Abutment Supported Porcelain/Ceramic Crown',
  'D6065': 'Implant Supported Porcelain/Ceramic Crown',
  'D6240': 'Pontic - Porcelain Fused to High Noble Metal (Bridge)',
  'D6740': 'Retainer Crown - Porcelain/Ceramic (Bridge)',
  'D7140': 'Simple Ext (Extraction, Erupted Tooth or Exposed Root)',
  'D7210': 'Surgical Ext (Extraction, Erupted Tooth Requiring Bone Removal)',
  'D7220': 'Removal of Impacted Tooth - Soft Tissue',
  'D7230': 'Removal of Impacted Tooth - Partially Bony',
  'D7240': 'Removal of Impacted Tooth - Completely Bony',
  'D7953': 'Bone Replacement Graft for Ridge Preservation - Per Site',
  'D8080': 'Comprehensive Orthodontic Treatment of the Adolescent Dentition',
  'D8090': 'Comprehensive Orthodontic Treatment of the Adult Dentition',
  'D9222 / D9223': 'Sedation / Anesthesia (Deep Sedation / General Anesthesia)',
  'D9222': 'Deep Sedation / General Anesthesia - First 15 Minutes',
  'D9223': 'Deep Sedation / General Anesthesia - Each Subsequent 15 Minutes',
  'D9230': 'Inhalation of Nitrous Oxide / Analgesia, Anxiolysis',
  'D9248': 'Non-Intravenous Conscious Sedation',
  'D9310': 'Consultation - Diagnostic Service',
  'D9944': 'Night Guard (Occlusal Guard - Hard Appliance, Full Arch)',
  'D9945': 'Night Guard (Occlusal Guard - Soft Appliance, Full Arch)',
  'D9946': 'Night Guard (Occlusal Guard - Hard Appliance, Partial Arch)',
  'D9940': 'Occlusal Guard, by Report',
});

const DEFAULT_ENABLED_CDT_CODES = [
  'D4346',
  'D1110',
  'D0274',
  'D0210 / D0330',
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
  'D9222 / D9223',
  'D9944',
  'D6010',
];

const DEFAULT_CATEGORY_CARDS = [
  { id: 'preventative', code: 'PREVENTATIVE', name: 'Preventive / Diag', sourceKey: 'preventive', val: '100%', sub: 'Ded Applied: No', color: 'emerald', enabled: true },
  { id: 'basic', code: 'BASIC', name: 'Basic Restorative', sourceKey: 'basic', val: '80%', sub: 'Ded Applied: Yes', color: 'cyan', enabled: true },
  { id: 'major', code: 'MAJOR', name: 'Major Restorative', sourceKey: 'major', val: '60%', sub: 'Ded Applied: Yes', color: 'indigo', enabled: true },
  { id: 'endo', code: 'ENDO', name: 'Endodontics', sourceKey: 'endo', val: '80%', sub: 'Root Canals', color: 'cyan', enabled: true },
  { id: 'oral_surgery', code: 'ORAL SURGERY', name: 'Oral Surgery', sourceKey: 'oral_surgery', val: '80%', sub: 'Extractions', color: 'cyan', enabled: true },
  { id: 'implants', code: 'IMPLANTS D6010', name: 'Implant Placement', sourceKey: 'implants', val: '60%', sub: 'Covered Benefit', color: 'cyan', enabled: true },
  { id: 'night_guard', code: 'NIGHT GUARD', name: 'D9944 Guard', sourceKey: 'night_guard', val: '80%', sub: 'Covered Benefit', color: 'cyan', enabled: true },
  { id: 'missing_tooth', code: 'MISSING TOOTH', name: 'Pre-existing Excl.', sourceKey: 'missing_tooth_clause', val: 'No', sub: 'Waived', color: 'emerald', enabled: true },
  { id: 'waiting_period', code: 'WAITING PERIOD', name: 'Waiting Period', sourceKey: 'waiting_period', val: 'No', sub: 'No (Waived)', color: 'emerald', enabled: true },
  { id: 'ortho', code: 'ORTHO', name: 'Orthodontics', sourceKey: 'ortho', val: '50%', sub: 'Braces / Aligners', color: 'purple', enabled: false },
  { id: 'periodontics', code: 'PERIO', name: 'Periodontics', sourceKey: 'periodontics', val: '80%', sub: 'D4341 SRP / Maint', color: 'cyan', enabled: false },
  { id: 'crowns', code: 'CROWNS', name: 'Crown & Bridge', sourceKey: 'crowns', val: '50%', sub: 'D2740 / D6240', color: 'indigo', enabled: false },
  { id: 'dentures', code: 'DENTURES', name: 'Prosthodontics', sourceKey: 'dentures', val: '50%', sub: 'Full / Partial', color: 'amber', enabled: false },
];

function getCanonicalCdtMeaning(rawCode, fallbackDesc = '') {
  if (!rawCode) return fallbackDesc || '-';
  const upper = String(rawCode).trim().toUpperCase();
  if (CDT_CODE_DICTIONARY[upper]) return CDT_CODE_DICTIONARY[upper];
  if (upper.includes('D0210') && upper.includes('D0330')) return CDT_CODE_DICTIONARY['D0210 / D0330'];
  if (upper.includes('D9222') && upper.includes('D9223')) return CDT_CODE_DICTIONARY['D9222 / D9223'];
  const singleMatch = upper.match(/D\d{4}/);
  if (singleMatch && CDT_CODE_DICTIONARY[singleMatch[0]]) {
    return CDT_CODE_DICTIONARY[singleMatch[0]];
  }
  return fallbackDesc || '-';
}

function enforceCanonicalCdtMeanings(procedureCodes) {
  if (!Array.isArray(procedureCodes)) return procedureCodes;
  procedureCodes.forEach(item => {
    if (!item) return;
    item.description = getCanonicalCdtMeaning(item.code, item.description);
  });
  return procedureCodes;
}

// Endpoint to provide default prompts and built-in CDT dictionary to authenticated users only
app.get('/api/prompts/default', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    let clinicSettings = {};
    if (req.user.practice_id) {
      const r = await db.query('SELECT clinic_ai_settings_json FROM dentverify.practices WHERE id = $1', [req.user.practice_id]);
      clinicSettings = r.rows[0]?.clinic_ai_settings_json || {};
    } else {
      const r = await db.query('SELECT clinic_ai_settings_json FROM dentverify.practices ORDER BY created_at ASC LIMIT 1');
      clinicSettings = r.rows[0]?.clinic_ai_settings_json || {};
    }
    const resolvedCodes = Array.isArray(clinicSettings.enabledCodes) && clinicSettings.enabledCodes.length > 0
      ? clinicSettings.enabledCodes
      : (Array.isArray(clinicSettings.enabledCdtCodes) && clinicSettings.enabledCdtCodes.length > 0 ? clinicSettings.enabledCdtCodes : DEFAULT_ENABLED_CDT_CODES);

    res.json({
      systemInstruction: clinicSettings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
      customPrompt: clinicSettings.customPrompt || DEFAULT_CDT_CODES_PROMPT,
      enabledCodes: resolvedCodes,
      enabledCdtCodes: resolvedCodes,
      categoryCards: Array.isArray(clinicSettings.categoryCards) && clinicSettings.categoryCards.length > 0
        ? clinicSettings.categoryCards
        : DEFAULT_CATEGORY_CARDS,
      defaultSystemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      defaultCustomPrompt: DEFAULT_CDT_CODES_PROMPT,
      defaultEnabledCodes: DEFAULT_ENABLED_CDT_CODES,
      defaultCategoryCards: DEFAULT_CATEGORY_CARDS,
      cdtDictionary: CDT_CODE_DICTIONARY,
    });
  } catch (err) {
    res.json({
      systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      customPrompt: DEFAULT_CDT_CODES_PROMPT,
      enabledCodes: DEFAULT_ENABLED_CDT_CODES,
      enabledCdtCodes: DEFAULT_ENABLED_CDT_CODES,
      categoryCards: DEFAULT_CATEGORY_CARDS,
      defaultSystemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      defaultCustomPrompt: DEFAULT_CDT_CODES_PROMPT,
      defaultEnabledCodes: DEFAULT_ENABLED_CDT_CODES,
      defaultCategoryCards: DEFAULT_CATEGORY_CARDS,
      cdtDictionary: CDT_CODE_DICTIONARY,
    });
  }
});

// Save Per-Clinic AI Prompt, CDT Code Checklist / Sequence Ordering & Benefit Category Cards
app.post('/api/clinic-settings', async (req, res) => {
  if (!req.user || (req.user.role !== 'owner' && req.user.role !== 'clinic_admin')) {
    return res.status(403).json({ error: 'Only Clinic Admin or Website Owner can update clinic AI settings and CDT checklist.' });
  }
  try {
    const { systemInstruction, customPrompt, enabledCodes, enabledCdtCodes, categoryCards, resetDefaults } = req.body;
    const finalCodes = enabledCodes || enabledCdtCodes;
    const settingsPayload = resetDefaults
      ? {}
      : {
          systemInstruction: systemInstruction ? String(systemInstruction).trim() : DEFAULT_SYSTEM_INSTRUCTION,
          customPrompt: customPrompt ? String(customPrompt).trim() : DEFAULT_CDT_CODES_PROMPT,
          enabledCodes: Array.isArray(finalCodes) && finalCodes.length > 0 ? finalCodes : DEFAULT_ENABLED_CDT_CODES,
          enabledCdtCodes: Array.isArray(finalCodes) && finalCodes.length > 0 ? finalCodes : DEFAULT_ENABLED_CDT_CODES,
          categoryCards: Array.isArray(categoryCards) && categoryCards.length > 0 ? categoryCards : DEFAULT_CATEGORY_CARDS,
          updated_by: req.user.full_name || req.user.email,
          updated_at: new Date().toISOString(),
        };

    if (req.user.role === 'owner' && !req.user.practice_id) {
      await db.query(`UPDATE dentverify.practices SET clinic_ai_settings_json = $1`, [JSON.stringify(settingsPayload)]);
      await recordAuditLog(req, 'UPDATE_ALL_CLINIC_AI_SETTINGS', null, { resetDefaults: Boolean(resetDefaults) });
    } else {
      await db.query(
        `UPDATE dentverify.practices SET clinic_ai_settings_json = $1 WHERE id = $2`,
        [JSON.stringify(settingsPayload), req.user.practice_id]
      );
      await recordAuditLog(req, 'UPDATE_CLINIC_AI_SETTINGS', req.user.practice_id, { resetDefaults: Boolean(resetDefaults) });
    }
    res.json({
      success: true,
      settings: {
        systemInstruction: settingsPayload.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
        customPrompt: settingsPayload.customPrompt || DEFAULT_CDT_CODES_PROMPT,
        enabledCodes: settingsPayload.enabledCodes || DEFAULT_ENABLED_CDT_CODES,
        enabledCdtCodes: settingsPayload.enabledCodes || DEFAULT_ENABLED_CDT_CODES,
        categoryCards: settingsPayload.categoryCards || DEFAULT_CATEGORY_CARDS,
      },
    });
  } catch (err) {
    console.error('Error saving clinic AI settings:', err);
    res.status(500).json({ error: 'Failed to save clinic AI settings.' });
  }
});

app.get('/api/cdt-dictionary', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    success: true,
    locked: true,
    dictionary: CDT_CODE_DICTIONARY,
    defaultEnabledCodes: DEFAULT_ENABLED_CDT_CODES,
  });
});

// Minimal Health Check (No internal config or model names exposed)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// DATE & ELIGIBILITY UTILITY FUNCTIONS
// ==========================================

// ==========================================
// DATE & ELIGIBILITY UTILITY FUNCTIONS
// ==========================================

// Helper: extract ALL valid dates from a string (handles multiple comma/slash-separated dates,
// annotated dates like "05/14/2025 (D0330)", "UR: 05/19/2026", YYYY-MM-DD, MM/DD/YY, etc.)
// Returns array of Date objects sorted newest (most recent) first.
function extractAllDates(str) {
  if (!str) return [];
  const s = String(str).trim();
  if (/^(none|no|n\/a|na|history|null|undefined|-|date not found|not found)$/i.test(s)) return [];

  const foundDates = [];
  const seenTimes = new Set();

  const pushValidDate = (y, mZeroIndexed, d) => {
    let year = y;
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    if (year < 1920 || year > 2100) return;
    if (mZeroIndexed < 0 || mZeroIndexed > 11) return;
    if (d < 1 || d > 31) return;
    const dt = new Date(year, mZeroIndexed, d);
    if (!isNaN(dt.getTime()) && dt.getMonth() === mZeroIndexed) {
      const t = dt.getTime();
      if (!seenTimes.has(t)) {
        seenTimes.add(t);
        foundDates.push(dt);
      }
    }
  };

  // 1. YYYY-MM-DD or YYYY/MM/DD anywhere in string
  const ymdRegex = /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g;
  let match;
  while ((match = ymdRegex.exec(s)) !== null) {
    pushValidDate(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  }

  // 2. MM/DD/YYYY or M/D/YYYY or MM/DD/YY anywhere in string
  const mdyRegex = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g;
  while ((match = mdyRegex.exec(s)) !== null) {
    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);
    const third = parseInt(match[3], 10);
    // Avoid re-matching YYYY-MM-DD
    if (first > 31) continue;
    pushValidDate(third, first - 1, second);
  }

  // 3. If no full dates found yet, check MM/YYYY or M/YYYY (only when not preceded/followed by another slash)
  if (foundDates.length === 0) {
    const myRegex = /(?:^|[^\d\/\-])(\d{1,2})[\/\-](\d{4})(?!\d|[\/\-])/g;
    while ((match = myRegex.exec(s)) !== null) {
      pushValidDate(parseInt(match[2], 10), parseInt(match[1], 10) - 1, 1);
    }
  }

  // 4. Fallback to native Date.parse if still empty and looks like Month DD, YYYY
  if (foundDates.length === 0 && /[a-z]{3,9}\s+\d{1,2},?\s+\d{4}/i.test(s)) {
    const parsed = Date.parse(s);
    if (!isNaN(parsed)) {
      foundDates.push(new Date(parsed));
    }
  }

  // Sort newest (most recent) first
  foundDates.sort((a, b) => b.getTime() - a.getTime());
  return foundDates;
}

// Helper: parse most recent date from various string formats
function parseDate(str) {
  const all = extractAllDates(str);
  return all.length > 0 ? all[0] : null;
}

function formatDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function addMonthsToDate(dateObj, months) {
  const d = new Date(dateObj.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
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
  if (/no\s*frequency|unlimited|none|no\s*limit|^nl$/i.test(s)) {
    return 'NF';
  }

  // Lifetime
  if (/lifetime|^1\/lt|^1\/tooth/i.test(s)) {
    if (/tooth/i.test(s)) return '1/tooth LT';
    return '1/LT';
  }

  // Count determination (e.g. two / twice / 2 vs one / once / 1 vs 4 vs 3)
  let count = 1;
  const compactPrefix = s.match(/^(\d+)\s*(?:x|in|per|\/)\b/);
  if (compactPrefix) {
    count = parseInt(compactPrefix[1], 10) || 1;
  } else if (/two|twice|\b2\b/i.test(s)) {
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
    if (months === 12) return `${count}x12m`;
    if (months === 24) return `${count}x24m`;
    if (months === 36) return `${count}x36m`;
    if (months === 60) return `${count}x5yr`;
    return `${count}x${months}m`;
  }

  // Years pattern (e.g. "within 1 year", "per year", "every 5 years", "in 3 years", "1x3yr")
  const yMatch = s.match(/(\d+)\s*(?:y|yr|yrs|year|years)\b/);
  if (yMatch) {
    const years = parseInt(yMatch[1], 10);
    return `${count}x${years}yr`;
  }

  if (/per\s*year|a\s*year|every\s*year|annual/i.test(s)) {
    return `${count}x1yr`;
  }

  if (raw.length <= 12) {
    return raw;
  }

  if (/calendar/i.test(s)) return `${count}x1yr`;
  if (/12\s*m/i.test(s)) return `${count}x12m`;

  return raw;
}

// Helper: parse frequency months for multi-year/rolling procedures (default 60 months / 5 years)
function parseFrequencyMonths(freqStr) {
  if (!freqStr) return 60;
  const str = String(freqStr).toLowerCase();

  // Months: "60 months", "1 in 36m", "1x36m", "36mo", "24m"
  const mMatch = str.match(/(?:x|\b)(\d+)\s*(?:m|mo|mos|month|months)\b/);
  if (mMatch) {
    const m = parseInt(mMatch[1], 10);
    if (m > 0) return m;
  }

  // Years: "1x5yr", "1 in 5 years", "3 years", "1/5yr", "5y"
  const yMatch = str.match(/(?:x|\b)(\d+)\s*(?:y|yr|yrs|year|years)\b/);
  if (yMatch) {
    const y = parseInt(yMatch[1], 10);
    if (y > 0) return y * 12;
  }

  // Generic "1 in 60" or "1/36" or "1x60"
  const numMatch = str.match(/1\s*(?:in|\/|x)\s*(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 12) return n;
    if (n > 0 && n <= 10) return n * 12;
  }

  return 60;
}

// Helper: parse any frequency string into structured { mode, maxCount, windowMonths }
function parseFrequencyRule(freqStr, isCalendarYearPlan = true) {
  if (!freqStr) return { mode: 'unlimited', maxCount: 999, windowMonths: 0 };
  const raw = String(freqStr).trim();
  const s = raw.toLowerCase();

  if (/^(nf|nl|none|no\s*frequency|no\s*limit|unlimited|-|n\/a)$/i.test(raw) || /no\s*frequency|unlimited|per\s*date\s*of\s*service|xdos/i.test(s)) {
    return { mode: 'unlimited', maxCount: 999, windowMonths: 0 };
  }
  if (/^(nc|0%|not\s*covered)$/i.test(raw)) {
    return { mode: 'not_covered', maxCount: 0, windowMonths: 0 };
  }
  if (/lifetime|1\/lt|1\/tooth\s*lt/i.test(s)) {
    return { mode: /tooth/i.test(s) ? 'tooth_lifetime' : 'lifetime', maxCount: 1, windowMonths: 1200 };
  }

  // Match compact format first: e.g. "2x1yr", "1x1yr", "1x5yr", "1x3yr", "2x12m", "1x6m", "1x24m", "1x36m", "1x60m"
  const compactMatch = s.match(/(\d+)\s*x\s*(\d+)\s*(yr|yrs|y|year|years|m|mo|mos|month|months)\b/);
  if (compactMatch) {
    const maxCount = parseInt(compactMatch[1], 10) || 1;
    const num = parseInt(compactMatch[2], 10) || 1;
    const unit = compactMatch[3];
    const isYearUnit = unit.startsWith('y');
    const windowMonths = isYearUnit ? num * 12 : num;
    // 1yr on a Calendar Year plan resets Jan 1; multi-year (e.g. 1x3yr, 1x5yr) or explicit months (1x12m, 2x12m, 1x24m, 1x36m, 1x60m) uses rolling months from service date
    const mode = (isYearUnit && num === 1 && isCalendarYearPlan && !/rolling/i.test(s))
      ? 'calendar_year'
      : 'rolling_months';
    return { mode, maxCount, windowMonths };
  }

  // Fallback natural language parsing
  let maxCount = 1;
  if (/four|\b4\b/i.test(s)) maxCount = 4;
  else if (/three|\b3\b.*\b(?:year|calendar|12)/i.test(s)) maxCount = 3;
  else if (/two|twice|\b2\b.*\b(?:year|calendar|12|6)/i.test(s)) maxCount = 2;

  const mMatch = s.match(/(\d+)\s*(?:m|mo|mos|month|months)\b/);
  if (mMatch) {
    const windowMonths = parseInt(mMatch[1], 10) || 12;
    return { mode: 'rolling_months', maxCount, windowMonths };
  }

  const yMatch = s.match(/(\d+)\s*(?:y|yr|yrs|year|years)\b/);
  if (yMatch) {
    const yrs = parseInt(yMatch[1], 10) || 1;
    const mode = (yrs === 1 && isCalendarYearPlan) ? 'calendar_year' : 'rolling_months';
    return { mode, maxCount, windowMonths: yrs * 12 };
  }

  if (/calendar\s*year|per\s*year|annual/i.test(s)) {
    return { mode: isCalendarYearPlan ? 'calendar_year' : 'rolling_months', maxCount, windowMonths: 12 };
  }

  return { mode: 'unlimited', maxCount: 999, windowMonths: 0 };
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
// 2. STRICT AGE LIMIT, HISTORY & FREQUENCY ELIGIBILITY VALIDATOR
// ==========================================
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
    if (item.manual_eligibility_override) return;

    const code = String(item.code || '').toUpperCase();
    // Skip D0210/D0330 here because enforceSharedFmxPanoRules handles their shared frequency + history
    if (code.includes('D0210') || code.includes('D0330')) {
      return;
    }

    let covStr = String(item.coverage_percentage || '').trim().toUpperCase();
    const planCoversMatch = String(item.notes || '').match(/plan\s*(?:covers|pays)\s*(\d+%)/i);
    if (covStr === '0%' && planCoversMatch) {
      item.coverage_percentage = planCoversMatch[1];
      covStr = planCoversMatch[1].toUpperCase();
    }
    const isCoveredBenefit = covStr !== '0%' && covStr !== 'NC' && !covStr.includes('NOT COVERED');
    if (!isCoveredBenefit) {
      item.is_eligible = false;
      return;
    }

    const ageLimStr = String(item.age_limit || '').trim();
    const rawFreqStr = String(item.frequency_limitation || '').trim();
    const histStr = String(item.history_dates || '').trim();
    const notesStr = String(item.notes || '');

    let ageIneligible = false;

    // 1. AGE LIMITATION CHECK (Minimum vs Maximum Age Thresholds, plus range support like "0-99" or "14-99")
    if (patientAge !== null && ageLimStr && !/^(none|nl|no limit|n\/a|-|all|all ages)$/i.test(ageLimStr)) {
      const rangeMatch = ageLimStr.match(/(\d+)\s*(?:-|to|through)\s*(\d+)/i);
      if (rangeMatch) {
        const minA = parseInt(rangeMatch[1], 10);
        const maxA = parseInt(rangeMatch[2], 10);
        if (patientAge < minA) {
          ageIneligible = true;
          item.is_eligible = false;
          const ageNote = `Ineligible: Patient age (${patientAge}) is below plan minimum age requirement (${minA})`;
          if (!item.notes || !item.notes.includes('below plan minimum age')) {
            item.notes = item.notes ? `${item.notes} • ${ageNote}` : ageNote;
          }
        } else if (maxA < 95 && patientAge > maxA) {
          ageIneligible = true;
          item.is_eligible = false;
          const ageNote = `Ineligible: Patient age (${patientAge}) exceeds plan age limit (${maxA})`;
          if (!item.notes || !item.notes.includes('exceeds plan age limit')) {
            item.notes = item.notes ? `${item.notes} • ${ageNote}` : ageNote;
          }
        }
      } else {
        const match = ageLimStr.match(/(\d+)/);
        if (match) {
          const targetAge = parseInt(match[1], 10);
          // Any age >= 95 (like "99" on Aetna) means no practical age limit
          if (targetAge < 95) {
            const hasMinKeywords = /(and\s*over|and\s*older|&\s*over|&\s*older|\+|and\s*up|or\s*older|or\s*over|min\b|minimum|>=|>|over)/i.test(ageLimStr);
            const hasMaxKeywords = /(under|through|up\s*to|to\s*age|and\s*under|&\s*under|or\s*younger|max\b|maximum|<=|<)/i.test(ageLimStr);
            const isAdultCode = (code.includes('D1110') || code.includes('D4346')) && targetAge <= 21;
            const isMinAge = hasMinKeywords || (isAdultCode && !hasMaxKeywords);

            if (isMinAge) {
              if (patientAge < targetAge) {
                ageIneligible = true;
                item.is_eligible = false;
                const ageNote = `Ineligible: Patient age (${patientAge}) is below plan minimum age requirement (${targetAge})`;
                if (!item.notes || !item.notes.includes('below plan minimum age')) {
                  item.notes = item.notes ? `${item.notes} • ${ageNote}` : ageNote;
                }
              } else {
                if (item.notes && item.notes.includes('exceeds plan age limit')) {
                  item.notes = item.notes
                    .replace(/\s*•\s*Ineligible:\s*Patient age \(\d+\) exceeds plan age limit \(\d+\)/gi, '')
                    .replace(/Ineligible:\s*Patient age \(\d+\) exceeds plan age limit \(\d+\)\s*•\s*/gi, '')
                    .replace(/Ineligible:\s*Patient age \(\d+\) exceeds plan age limit \(\d+\)/gi, '')
                    .trim();
                }
              }
            } else {
              const isStrictlyUnder = /under\s*\d+|<\s*\d+/i.test(ageLimStr);
              const exceedsMax = isStrictlyUnder ? (patientAge >= targetAge) : (patientAge > targetAge);
              if (exceedsMax) {
                ageIneligible = true;
                item.is_eligible = false;
                const ageNote = `Ineligible: Patient age (${patientAge}) exceeds plan age limit (${targetAge})`;
                if (!item.notes || !item.notes.includes('exceeds plan age limit')) {
                  item.notes = item.notes ? `${item.notes} • ${ageNote}` : ageNote;
                }
              }
            }
          }
        }
      }
    }

    // Normalize frequency notation first
    if (item.frequency_limitation) {
      item.frequency_limitation = formatFrequencyNotation(item.frequency_limitation);
    }
    const cleanFreq = String(item.frequency_limitation || '').trim();
    const freqRule = parseFrequencyRule(cleanFreq, isCalendarYearPlan);

    // If already ineligible due to age, do not flip back to true
    if (ageIneligible) return;

    // 2. STRICT HISTORY + FREQUENCY ELIGIBILITY CALCULATION
    const allDates = extractAllDates(histStr);
    const hasSixMonthSpacingRule = /6\s*(?:-|to\s*)?month\s*(?:apart|interval|wait|separation)|1\s*(?:per|every|in)\s*6\s*m/i.test(notesStr);

    // Check explicit "0 remaining" or unit exhaustion in history/notes (e.g. "2 Units" used on a 2x1yr code)
    if (/0\s*(?:service\/procedures|procedures|visits|units)?\s*remaining|exhausted/i.test(histStr) || /0\s*(?:service\/procedures|procedures|visits|units)\s*remaining/i.test(notesStr)) {
      item.is_eligible = false;
      return;
    }
    const unitUsedMatch = histStr.match(/^(\d+)\s*(?:visit|visits|unit|units|used)\b/i);
    if (unitUsedMatch && freqRule.maxCount < 999) {
      const usedUnits = parseInt(unitUsedMatch[1], 10);
      if (usedUnits >= freqRule.maxCount) {
        item.is_eligible = false;
        const unitNote = `Ineligible: Frequency limit met (${usedUnits} of ${freqRule.maxCount} used)`;
        if (!item.notes || !item.notes.toLowerCase().includes('ineligible')) {
          item.notes = item.notes ? `${item.notes} • ${unitNote}` : unitNote;
        }
        return;
      }
    }

    if (allDates.length > 0) {
      const latestDate = allDates[0];

      if (freqRule.mode === 'lifetime') {
        item.is_eligible = false;
        const ltNote = `Ineligible: Lifetime limit (1/LT) already used on ${formatDate(latestDate)}`;
        if (!item.notes || !item.notes.toLowerCase().includes('ineligible')) {
          item.notes = item.notes ? `${item.notes} • ${ltNote}` : ltNote;
        }
        return;
      }

      if (freqRule.mode === 'calendar_year') {
        const datesInCurrentYear = allDates.filter(d => d.getFullYear() === currentYear);

        if (datesInCurrentYear.length >= freqRule.maxCount) {
          // Strictly Ineligible — Calendar year quota met!
          item.is_eligible = false;
          const nextJan1 = `01/01/${currentYear + 1}`;
          const ineligNote = `Ineligible until ${nextJan1} (${datesInCurrentYear.length} of ${freqRule.maxCount} used in Calendar Year ${currentYear}; Last: ${formatDate(latestDate)})`;
          if (!item.notes || !item.notes.includes(nextJan1)) {
            item.notes = item.notes ? `${item.notes} • ${ineligNote}` : ineligNote;
          }
          return;
        }

        // If 6-month spacing rule between visits applies and latest visit was < 6 months ago
        if (hasSixMonthSpacingRule) {
          const sixMoNext = addMonthsToDate(latestDate, 6);
          if (today < sixMoNext) {
            item.is_eligible = false;
            const spaceNote = `Ineligible until ${formatDate(sixMoNext)} (6-month interval from ${formatDate(latestDate)})`;
            if (!item.notes || !item.notes.includes(formatDate(sixMoNext))) {
              item.notes = item.notes ? `${item.notes} • ${spaceNote}` : spaceNote;
            }
            return;
          }
        }

        // Otherwise eligible (either prior calendar year reset, or remaining visits in current year)
        if (latestDate.getFullYear() < currentYear) {
          item.is_eligible = true;
          const resetNote = `Eligible (Benefit reset for Calendar Year ${currentYear}; Last service: ${formatDate(latestDate)})`;
          if (!item.notes || !item.notes.includes('Calendar Year')) {
            item.notes = item.notes ? `${item.notes} • ${resetNote}` : resetNote;
          }
        } else if (datesInCurrentYear.length < freqRule.maxCount) {
          // Only mark eligible if notes don't explicitly state combined/shared frequency exhaustion on another code
          if (!/ineligible|exhausted|frequency\s*met|0\s*remaining/i.test(notesStr)) {
            item.is_eligible = true;
          }
        }
      } else if (freqRule.mode === 'rolling_months' && freqRule.windowMonths > 0) {
        // Count how many history dates are still inside the rolling window (d + windowMonths > today)
        const activeWindowDates = allDates.filter(d => addMonthsToDate(d, freqRule.windowMonths) > today);

        if (activeWindowDates.length >= freqRule.maxCount) {
          // Strictly Ineligible — Rolling / Multi-Year frequency window has NOT elapsed!
          item.is_eligible = false;
          const limitingDate = activeWindowDates[freqRule.maxCount - 1] || latestDate;
          const nextEligibleDt = addMonthsToDate(limitingDate, freqRule.windowMonths);
          const nextEligibleStr = formatDate(nextEligibleDt);
          const ineligNote = `Ineligible until ${nextEligibleStr} (Last: ${formatDate(latestDate)}, Freq: ${cleanFreq})`;
          if (!item.notes || (!item.notes.includes(nextEligibleStr) && !item.notes.toLowerCase().includes('ineligible until'))) {
            item.notes = item.notes ? `${item.notes} • ${ineligNote}` : ineligNote;
          }
          return;
        }

        if (hasSixMonthSpacingRule) {
          const sixMoNext = addMonthsToDate(latestDate, 6);
          if (today < sixMoNext) {
            item.is_eligible = false;
            return;
          }
        }

        // Frequency window has elapsed or visits remain in rolling window
        if (activeWindowDates.length === 0) {
          item.is_eligible = true;
          const satNote = `Eligible (Frequency satisfied: Last service ${formatDate(latestDate)})`;
          if (!item.notes || !item.notes.includes('Frequency satisfied')) {
            item.notes = item.notes ? `${item.notes} • ${satNote}` : satNote;
          }
        } else if (activeWindowDates.length < freqRule.maxCount) {
          const rem = freqRule.maxCount - activeWindowDates.length;
          if (!/ineligible|exhausted|frequency\s*met|0\s*remaining/i.test(notesStr)) {
            item.is_eligible = true;
            const rollNote = `Eligible: ${rem} of ${freqRule.maxCount} remaining in rolling ${freqRule.windowMonths}m (Last service: ${formatDate(latestDate)})`;
            if (!item.notes || !item.notes.includes('remaining in rolling')) {
              item.notes = item.notes ? `${item.notes} • ${rollNote}` : rollNote;
            }
          }
        }
      }
    }
  });

  return procedureCodes;
}

// ==========================================
// 3. D0210 & D0330 SHARED FREQUENCY & ELIGIBILITY VALIDATOR (STRICT)
// ==========================================
/**
 * Dental RCM Policy Rule:
 * CDT codes D0210 (Full Mouth Series / FMX) and D0330 (Panoramic Image / Pano)
 * ALWAYS share the same frequency limitation (typically 1 in 36 or 60 months / 5 years).
 * If a previous service history date exists on EITHER code (or in notes), that history applies
 * to BOTH codes mutually. Strictly validates against the frequency limitation to determine
 * whether patient is currently eligible or ineligible, computing the exact next eligible date.
 */
function enforceSharedFmxPanoRules(procedureCodes, insuranceDetails = {}) {
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

  const carrierName = String(insuranceDetails?.carrier || '').toLowerCase();
  const isDeltaDental = carrierName.includes('delta');

  // 2. Extract shared frequency across all FMX/Pano rows (pick the strictest/longest window if they differ)
  let sharedFreqText = '';
  let maxFreqMonths = 0;

  for (const item of fmxPanoItems) {
    const rawFreq = String(item.frequency_limitation || '').trim();
    const cleanFreq = rawFreq.replace(/\s*\(shared[^)]*\)/gi, '').trim();
    if (cleanFreq && !/^(nf|nl|none|no|n\/a|-)$/i.test(cleanFreq)) {
      const m = parseFrequencyMonths(cleanFreq);
      if (m > maxFreqMonths) {
        maxFreqMonths = m;
        sharedFreqText = formatFrequencyNotation(cleanFreq);
      }
    }
    // Also check if item.notes explicitly states 60 months / 5 years while freq column had 3yr
    const notesLower = String(item.notes || '').toLowerCase();
    if (/60\s*(?:m|mo|mos|month|months)|5\s*(?:y|yr|yrs|year|years)/i.test(notesLower) && maxFreqMonths < 60) {
      maxFreqMonths = 60;
      sharedFreqText = '1x5yr';
    }
  }

  // Delta Dental safeguard: On Delta Dental, FMX/Pano is 1x5yr (60 months) unless notes explicitly state "36 month" or "3 year"
  if (isDeltaDental && maxFreqMonths === 36) {
    const anyExplicit3YrInNotes = fmxPanoItems.some(it => {
      const n = String(it.notes || '').replace(/freq:\s*1x3yr/gi, '').toLowerCase();
      return /36\s*(?:m|mo|mos|month|months)|(?:within|every|in|per)\s*(?:a\s*)?(?:3|three)\s*(?:-| )?(?:yr|year)/i.test(n);
    });
    if (!anyExplicit3YrInNotes) {
      maxFreqMonths = 60;
      sharedFreqText = '1x5yr';
    }
  }

  if (!sharedFreqText || maxFreqMonths <= 0) {
    sharedFreqText = '1x5yr';
    maxFreqMonths = 60;
  }
  const frequencyMonths = maxFreqMonths || 60;

  // 3. Find latest history date among ALL FMX/Pano items (checking both history_dates AND notes!)
  let latestHistoryDate = null;
  let preservedNonDateHistory = '';

  for (const item of fmxPanoItems) {
    const histStr = String(item.history_dates || '').trim();
    const datesFromHist = extractAllDates(histStr);
    if (datesFromHist.length > 0) {
      if (!latestHistoryDate || datesFromHist[0] > latestHistoryDate) {
        latestHistoryDate = datesFromHist[0];
      }
    } else if (histStr && !/^(none|no|n\/a|na|-|date not found|not found)$/i.test(histStr)) {
      preservedNonDateHistory = histStr;
    }

    // If history_dates was empty/None, also check if AI wrote "History: MM/DD/YYYY" in raw notes (excluding our own auto-generated summary)
    if (!latestHistoryDate && item.notes) {
      const rawNoteOnly = String(item.notes)
        .replace(/Shared freq[^•]*•\s*(?:Ineligible until|Eligible \(Frequency satisfied)[^•]*/gi, '')
        .trim();
      const noteHistMatch = rawNoteOnly.match(/(?:last(?:\s*service)?|history|done|claimed|fmx|pano|d0210|d0330)\s*(?:on|date|:)?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i);
      if (noteHistMatch) {
        const dtFromNote = parseDate(noteHistMatch[1]);
        if (dtFromNote) {
          latestHistoryDate = dtFromNote;
        }
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
    nextEligibleDate = addMonthsToDate(latestHistoryDate, frequencyMonths);
    formattedNextDate = formatDate(nextEligibleDate);

    // STRICT RULE: If today is before nextEligibleDate, patient is 100% INELIGIBLE
    if (today < nextEligibleDate) {
      isEligible = false;
    } else {
      isEligible = true;
    }
  } else {
    // Check if notes or non-date history explicitly say "0 remaining" / "exhausted" / "ineligible"
    const anyExhausted = fmxPanoItems.some(it =>
      /0\s*(?:service\/procedures|procedures|visits|units)?\s*remaining|exhausted|1\s*of\s*1\s*used/i.test(`${it.history_dates || ''} ${it.notes || ''}`)
    );
    if (anyExhausted) {
      isEligible = false;
    }
  }

  // 4. Synchronize each matching item with validated shared values
  fmxPanoItems.forEach(item => {
    if (item.manual_eligibility_override) return;

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
    let covStr = String(item.coverage_percentage || '').trim().toUpperCase();
    const planCoversMatch = String(item.notes || '').match(/plan\s*(?:covers|pays)\s*(\d+%)/i);
    if (covStr === '0%' && planCoversMatch) {
      item.coverage_percentage = planCoversMatch[1];
      covStr = planCoversMatch[1].toUpperCase();
    }
    const isCoveredBenefit = covStr !== '0%' && covStr !== 'NC' && !covStr.includes('NOT COVERED');

    if (!isCoveredBenefit) {
      item.is_eligible = false;
      if (!item.notes || !/not\s*covered/i.test(item.notes)) {
        item.notes = item.notes ? `${item.notes} • Not Covered` : 'Not Covered by Plan';
      }
      return;
    }

    const partnerNote = isCombo
      ? 'Shared freq D0210 & D0330'
      : (isFmxOnly ? 'Shared freq with D0330 Pano' : 'Shared freq with D0210 FMX');

    if (latestHistoryDate) {
      item.history_dates = formattedHistDate;
      item.is_eligible = isEligible;

      if (!isEligible) {
        item.notes = `${partnerNote} • Ineligible until ${formattedNextDate} (Last: ${formattedHistDate}, Freq: ${sharedFreqText})`;
      } else {
        item.notes = `${partnerNote} • Eligible (Frequency satisfied: Last service ${formattedHistDate}, Next eligible was ${formattedNextDate})`;
      }
    } else {
      item.history_dates = preservedNonDateHistory || 'None';
      item.is_eligible = isEligible;

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

    const normalizedEmail = email.trim().toLowerCase().replace(/@+/g, '@');
    const userRes = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.practice_id, u.is_active, p.name as practice_name 
       FROM dentverify.users u 
       LEFT JOIN dentverify.practices p ON u.practice_id = p.id 
       WHERE LOWER(u.email) = LOWER($1)`,
      [normalizedEmail]
    );

    if (userRes.rows.length === 0) {
      await recordAuditLog(req, 'LOGIN_FAILED', null, { email: normalizedEmail, reason: 'User not found' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'This clinic user account is deactivated.' });
    }

    let isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch && password.trim() !== password) {
      isMatch = await bcrypt.compare(password.trim(), user.password_hash);
    }
    if (!isMatch) {
      await recordAuditLog(req, 'LOGIN_FAILED', user.id, { reason: 'Password mismatch' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.role === 'owner' && !user.practice_id) {
      user.practice_name = 'Master Owner (Admin Control)';
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
    const isSecureCookie = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('dentverify_token', token, {
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: 'strict',
      path: '/',
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
  const isSecureCookie = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie('dentverify_token', {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: 'strict',
    path: '/',
  });
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ==========================================
// CLINIC PRACTICES & MULTI-TENANT MANAGEMENT
// ==========================================

// GET /api/practices (List clinics - owner sees all with counts, clinic_admin sees own clinic with counts, staff sees assigned)
app.get('/api/practices', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    if (req.user.role === 'owner') {
      const result = await db.query(`
        SELECT p.id, p.name, p.subscription_tier, p.created_at,
               (SELECT count(*)::int FROM dentverify.users u WHERE u.practice_id = p.id AND u.role != 'owner') as user_count,
               (SELECT count(*)::int FROM dentverify.verifications v WHERE v.practice_id = p.id) as verification_count
        FROM dentverify.practices p
        ORDER BY p.created_at ASC;
      `);
      return res.json({
        success: true,
        is_owner: true,
        role: req.user.role,
        active_practice_id: req.user.practice_id,
        practices: result.rows,
      });
    } else if (req.user.role === 'clinic_admin' && req.user.practice_id) {
      const result = await db.query(`
        SELECT p.id, p.name, p.subscription_tier, p.created_at,
               (SELECT count(*)::int FROM dentverify.users u WHERE u.practice_id = p.id AND u.role != 'owner') as user_count,
               (SELECT count(*)::int FROM dentverify.verifications v WHERE v.practice_id = p.id) as verification_count
        FROM dentverify.practices p
        WHERE p.id = $1;
      `, [req.user.practice_id]);
      return res.json({
        success: true,
        is_owner: false,
        role: req.user.role,
        active_practice_id: req.user.practice_id,
        practices: result.rows,
      });
    } else {
      return res.json({
        success: true,
        is_owner: false,
        role: req.user.role,
        active_practice_id: req.user.practice_id,
        practices: [{
          id: req.user.practice_id,
          name: req.user.practice_name,
        }],
      });
    }
  } catch (err) {
    console.error('Error listing practices:', err);
    res.status(500).json({ error: 'Failed to retrieve practices.' });
  }
});

// POST /api/practices (Owner creates new clinic)
app.post('/api/practices', async (req, res) => {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only the Website Owner can create new clinic workspaces.' });
  }
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Clinic name is required.' });
    }
    const defaultDir = JSON.stringify(db.DEFAULT_CLINIC_PAYER_DIRECTORY || []);
    const insertRes = await db.query(
      `INSERT INTO dentverify.practices (name, subscription_tier, payer_directory_json)
       VALUES ($1, 'pro', $2)
       RETURNING id, name, subscription_tier, created_at;`,
      [name.trim(), defaultDir]
    );
    await recordAuditLog(req, 'CREATE_PRACTICE', insertRes.rows[0].id, { name: name.trim() });
    res.json({ success: true, practice: insertRes.rows[0] });
  } catch (err) {
    console.error('Error creating practice:', err);
    res.status(500).json({ error: 'Failed to create clinic workspace.' });
  }
});

// PUT /api/practices/:id (Owner renames any clinic; Clinic Admin renames their own clinic)
app.put('/api/practices/:id', async (req, res) => {
  if (!req.user || (req.user.role !== 'owner' && req.user.role !== 'clinic_admin')) {
    return res.status(403).json({ error: 'Only the Website Owner or Clinic Administrator can update clinic workspaces.' });
  }
  try {
    const { id } = req.params;
    if (req.user.role === 'clinic_admin' && id !== req.user.practice_id) {
      return res.status(403).json({ error: 'Clinic Administrators can only update their own assigned clinic.' });
    }
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Clinic name is required.' });
    }
    const updateRes = await db.query(
      `UPDATE dentverify.practices SET name = $1 WHERE id = $2 RETURNING id, name;`,
      [name.trim(), id]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Clinic workspace not found.' });
    }
    await recordAuditLog(req, 'UPDATE_PRACTICE', id, { new_name: name.trim() });
    res.json({ success: true, practice: updateRes.rows[0] });
  } catch (err) {
    console.error('Error updating practice:', err);
    res.status(500).json({ error: 'Failed to update clinic workspace.' });
  }
});

// DELETE /api/practices/:id (Owner deletes clinic workspace)
app.delete('/api/practices/:id', async (req, res) => {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only the Website Owner can delete clinic workspaces.' });
  }
  try {
    const { id } = req.params;
    const delRes = await db.query('DELETE FROM dentverify.practices WHERE id = $1 RETURNING id, name;', [id]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: 'Clinic workspace not found.' });
    }
    await recordAuditLog(req, 'DELETE_PRACTICE', id, { deleted_name: delRes.rows[0].name });
    res.json({ success: true, deleted: delRes.rows[0] });
  } catch (err) {
    console.error('Error deleting practice:', err);
    res.status(500).json({ error: 'Failed to delete clinic workspace.' });
  }
});

// POST /api/practices/switch/:id (Owner switches active clinic session or returns to Master Owner mode)
app.post('/api/practices/switch/:id', async (req, res) => {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only the Website Owner can switch between clinic workspaces.' });
  }
  try {
    const { id } = req.params;
    if (id === 'none') {
      const token = jwt.sign(
        {
          userId: req.user.id,
          practiceId: null,
          activePracticeId: null,
          role: req.user.role,
        },
        JWT_SECRET,
        { expiresIn: '12h' }
      );
      const isSecureCookie = req.secure || req.headers['x-forwarded-proto'] === 'https';
      res.cookie('dentverify_token', token, {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: 'strict',
        path: '/',
        maxAge: 12 * 60 * 60 * 1000,
      });
      return res.json({
        success: true,
        practice_id: null,
        practice_name: 'Master Owner (Admin Control)',
      });
    }

    const pCheck = await db.query('SELECT id, name FROM dentverify.practices WHERE id = $1', [id]);
    if (pCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Clinic workspace not found.' });
    }
    const targetPractice = pCheck.rows[0];

    const token = jwt.sign(
      {
        userId: req.user.id,
        practiceId: null,
        activePracticeId: targetPractice.id,
        role: req.user.role,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    const isSecureCookie = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('dentverify_token', token, {
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: 'strict',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    });

    await recordAuditLog(req, 'SWITCH_WORKSPACE', targetPractice.id, { switched_to: targetPractice.name });
    res.json({
      success: true,
      practice_id: targetPractice.id,
      practice_name: targetPractice.name,
      active_practice: targetPractice,
    });
  } catch (err) {
    console.error('Error switching practice:', err);
    res.status(500).json({ error: 'Failed to switch workspace.' });
  }
});

// ==========================================
// USER ACCOUNTS & ASSIGNMENT MANAGEMENT
// ==========================================

// GET /api/users (Owner lists all clinic accounts; Clinic Admin lists accounts in their own clinic)
app.get('/api/users', async (req, res) => {
  if (!req.user || (req.user.role !== 'owner' && req.user.role !== 'clinic_admin')) {
    return res.status(403).json({ error: 'Access restricted to Website Owner or Clinic Administrator.' });
  }
  try {
    if (req.user.role === 'owner') {
      const result = await db.query(`
        SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.practice_id, p.name as practice_name, u.last_login_at, u.created_at,
               (SELECT count(*)::int FROM dentverify.verifications v WHERE v.user_id = u.id AND v.created_at >= CURRENT_DATE) as verified_today,
               (SELECT count(*)::int FROM dentverify.verifications v WHERE v.user_id = u.id AND v.created_at >= NOW() - INTERVAL '7 days') as verified_week,
               (SELECT count(*)::int FROM dentverify.verifications v WHERE v.user_id = u.id) as verified_total
        FROM dentverify.users u
        LEFT JOIN dentverify.practices p ON u.practice_id = p.id
        ORDER BY CASE WHEN u.role = 'owner' THEN 0 ELSE 1 END, p.name ASC NULLS FIRST,
                 CASE WHEN u.role = 'clinic_admin' THEN 0 ELSE 1 END, u.email ASC;
      `);
      return res.json({ success: true, users: result.rows });
    } else {
      const result = await db.query(`
        SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.practice_id, p.name as practice_name, u.last_login_at, u.created_at,
               (SELECT count(*)::int FROM dentverify.verifications v WHERE v.user_id = u.id AND v.created_at >= CURRENT_DATE) as verified_today,
               (SELECT count(*)::int FROM dentverify.verifications v WHERE v.user_id = u.id AND v.created_at >= NOW() - INTERVAL '7 days') as verified_week,
               (SELECT count(*)::int FROM dentverify.verifications v WHERE v.user_id = u.id) as verified_total
        FROM dentverify.users u
        LEFT JOIN dentverify.practices p ON u.practice_id = p.id
        WHERE u.practice_id = $1 AND u.role != 'owner'
        ORDER BY CASE WHEN u.role = 'clinic_admin' THEN 0 ELSE 1 END, u.email ASC;
      `, [req.user.practice_id]);
      return res.json({ success: true, users: result.rows });
    }
  } catch (err) {
    console.error('Error listing users:', err);
    res.status(500).json({ error: 'Failed to retrieve user accounts.' });
  }
});

// POST /api/users (Owner creates & assigns any user; Clinic Admin creates users inside their own clinic)
app.post('/api/users', async (req, res) => {
  if (!req.user || (req.user.role !== 'owner' && req.user.role !== 'clinic_admin')) {
    return res.status(403).json({ error: 'Access restricted to Website Owner or Clinic Administrator.' });
  }
  try {
    const { email, password, full_name, practice_id, role } = req.body;
    let targetRole = role || 'staff';
    let assignedPracticeId = practice_id;

    if (req.user.role === 'clinic_admin') {
      // Clinic Admin can only create users inside their own clinic, and never Website Owner
      assignedPracticeId = req.user.practice_id;
      if (targetRole === 'owner') targetRole = 'staff';
    } else {
      if (targetRole === 'owner') {
        assignedPracticeId = null;
      }
    }

    if (!email || !password || !full_name || (targetRole !== 'owner' && !assignedPracticeId)) {
      return res.status(400).json({ error: 'Email, password, full name, and assigned clinic are required.' });
    }
    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync(password, salt);

    const cleanCreateEmail = email.trim().toLowerCase().replace(/@+/g, '@');
    const insertRes = await db.query(`
      INSERT INTO dentverify.users (practice_id, email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, full_name, role, practice_id;
    `, [assignedPracticeId, cleanCreateEmail, hash, full_name.trim(), targetRole]);

    await recordAuditLog(req, 'CREATE_USER', insertRes.rows[0].id, { email: cleanCreateEmail, role: targetRole, practice_id: assignedPracticeId });
    res.json({ success: true, user: insertRes.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user account.' });
  }
});

// PUT /api/users/:id (Owner updates any user; Clinic Admin updates users in their own clinic)
app.put('/api/users/:id', async (req, res) => {
  if (!req.user || (req.user.role !== 'owner' && req.user.role !== 'clinic_admin')) {
    return res.status(403).json({ error: 'Access restricted to Website Owner or Clinic Administrator.' });
  }
  try {
    const { id } = req.params;
    const { email, password, full_name, practice_id, role, is_active } = req.body;

    if (req.user.role === 'clinic_admin') {
      const checkUser = await db.query('SELECT id, practice_id, role FROM dentverify.users WHERE id = $1', [id]);
      if (checkUser.rows.length === 0) {
        return res.status(404).json({ error: 'User account not found.' });
      }
      if (checkUser.rows[0].practice_id !== req.user.practice_id || checkUser.rows[0].role === 'owner') {
        return res.status(403).json({ error: 'Clinic Administrators can only manage users within their own clinic.' });
      }
    }

    let queryStr = 'UPDATE dentverify.users SET ';
    const params = [];
    const fields = [];

    if (full_name && full_name.trim()) {
      params.push(full_name.trim());
      fields.push(`full_name = $${params.length}`);
    }
    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase().replace(/@+/g, '@');
      params.push(cleanEmail);
      fields.push(`email = $${params.length}`);
    }
    if (req.user.role === 'owner' && practice_id !== undefined) {
      params.push(practice_id || null);
      fields.push(`practice_id = $${params.length}`);
    }
    if (role) {
      const allowedRole = (req.user.role === 'clinic_admin' && role === 'owner') ? 'staff' : role;
      params.push(allowedRole);
      fields.push(`role = $${params.length}`);
    }
    if (typeof is_active === 'boolean') {
      params.push(is_active);
      fields.push(`is_active = $${params.length}`);
    }
    if (password && password.trim()) {
      const salt = bcrypt.genSaltSync(12);
      const hash = bcrypt.hashSync(password.trim(), salt);
      params.push(hash);
      fields.push(`password_hash = $${params.length}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update.' });
    }

    params.push(id);
    queryStr += fields.join(', ') + ` WHERE id = $${params.length} RETURNING id, email, full_name, role, practice_id, is_active;`;

    const updateRes = await db.query(queryStr, params);
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    await recordAuditLog(req, 'UPDATE_USER', id, { updated_fields: fields });
    res.json({ success: true, user: updateRes.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'That email address is already in use by another account.' });
    }
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user account.' });
  }
});

// DELETE /api/users/:id (Owner deletes any user; Clinic Admin deletes user in their own clinic)
app.delete('/api/users/:id', async (req, res) => {
  if (!req.user || (req.user.role !== 'owner' && req.user.role !== 'clinic_admin')) {
    return res.status(403).json({ error: 'Access restricted to Website Owner or Clinic Administrator.' });
  }
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own active account.' });
    }
    if (req.user.role === 'clinic_admin') {
      const delRes = await db.query(
        `DELETE FROM dentverify.users WHERE id = $1 AND practice_id = $2 AND role != 'owner' RETURNING id`,
        [id, req.user.practice_id]
      );
      if (delRes.rows.length === 0) {
        return res.status(403).json({ error: 'Cannot delete user outside your clinic.' });
      }
    } else {
      await db.query('DELETE FROM dentverify.users WHERE id = $1', [id]);
    }
    await recordAuditLog(req, 'DELETE_USER', id);
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user account.' });
  }
});

// ==========================================
// INSURANCE DIRECTORY & SUB-PORTALS PER CLINIC
// ==========================================

// GET /api/payers (Fetch active clinic's custom directory)
app.get('/api/payers', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    if (!req.user.practice_id) {
      const firstPrac = await db.query(
        `SELECT payer_directory_json FROM dentverify.practices ORDER BY created_at ASC LIMIT 1`
      );
      const directory = firstPrac.rows[0]?.payer_directory_json || db.DEFAULT_CLINIC_PAYER_DIRECTORY;
      return res.json({
        success: true,
        payers: directory,
        practice_id: null,
        practice_name: 'Master Owner (All Clinics)',
      });
    }
    const result = await db.query(
      `SELECT payer_directory_json FROM dentverify.practices WHERE id = $1`,
      [req.user.practice_id]
    );
    const directory = result.rows[0]?.payer_directory_json || db.DEFAULT_CLINIC_PAYER_DIRECTORY;
    res.json({ success: true, payers: directory, practice_id: req.user.practice_id, practice_name: req.user.practice_name });
  } catch (err) {
    console.error('Error fetching payers:', err);
    res.status(500).json({ error: 'Failed to load clinic insurance directory.' });
  }
});

// Helper: Automatically sync edited Insurance Carrier Name, Claims Address, Phone, Payor ID, and Network Status into the clinic's Payer Directory
async function syncBreakdownInsuranceToClinicDirectory(practiceId, ins) {
  if (!practiceId || !ins || !ins.carrier) return null;
  const rawCarrier = String(ins.carrier || '').trim();
  if (!rawCarrier || /^(none|n\/a|na|-|dental insurance)$/i.test(rawCarrier)) return null;

  try {
    const res = await db.query(
      `SELECT payer_directory_json FROM dentverify.practices WHERE id = $1`,
      [practiceId]
    );
    const list = Array.isArray(res.rows[0]?.payer_directory_json) && res.rows[0].payer_directory_json.length > 0
      ? res.rows[0].payer_directory_json.slice()
      : db.DEFAULT_CLINIC_PAYER_DIRECTORY.map(x => ({ ...x }));

    const cLower = rawCarrier.toLowerCase();
    // 1. Prefer exact name/carrier match first
    let matched = list.find(p =>
      (p.name && p.name.toLowerCase().trim() === cLower) ||
      (p.carrier && p.carrier.toLowerCase().trim() === cLower)
    );

    // 2. Otherwise match by specific matchKey (excluding generic 'delta dental' if rawCarrier is a specific sub-entity like 'Delta Dental Insurance Company' or 'Delta Dental California')
    if (!matched) {
      for (const p of list) {
        if (Array.isArray(p.matchKeys)) {
          for (const k of p.matchKeys) {
            const kLower = String(k || '').toLowerCase().trim();
            if (!kLower) continue;
            if (kLower === 'delta dental' && cLower !== 'delta dental' && !cLower.includes('ppo') && !cLower.includes('national')) {
              continue;
            }
            if (cLower === kLower || cLower.includes(kLower)) {
              matched = p;
              break;
            }
          }
        }
        if (matched) break;
      }
    }

    const rawAddr = String(ins.insurance_address || '').trim();
    const hasValidAddr = rawAddr && !/^(none|n\/a|na|-)$/i.test(rawAddr) && !/1605\s+johnson\s+pl/i.test(rawAddr);
    const rawPid = String(ins.payor_id || '').trim();
    const hasValidPid = rawPid && !/^(none|n\/a|na|-)$/i.test(rawPid);
    const rawPhone = String(ins.insurance_phone || '').trim();
    const hasValidPhone = rawPhone && !/^(none|n\/a|na|-)$/i.test(rawPhone);
    const rawNet = String(ins.network_status || '').trim();
    const normNet = rawNet.toLowerCase().includes('out') ? 'Out-of-Network' : 'In-Network';

    if (matched) {
      matched.name = rawCarrier;
      matched.carrier = rawCarrier;
      if (hasValidAddr) matched.address = rawAddr;
      if (hasValidPid) matched.payorId = rawPid;
      if (hasValidPhone) matched.phone = rawPhone;
      if (rawNet) {
        matched.network = normNet;
        matched.networkStatus = normNet;
      }
      if (!Array.isArray(matched.matchKeys)) matched.matchKeys = [];
      if (!matched.matchKeys.some(k => String(k).toLowerCase() === cLower)) {
        matched.matchKeys.push(cLower);
      }
    } else {
      let parentCarrier = 'Standard Carrier';
      if (cLower.includes('delta')) parentCarrier = 'Delta Dental Ins';
      else if (cLower.includes('metlife') || cLower.includes('met life')) parentCarrier = 'MetLife';
      else if (cLower.includes('cigna')) parentCarrier = 'Cigna Healthcare';
      else if (cLower.includes('guardian')) parentCarrier = 'Guardian';
      else if (cLower.includes('aetna')) parentCarrier = 'Aetna';
      else if (cLower.includes('blue cross') || cLower.includes('bcbs') || cLower.includes('anthem')) parentCarrier = 'Blue Cross Blue Shield';

      list.push({
        id: 'payer_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        parentCarrier,
        name: rawCarrier,
        carrier: rawCarrier,
        network: normNet,
        networkStatus: normNet,
        matchKeys: [cLower],
        address: hasValidAddr ? rawAddr : 'N/A',
        phone: hasValidPhone ? rawPhone : 'N/A',
        payorId: hasValidPid ? rawPid : 'N/A',
        isCustom: true,
      });
    }

    await db.query(
      `UPDATE dentverify.practices SET payer_directory_json = $1 WHERE id = $2`,
      [JSON.stringify(list), practiceId]
    );
    return list;
  } catch (err) {
    console.warn('Could not auto-sync breakdown insurance to directory:', err.message);
    return null;
  }
}

// POST /api/payers (Save active clinic's custom directory — restricted to Clinic Admin & Website Owner)
app.post('/api/payers', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'owner' && req.user.role !== 'clinic_admin') {
    return res.status(403).json({ error: 'Only Clinic Admin or Website Owner can edit the Insurance Hub Directory.' });
  }
  try {
    const { payers, apply_all } = req.body;
    if (!Array.isArray(payers)) {
      return res.status(400).json({ error: 'Payers list must be an array.' });
    }
    if (req.user.role === 'owner' && (!req.user.practice_id || apply_all)) {
      await db.query(
        `UPDATE dentverify.practices SET payer_directory_json = $1`,
        [JSON.stringify(payers)]
      );
      await recordAuditLog(req, 'UPDATE_ALL_PAYERS_DIRECTORY', null, { count: payers.length });
      return res.json({ success: true, payers, broadcast_all: true });
    }
    await db.query(
      `UPDATE dentverify.practices SET payer_directory_json = $1 WHERE id = $2`,
      [JSON.stringify(payers), req.user.practice_id]
    );
    await recordAuditLog(req, 'UPDATE_PAYERS_DIRECTORY', req.user.practice_id, { count: payers.length });
    res.json({ success: true, payers });
  } catch (err) {
    console.error('Error saving payers:', err);
    res.status(500).json({ error: 'Failed to save clinic insurance directory.' });
  }
});

// Helper: Match a carrier string against the clinic's Insurance Hub Directory (including wired states & aliases)
function matchClinicPayerHub(carrierStr, directoryList) {
  if (!carrierStr || !Array.isArray(directoryList) || directoryList.length === 0) return null;
  const cLower = String(carrierStr).toLowerCase().trim();
  if (!cLower || /^(none|n\/a|na|-|dental insurance)$/i.test(cLower)) return null;

  // 1. Exact case-insensitive name/carrier match
  const exact = directoryList.find(p =>
    (p.name && String(p.name).toLowerCase().trim() === cLower) ||
    (p.carrier && String(p.carrier).toLowerCase().trim() === cLower)
  );
  if (exact) return exact;

  // 2. Exact wired state / alias matchKey
  for (const p of directoryList) {
    if (Array.isArray(p.matchKeys)) {
      for (const k of p.matchKeys) {
        if (String(k || '').toLowerCase().trim() === cLower) return p;
      }
    }
  }

  // 3. Specific wired state / alias substring match (prioritizing specific aliases over generic 'delta dental')
  for (const p of directoryList) {
    if (Array.isArray(p.matchKeys)) {
      for (const k of p.matchKeys) {
        const kLower = String(k || '').toLowerCase().trim();
        if (!kLower || kLower === 'delta dental') continue;
        if (cLower.includes(kLower)) return p;
      }
    }
  }

  // 4. General hub name or generic matchKey fallback
  for (const p of directoryList) {
    const pName = String(p.name || p.carrier || '').toLowerCase().trim();
    if (pName && cLower.includes(pName)) return p;
    if (Array.isArray(p.matchKeys)) {
      if (p.matchKeys.some(k => k && cLower.includes(String(k).toLowerCase().trim()))) return p;
    }
  }
  return null;
}

// ==========================================
// PERSISTENT VERIFICATION HISTORY ENDPOINTS
// ==========================================

// GET /api/verifications (List history records for active clinic, or ALL clinics when Owner is in Master Mode)
app.get('/api/verifications', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Please log in.' });
  }
  try {
    const practiceId = req.user.practice_id;
    const isOwnerGlobal = req.user.role === 'owner' && !practiceId;

    let result;
    if (isOwnerGlobal) {
      result = await db.query(`
        SELECT v.id, v.practice_id, p.name as practice_name, v.carrier, v.patient_name_enc, v.patient_name_masked,
               v.member_id_enc, v.dob_enc, v.network_status, v.created_at,
               u.full_name as verified_by_user,
               v.breakdown_json->'audit_meta'->>'verified_by_name' as audit_verified_by,
               v.breakdown_json->'audit_meta'->>'readiness_status' as readiness_status,
               v.breakdown_json->'insurance_details'->>'plan_benefits' as plan_benefits,
               v.breakdown_json->'insurance_details'->>'effective_date' as effective_date,
               v.breakdown_json->'insurance_details'->>'policy_status' as policy_status
        FROM dentverify.verifications v
        LEFT JOIN dentverify.practices p ON v.practice_id = p.id
        LEFT JOIN dentverify.users u ON v.user_id = u.id
        ORDER BY v.created_at DESC
        LIMIT 200;
      `);
    } else {
      if (!practiceId) {
        return res.json({ success: true, history: [] });
      }
      result = await db.query(`
        SELECT v.id, v.practice_id, p.name as practice_name, v.carrier, v.patient_name_enc, v.patient_name_masked,
               v.member_id_enc, v.dob_enc, v.network_status, v.created_at,
               u.full_name as verified_by_user,
               v.breakdown_json->'audit_meta'->>'verified_by_name' as audit_verified_by,
               v.breakdown_json->'audit_meta'->>'readiness_status' as readiness_status,
               v.breakdown_json->'insurance_details'->>'plan_benefits' as plan_benefits,
               v.breakdown_json->'insurance_details'->>'effective_date' as effective_date,
               v.breakdown_json->'insurance_details'->>'policy_status' as policy_status
        FROM dentverify.verifications v
        LEFT JOIN dentverify.practices p ON v.practice_id = p.id
        LEFT JOIN dentverify.users u ON v.user_id = u.id
        WHERE v.practice_id = $1
        ORDER BY v.created_at DESC
        LIMIT 100;
      `, [practiceId]);
    }

    const records = result.rows.map(row => {
      const decryptedName = db.decryptField(row.patient_name_enc);
      const decryptedDob = db.decryptField(row.dob_enc);
      const isTermed = String(row.policy_status || '').toLowerCase().includes('term');
      return {
        id: row.id,
        practice_id: row.practice_id,
        practice_name: row.practice_name || 'Master Workspace',
        carrier: row.carrier || 'Dental Insurance',
        patient_name: decryptedName || row.patient_name_masked || 'N/A',
        dob: decryptedDob || 'N/A',
        network_status: row.network_status || 'In-Network',
        plan_benefits: row.plan_benefits || 'Calendar Year',
        effective_date: row.effective_date || '01/01/2026',
        policy_status: row.policy_status || 'Active',
        verified_by: row.audit_verified_by || row.verified_by_user || 'Clinic Staff',
        readiness_status: row.readiness_status || (isTermed ? '❌ Policy Termed / Inactive' : '✅ Complete / Ready for Appointment'),
        created_at: row.created_at,
      };
    });

    await recordAuditLog(req, 'VIEW_HISTORY_LIST', null, { count: records.length, practice_id: practiceId });
    res.json({ success: true, history: records });
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ error: 'Failed to retrieve verification history.' });
  }
});

// GET /api/verifications/:id (Fetch full breakdown JSON; Owner can access any clinic's record)
app.get('/api/verifications/:id', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Please log in.' });
  }
  try {
    const { id } = req.params;
    const isOwner = req.user.role === 'owner';
    const result = isOwner
      ? await db.query(
          `SELECT v.id, v.practice_id, v.carrier, v.patient_name_enc, v.member_id_enc, v.dob_enc, v.network_status, v.breakdown_json, v.created_at,
                  u.full_name as verified_by_user
           FROM dentverify.verifications v
           LEFT JOIN dentverify.users u ON v.user_id = u.id
           WHERE v.id = $1`,
          [id]
        )
      : await db.query(
          `SELECT v.id, v.practice_id, v.carrier, v.patient_name_enc, v.member_id_enc, v.dob_enc, v.network_status, v.breakdown_json, v.created_at,
                  u.full_name as verified_by_user
           FROM dentverify.verifications v
           LEFT JOIN dentverify.users u ON v.user_id = u.id
           WHERE v.id = $1 AND v.practice_id = $2`,
          [id, req.user.practice_id]
        );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Verification record not found in active clinic workspace.' });
    }

    const row = result.rows[0];
    const breakdown = row.breakdown_json;
    breakdown.verification_id = row.id;

    // Decrypt patient details in returned JSON
    if (breakdown.insurance_details) {
      const decName = db.decryptField(row.patient_name_enc);
      breakdown.insurance_details.patient_name = decName || (breakdown.insurance_details.patient_name !== '[ENCRYPTED_AES256]' ? breakdown.insurance_details.patient_name : 'N/A');
      const decDob = row.dob_enc ? db.decryptField(row.dob_enc) : '';
      breakdown.insurance_details.dob = decDob || (breakdown.insurance_details.dob !== '[ENCRYPTED_AES256]' ? breakdown.insurance_details.dob : 'N/A');
      if (row.member_id_enc) {
        const decMember = db.decryptField(row.member_id_enc);
        if (decMember && breakdown.insurance_details.member_id === '[ENCRYPTED_AES256]') {
          breakdown.insurance_details.member_id = decMember;
        }
      }
    }

    if (Array.isArray(breakdown.procedure_codes)) {
      breakdown.procedure_codes = enforceCanonicalCdtMeanings(breakdown.procedure_codes);
      breakdown.procedure_codes = enforceSharedFmxPanoRules(breakdown.procedure_codes, breakdown.insurance_details || {});
      breakdown.procedure_codes = enforceAgeLimitAndFrequencyRules(breakdown.procedure_codes, breakdown.insurance_details || {});
    }

    if (!breakdown.audit_meta || typeof breakdown.audit_meta !== 'object') {
      const isTermed = String(breakdown.insurance_details?.policy_status || '').toLowerCase().includes('term');
      breakdown.audit_meta = {
        verified_by_name: row.verified_by_user || 'Clinic Staff',
        verified_at: row.created_at,
        readiness_status: isTermed ? '❌ Policy Termed / Inactive' : '✅ Complete / Ready for Appointment',
      };
    } else {
      if (!breakdown.audit_meta.verified_by_name) {
        breakdown.audit_meta.verified_by_name = row.verified_by_user || 'Clinic Staff';
      }
      if (!breakdown.audit_meta.verified_at) {
        breakdown.audit_meta.verified_at = row.created_at;
      }
    }

    await recordAuditLog(req, 'VIEW_BREAKDOWN_RECORD', id);
    res.json({ success: true, record: breakdown });
  } catch (err) {
    console.error('Record fetch error:', err);
    res.status(500).json({ error: 'Failed to load verification record.' });
  }
});

// PUT /api/verifications/:id (Persist inline edits to patient breakdown in PostgreSQL)
app.put('/api/verifications/:id', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Please log in.' });
  }
  try {
    const { id } = req.params;
    const { breakdown } = req.body;
    if (!breakdown || typeof breakdown !== 'object') {
      return res.status(400).json({ error: 'Valid breakdown JSON is required.' });
    }

    const ins = breakdown.insurance_details || {};
    const rawPatientName = ins.patient_name || 'N/A';
    const patientNameEnc = db.encryptField(rawPatientName);
    const maskedName = rawPatientName.length > 3
      ? `${rawPatientName[0]}*** ${rawPatientName.slice(-2)}`
      : rawPatientName;
    const dobEnc = db.encryptField(ins.dob || '');
    const carrier = ins.carrier || 'Dental Insurance';
    const networkStatus = ins.network_status || 'In-Network';

    if (!breakdown.audit_meta || typeof breakdown.audit_meta !== 'object') {
      breakdown.audit_meta = {};
    }
    if (!breakdown.audit_meta.verified_by_name) {
      breakdown.audit_meta.verified_by_name = req.user.full_name || req.user.email || 'Clinic Staff';
    }
    breakdown.audit_meta.last_edited_by = req.user.full_name || req.user.email || 'Clinic Staff';
    breakdown.audit_meta.last_edited_at = new Date().toISOString();

    const sanitizedBreakdown = sanitizeBreakdownForStorage(breakdown);

    const isOwner = req.user.role === 'owner';
    const updateRes = isOwner
      ? await db.query(
          `UPDATE dentverify.verifications
           SET carrier = $1, patient_name_enc = $2, patient_name_masked = $3, dob_enc = $4, network_status = $5, breakdown_json = $6
           WHERE id = $7 RETURNING id, practice_id;`,
          [carrier, patientNameEnc, maskedName, dobEnc, networkStatus, JSON.stringify(sanitizedBreakdown), id]
        )
      : await db.query(
          `UPDATE dentverify.verifications
           SET carrier = $1, patient_name_enc = $2, patient_name_masked = $3, dob_enc = $4, network_status = $5, breakdown_json = $6
           WHERE id = $7 AND practice_id = $8 RETURNING id, practice_id;`,
          [carrier, patientNameEnc, maskedName, dobEnc, networkStatus, JSON.stringify(sanitizedBreakdown), id, req.user.practice_id]
        );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Verification record not found or unauthorized.' });
    }
    const targetPracticeId = updateRes.rows[0].practice_id || req.user.practice_id;
    let syncedDirectory = null;
    if (req.user.role === 'owner' || req.user.role === 'clinic_admin') {
      syncedDirectory = await syncBreakdownInsuranceToClinicDirectory(targetPracticeId, ins);
    }
    await recordAuditLog(req, 'UPDATE_BREAKDOWN_RECORD', id, { carrier });
    res.json({ success: true, id, payers: syncedDirectory });
  } catch (err) {
    console.error('Record update error:', err);
    res.status(500).json({ error: 'Failed to save verification edits.' });
  }
});

// DELETE /api/verifications/:id (Soft-delete or purge; Owner can delete from any clinic)
app.delete('/api/verifications/:id', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Please log in.' });
  }
  try {
    const { id } = req.params;
    if (req.user.role === 'owner') {
      await db.query(`DELETE FROM dentverify.verifications WHERE id = $1`, [id]);
    } else {
      await db.query(`DELETE FROM dentverify.verifications WHERE id = $1 AND practice_id = $2`, [id, req.user.practice_id]);
    }
    await recordAuditLog(req, 'DELETE_BREAKDOWN_RECORD', id);
    res.json({ success: true, message: 'Record deleted successfully.' });
  } catch (err) {
    console.error('Record delete error:', err);
    res.status(500).json({ error: 'Failed to delete verification record.' });
  }
});

// ==========================================
// RESILIENT MULTI-KEY GEMINI POOL & FAILOVER
// ==========================================
const apiKeyStatusMap = new Map(); // key -> { exhaustedUntil: number, errorCount: number, successCount: number }
let keyRotationCounter = 0;

function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '***';
  if (key.length <= 10) return `${key.slice(0, 3)}...`;
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

const fs = require('fs');
const dotenv = require('dotenv');
let lastEnvMtimeMs = 0;

function syncEnvFileIfModified() {
  try {
    const envPath = path.join(__dirname, '.env');
    const stat = fs.statSync(envPath);
    if (stat.mtimeMs !== lastEnvMtimeMs) {
      lastEnvMtimeMs = stat.mtimeMs;
      dotenv.config({ path: envPath, override: true });
    }
  } catch (e) {
    // Ignore if .env is temporarily unavailable
  }
}

function getAllConfiguredGeminiApiKeys() {
  syncEnvFileIfModified();
  const keys = [];
  // 1. Check comma/semicolon/newline-separated GEMINI_API_KEYS
  if (process.env.GEMINI_API_KEYS) {
    process.env.GEMINI_API_KEYS.split(/[,;\n]+/).forEach((k) => {
      const trimmed = k.trim();
      if (trimmed && !trimmed.startsWith('your_') && !keys.includes(trimmed)) {
        keys.push(trimmed);
      }
    });
  }
  // 2. Check GEMINI_API_KEY, GEMINI_API_KEY_1 to GEMINI_API_KEY_20
  const candidateEnvNames = ['GEMINI_API_KEY', ...Array.from({ length: 20 }, (_, i) => `GEMINI_API_KEY_${i + 1}`)];
  for (const envName of candidateEnvNames) {
    const val = (process.env[envName] || '').trim();
    if (val && !val.startsWith('your_') && !keys.includes(val)) {
      keys.push(val);
    }
  }
  return keys;
}

function getPrioritizedGeminiApiKeys() {
  const allKeys = getAllConfiguredGeminiApiKeys();
  if (allKeys.length <= 1) return allKeys;

  const now = Date.now();
  const healthyKeys = [];
  const coolingKeys = [];

  for (const k of allKeys) {
    const stat = apiKeyStatusMap.get(k);
    if (!stat || stat.exhaustedUntil <= now) {
      healthyKeys.push(k);
    } else {
      coolingKeys.push({ key: k, expiresAt: stat.exhaustedUntil });
    }
  }

  // Sort cooling keys by earliest expiration
  coolingKeys.sort((a, b) => a.expiresAt - b.expiresAt);

  // Round-robin rotate healthy keys across calls to balance RPM
  let orderedHealthy = healthyKeys;
  if (healthyKeys.length > 1) {
    const startIdx = keyRotationCounter % healthyKeys.length;
    keyRotationCounter = (keyRotationCounter + 1) % healthyKeys.length;
    orderedHealthy = [...healthyKeys.slice(startIdx), ...healthyKeys.slice(0, startIdx)];
  }

  return [...orderedHealthy, ...coolingKeys.map((c) => c.key)];
}

function isGeminiQuotaOrKeyError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode;
  const msg = (err.message || '').toLowerCase();
  if (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit')
  ) {
    return true;
  }
  if (
    status === 403 &&
    (msg.includes('quota') ||
      msg.includes('exhausted') ||
      msg.includes('suspended') ||
      msg.includes('billing') ||
      msg.includes('compromised'))
  ) {
    return true;
  }
  return false;
}

function recordKeyFailure(key, cooldownSeconds = 60, errReason = '429 Quota / Rate Limit') {
  const todayStr = new Date().toISOString().slice(0, 10);
  const stat = apiKeyStatusMap.get(key) || {
    errorCount: 0,
    successCount: 0,
    todayCount: 0,
    todayDate: todayStr,
    exhaustedUntil: 0,
    lastUsedAt: null,
    lastError: null,
  };
  if (stat.todayDate !== todayStr) {
    stat.todayCount = 0;
    stat.todayDate = todayStr;
  }
  stat.errorCount++;
  stat.exhaustedUntil = Date.now() + cooldownSeconds * 1000;
  stat.lastUsedAt = new Date().toISOString();
  stat.lastError = errReason;
  apiKeyStatusMap.set(key, stat);
  console.warn(
    `⚠️ [Gemini Key Failover] Key [${maskApiKey(key)}] hit quota limit. Cooling down for ${cooldownSeconds}s (Errors: ${stat.errorCount}).`
  );
}

function recordKeySuccess(key) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const stat = apiKeyStatusMap.get(key) || {
    errorCount: 0,
    successCount: 0,
    todayCount: 0,
    todayDate: todayStr,
    exhaustedUntil: 0,
    lastUsedAt: null,
    lastError: null,
  };
  if (stat.todayDate !== todayStr) {
    stat.todayCount = 0;
    stat.todayDate = todayStr;
  }
  stat.successCount++;
  stat.todayCount++;
  stat.exhaustedUntil = 0;
  stat.lastUsedAt = new Date().toISOString();
  apiKeyStatusMap.set(key, stat);
}

// GET /api/owner/telemetry (Owner API Key Pool Monitor & Staff Productivity Leaderboard)
app.get('/api/owner/telemetry', async (req, res) => {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only Website Owner can access system telemetry.' });
  }
  try {
    const allKeys = getAllConfiguredGeminiApiKeys();
    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);

    const apiKeys = allKeys.map((key, idx) => {
      const stat = apiKeyStatusMap.get(key) || {
        errorCount: 0,
        successCount: 0,
        todayCount: 0,
        todayDate: todayStr,
        exhaustedUntil: 0,
        lastUsedAt: null,
        lastError: null,
      };
      const isCooling = stat.exhaustedUntil > now;
      const cooldownSec = isCooling ? Math.max(1, Math.ceil((stat.exhaustedUntil - now) / 1000)) : 0;
      const requestsToday = stat.todayDate === todayStr ? stat.todayCount : 0;

      return {
        slot: idx + 1,
        label: idx === 0 ? 'GEMINI_API_KEY (Primary)' : `GEMINI_API_KEY_${idx + 1} (Backup #${idx})`,
        maskedKey: maskApiKey(key),
        status: isCooling ? 'cooling' : 'active',
        cooldownRemainingSec: cooldownSec,
        requestsToday,
        totalSuccess: stat.successCount,
        quotaErrors: stat.errorCount,
        lastUsedAt: stat.lastUsedAt,
        lastError: stat.lastError,
      };
    });

    const staffRes = await db.query(`
      SELECT u.id, u.full_name, u.email, u.role, p.name as practice_name,
             (SELECT count(*)::int FROM dentverify.verifications v WHERE v.user_id = u.id AND v.created_at >= CURRENT_DATE) as verified_today,
             (SELECT count(*)::int FROM dentverify.verifications v WHERE v.user_id = u.id AND v.created_at >= NOW() - INTERVAL '7 days') as verified_week,
             (SELECT count(*)::int FROM dentverify.verifications v WHERE v.user_id = u.id) as verified_total,
             (SELECT max(v.created_at) FROM dentverify.verifications v WHERE v.user_id = u.id) as last_verified_at
      FROM dentverify.users u
      LEFT JOIN dentverify.practices p ON u.practice_id = p.id
      WHERE u.role != 'owner' OR EXISTS (SELECT 1 FROM dentverify.verifications v2 WHERE v2.user_id = u.id)
      ORDER BY verified_today DESC, verified_week DESC, verified_total DESC, u.full_name ASC;
    `);

    const totalsRes = await db.query(`
      SELECT
        count(*) FILTER (WHERE created_at >= CURRENT_DATE)::int as total_today,
        count(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int as total_week,
        count(*)::int as total_all_time
      FROM dentverify.verifications;
    `);

    const totals = totalsRes.rows[0] || { total_today: 0, total_week: 0, total_all_time: 0 };

    res.json({
      success: true,
      activeModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      apiKeys,
      staffLeaderboard: staffRes.rows,
      summary: {
        totalToday: totals.total_today || 0,
        totalWeek: totals.total_week || 0,
        totalAllTime: totals.total_all_time || 0,
        healthyKeysCount: apiKeys.filter((k) => k.status === 'active').length,
        totalKeysCount: apiKeys.length,
      },
    });
  } catch (err) {
    console.error('Error fetching owner telemetry:', err);
    res.status(500).json({ error: 'Failed to load telemetry.' });
  }
});

// POST /api/owner/api-keys/reset-cooldown (Owner resets cooldown status on all Gemini API keys)
app.post('/api/owner/api-keys/reset-cooldown', async (req, res) => {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only Website Owner can reset API key cooldowns.' });
  }
  for (const [k, stat] of apiKeyStatusMap.entries()) {
    stat.exhaustedUntil = 0;
    apiKeyStatusMap.set(k, stat);
  }
  res.json({ success: true, message: 'All Gemini API key cooldowns have been cleared.' });
});

// Verification Endpoint (Supports single or multiple files with resilient multi-key pool)
app.post('/api/verify', upload.array('files', 10), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: '🔒 Access Denied: Please sign in to your clinic workspace to run insurance verification.',
      error_type: 'AUTH_REQUIRED',
    });
  }
  try {
    const uploadedFiles = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);

    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        error: 'No file uploaded. Please upload one or more PDF, PNG, JPG, or WEBP dental breakdown files.',
      });
    }

    const availableKeys = getAllConfiguredGeminiApiKeys();
    if (availableKeys.length === 0) {
      return res.status(500).json({
        error: 'No valid Gemini API key configured on the server. Please add GEMINI_API_KEY (or GEMINI_API_KEY_2, GEMINI_API_KEY_3) to .env.',
      });
    }

    // Load active clinic's Insurance Hub Directory & Per-Clinic AI Settings BEFORE calling Gemini
    let directoryList = db.DEFAULT_CLINIC_PAYER_DIRECTORY || [];
    let clinicAiSettings = {};
    try {
      const pracQuery = req.user.practice_id
        ? await db.query('SELECT payer_directory_json, clinic_ai_settings_json FROM dentverify.practices WHERE id = $1', [req.user.practice_id])
        : await db.query('SELECT payer_directory_json, clinic_ai_settings_json FROM dentverify.practices ORDER BY created_at ASC LIMIT 1');
      if (pracQuery.rows.length > 0) {
        if (Array.isArray(pracQuery.rows[0].payer_directory_json) && pracQuery.rows[0].payer_directory_json.length > 0) {
          directoryList = pracQuery.rows[0].payer_directory_json;
        }
        if (pracQuery.rows[0].clinic_ai_settings_json && typeof pracQuery.rows[0].clinic_ai_settings_json === 'object') {
          clinicAiSettings = pracQuery.rows[0].clinic_ai_settings_json;
        }
      }
    } catch (e) {}

    const networkPreference = (req.body.network_preference || 'auto').toLowerCase();

    // Build Clinic Insurance Hub Pre-Set Network Context so Auto mode knows which carriers are In-Network vs Out-of-Network
    const hubNetworkSummary = directoryList.map(p => {
      const pName = p.name || p.carrier || 'Carrier';
      const net = (p.network || p.networkStatus || 'In-Network').toLowerCase().includes('out') ? 'Out-of-Network' : 'In-Network';
      const aliases = Array.isArray(p.matchKeys) && p.matchKeys.length > 0 ? ` (Wired states/aliases: ${p.matchKeys.join(', ')})` : '';
      const fee = p.feeSchedule && p.feeSchedule !== 'N/A' ? ` [Fee Schedule: ${p.feeSchedule}]` : '';
      return `- ${pName}${aliases} => CLINIC PRE-SET: ${net}${fee}`;
    }).join('\n');

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
        'NETWORK DIRECTIVE (AUTOMATIC CLINIC HUB WIRING): Identify the Insurance Carrier / Plan on the document and match it against this clinic\'s pre-configured Insurance Hub Network Participation list below:\n' +
        hubNetworkSummary +
        '\nIf the document\'s carrier matches an Out-of-Network hub above, strictly extract OUT-OF-NETWORK column benefits and set insurance_details.network_status to "Out-of-Network". Otherwise, extract IN-NETWORK column benefits and set insurance_details.network_status to "In-Network".';
    }

    // Use Per-Clinic AI Settings & CDT Code Checklist Sequence (with fallback to request overrides or defaults)
    const systemInstruction = (req.body.system_instruction && req.body.system_instruction.trim())
      ? req.body.system_instruction.trim()
      : (clinicAiSettings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION);

    const basePrompt = (req.body.custom_prompt && req.body.custom_prompt.trim())
      ? req.body.custom_prompt.trim()
      : (clinicAiSettings.customPrompt || DEFAULT_CDT_CODES_PROMPT);

    const activeEnabledCodes = Array.isArray(clinicAiSettings.enabledCodes) && clinicAiSettings.enabledCodes.length > 0
      ? clinicAiSettings.enabledCodes
      : DEFAULT_ENABLED_CDT_CODES;

    const checklistDirective = `\n\nCLINIC MANDATORY CDT CHECKLIST & SEQUENCE ORDER (${activeEnabledCodes.length} CODES):\n` +
      activeEnabledCodes.map((code, idx) => `${idx + 1}. ${code} — ${getCanonicalCdtMeaning(code)}`).join('\n');

    const multiFileNote = uploadedFiles.length > 1
      ? `\n\nNOTE ON MULTIPLE DOCUMENTS: The user has uploaded ${uploadedFiles.length} files/pages representing different pages or sections of the dental insurance breakdown or portal eligibility history. Cross-examine and synthesize information from ALL uploaded files to produce one unified, comprehensive audit output without omitting codes.`
      : '';

    const userPrompt = `${networkInstruction}${multiFileNote}\n\n${basePrompt}${checklistDirective}`;

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
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
    ].filter(Boolean);
    const modelsToTry = [...new Set(candidateModels)];

    async function executeWithFallback() {
      const keysToTry = getPrioritizedGeminiApiKeys();
      if (keysToTry.length === 0) {
        throw new Error('No valid Gemini API key configured in .env');
      }

      let lastError;
      for (const currentKey of keysToTry) {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        const keyLabel = maskApiKey(currentKey);

        for (const currentModel of modelsToTry) {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              console.log(
                `[Gemini Request] Calling model: ${currentModel} via Key [${keyLabel}] (Attempt ${attempt}, Files: ${uploadedFiles.length})...`
              );
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
              recordKeySuccess(currentKey);
              return { response: res, usedModel: currentModel, usedKey: keyLabel };
            } catch (err) {
              lastError = err;
              const errMsg = (err.message || '').toLowerCase();
              const isQuotaExhausted = isGeminiQuotaOrKeyError(err);

              if (isQuotaExhausted) {
                recordKeyFailure(currentKey, 60);
                console.warn(
                  `⚠️ [Gemini Quota Exceeded] Key [${keyLabel}] quota depleted or rate limited. Seamlessly failing over to next API key in pool...`
                );
                break; // Break out of model/attempt loop for this key to switch to next key immediately
              }

              const is503 = err.status === 503 || errMsg.includes('503') || errMsg.includes('high demand');
              if (is503) {
                console.warn(`[Gemini 503 Spike] Model ${currentModel} is experiencing high demand. Falling back to alternative model...`);
                break; // Try next model immediately
              }

              if (err.status === 429 && attempt < 2) {
                await new Promise((r) => setTimeout(r, 1200));
                continue;
              }
              break;
            }
          }
          if (isGeminiQuotaOrKeyError(lastError)) {
            // Key exhausted, proceed to next key in pool
            break;
          }
        }
      }
      throw lastError;
    }

    const { response, usedModel, usedKey } = await executeWithFallback();

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

    // Deterministic validation 1: Policy Termed Date, Active Status & Master Claims Hub Wiring
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

      // Match against the clinic's Wired Insurance Hub Directory (Address, Phone, Payor ID, Pre-Set Network & Fee Schedule)
      const matchedDirPayer = matchClinicPayerHub(ins.carrier, directoryList) || matchClinicPayerHub(ins.plan_name, directoryList);

      if (matchedDirPayer) {
        if (matchedDirPayer.address && matchedDirPayer.address !== 'N/A') {
          ins.insurance_address = matchedDirPayer.address;
        }
        if (matchedDirPayer.phone && matchedDirPayer.phone !== 'N/A') {
          ins.insurance_phone = matchedDirPayer.phone;
        }
        if (matchedDirPayer.payorId && matchedDirPayer.payorId !== 'N/A') {
          ins.payor_id = matchedDirPayer.payorId;
        }
        const presetNet = matchedDirPayer.network || matchedDirPayer.networkStatus;
        if (presetNet && networkPreference === 'auto') {
          ins.network_status = presetNet;
        }
        if (matchedDirPayer.feeSchedule && matchedDirPayer.feeSchedule !== 'N/A') {
          ins.fee_schedule = matchedDirPayer.feeSchedule;
        }
      } else if (ins.insurance_address && ins.insurance_address !== 'N/A') {
        // If no directory match, reject obvious residential street addresses that lack PO Box / Claims keywords
        const addrStr = String(ins.insurance_address);
        if (!/\b(p\.?\s*o\.?\s*box|box\s+\d+|claims|dept|department)\b/i.test(addrStr)) {
          ins.insurance_address = 'N/A';
        }
      }

      parsedResult.insurance_details = enforcePolicyTermedRules(parsedResult.insurance_details);
    }

    if (parsedResult && parsedResult.coverage_levels) {
      const oTerms = parsedResult.coverage_levels.ortho_payment_terms;
      if (!oTerms || /^(none|na|null|undefined|-)$/i.test(String(oTerms).trim())) {
        parsedResult.coverage_levels.ortho_payment_terms = 'N/A';
      }
    }

    // Deterministic validation 2: CDT D0210 & D0330 shared frequency, age limits & locked CDT meanings
    if (parsedResult && Array.isArray(parsedResult.procedure_codes)) {
      parsedResult.procedure_codes = enforceCanonicalCdtMeanings(parsedResult.procedure_codes);
      parsedResult.procedure_codes = enforceSharedFmxPanoRules(parsedResult.procedure_codes, parsedResult.insurance_details || {});
      parsedResult.procedure_codes = enforceAgeLimitAndFrequencyRules(parsedResult.procedure_codes, parsedResult.insurance_details || {});
    }

    // Stamp Verified By Staff Audit Meta & Appointment Readiness Status
    const isTermedPolicy = String(parsedResult?.insurance_details?.policy_status || '').toLowerCase().includes('term');
    parsedResult.audit_meta = {
      verified_by_name: req.user.full_name || req.user.email || 'Clinic Staff',
      verified_by_email: req.user.email || '',
      verified_at: new Date().toISOString(),
      readiness_status: isTermedPolicy
        ? '❌ Policy Termed / Inactive'
        : '✅ Complete / Ready for Appointment',
    };

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
      const sanitizedBreakdown = sanitizeBreakdownForStorage(parsedResult);

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
          JSON.stringify(sanitizedBreakdown),
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
        verified_by: parsedResult.audit_meta.verified_by_name,
      },
      data: parsedResult,
    });
  } catch (error) {
    console.error('Error during dental breakdown verification:', error);
    const rawMsg = (error.message || error.toString() || '').toLowerCase();
    const errStatus = error.status || error.code || null;
    let userMessage = 'An unexpected error occurred during analysis. Please try again.';
    let errorType = 'SERVER_ERROR';

    if (errStatus === 503 || rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('unavailable') || rawMsg.includes('overload')) {
      errorType = 'API_OVERLOAD';
      userMessage = 'Google Gemini API Overload (503 High Demand): High demand on Google AI models right now. Please wait 5-15 seconds and click "Analyze Breakdown" again.';
    } else if (errStatus === 429 || rawMsg.includes('429') || rawMsg.includes('quota') || rawMsg.includes('resource has been exhausted') || rawMsg.includes('rate limit')) {
      errorType = 'RATE_LIMIT';
      userMessage = 'Gemini Quota / Rate Limit Reached (429): Free request limit reached for this API key. Please wait 1-2 minutes before retrying.';
    } else if (errStatus === 403 || rawMsg.includes('api_key_invalid') || rawMsg.includes('403') || rawMsg.includes('permission denied')) {
      errorType = 'AUTH_ERROR';
      userMessage = 'Invalid API Key (403): The Gemini API key in the server configuration is invalid or missing required permissions.';
    } else if (rawMsg.includes('timeout') || errStatus === 504 || rawMsg.includes('etimedout') || rawMsg.includes('esockettimedout')) {
      errorType = 'TIMEOUT';
      userMessage = 'Processing Timeout: Document processing took longer than expected due to file size or network latency. Please try again.';
    }

    res.status(500).json({
      success: false,
      error: userMessage,
      error_type: errorType,
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
app.listen(PORT, process.env.HOST || '127.0.0.1', async () => {
  await db.initDb();
  console.log(`====================================================`);
  console.log(`Dental Insurance Verification Web App running!`);
  console.log(`Local URL: http://localhost:${PORT}`);
  console.log(`Domain:    https://dentverify.com`);
  const activeModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  console.log(`Model:     ${activeModel} (Google Gen AI SDK)`);
  const activeKeys = getAllConfiguredGeminiApiKeys();
  console.log(`API Keys:  ${activeKeys.length} key(s) loaded into failover/rotation pool`);
  console.log(`====================================================`);
});
