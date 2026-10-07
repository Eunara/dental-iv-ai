# DentVerify AI (Dental Insurance Verification & CDT Audit Engine)

DentVerify AI is a lightweight, production-ready Dental Insurance Verification and Revenue Cycle Management (RCM) web application powered by **Google Gemini AI** (`@google/genai`) and a Vanilla HTML5/CSS3/JavaScript frontend with an Express backend.

It automatically audits dental breakdown PDFs, scanned benefit letters, and insurance web portal eligibility screenshots (Delta Dental, MetLife, Cigna, Guardian, Availity, etc.) and extracts complete coverage tiers, financials, and 48+ CDT clinical procedure codes with frequency rules, history dates, downgrades, and PMS note generation.

---

## Features

- **Multi-Document & Screenshot Support**: Upload multiple portal pages or PDF breakdowns simultaneously.
- **Network Tier Selection**: Choose between *Auto-Detect*, *In-Network (PPO/Premier)*, or *Out-of-Network* to force benefits extraction from the appropriate column.
- **Patient Verification Tracking**: Track verified patients safely (strictly omits sensitive DOB, SSN, and member IDs).
- **Comprehensive CDT Procedure Code Table**:
  - Diagnostic & Preventive (D0120, D1110, D0210, D0274, D1206, etc.)
  - Periodontics (D4341, D4342, D4910, D4381)
  - Restorative (Amalgam D2140-D2161, Composites D2330-D2394)
  - Major Prosthodontics (Crowns D2740-D2790, Implants D6010, Dentures D5110-D5214)
  - Endodontics (D3310-D3330)
  - Oral Surgery (D7140, D7210, D7220-D7240, Sedation D9222/D9223)
  - Orthodontics (D8080, D8090, D8670)
- **Clinical Caveat & Rule Detection**: Missing tooth clause, waiting periods, posterior composite amalgam downgrades, and shared frequency rules (e.g., D4346 shared with D1110).
- **Single-Click "Copy PMS Note"**: Clean, pre-formatted clinical note ready for Dentrix, Eaglesoft, Open Dental, or Curve Hero.
- **Client-Side Verification History**: Review up to 40 previous patient audits anytime without re-uploading documents.
- **Customizable AI Directives**: In-browser AI settings modal with localStorage persistence for custom clinical prompts and role instructions.

---

## Tech Stack

- **Backend**: Node.js, Express, `multer` (in-memory buffer processing), `dotenv`, and `@google/genai`.
- **AI Model**: Google Gemini Flash (`gemini-3.5-flash-lite` / `gemini-3.8-flash`) with structured JSON schema output (`application/json`).
- **Frontend**: Clean healthcare dashboard built with Vanilla Stack (HTML5, Modern CSS, Plain JavaScript - zero build tools required).

---

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/dentverify-ai.git
cd dentverify-ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and add your **Google Gemini API Key**:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```
> Get a free API key at [Google AI Studio](https://aistudio.google.com/).

### 4. Start the application
```bash
# Start locally
node server.js

# Or with PM2 for production
pm2 start server.js --name "dentverify"
```

Open your browser and navigate to `http://localhost:3000`.

---

## Security & Privacy Note
- Documents are processed in an **ephemeral in-memory buffer** and never permanently stored on the server disk.
- Date of Birth (DOB) and Social Security Numbers (SSN) are explicitly omitted from AI extraction outputs for data privacy.

---

## License
MIT License
