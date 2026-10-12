const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

// Schema tables are explicitly qualified with 'dentverify.'

// AES-256-GCM Encryption for ePHI fields (Strictly loaded from environment)
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
  console.error('❌ CRITICAL SECURITY ERROR: Valid 64-hex-char ENCRYPTION_KEY is required in .env');
}
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encryptField(text) {
  if (!text || typeof text !== 'string') return text;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Field encryption error:', err);
    return text;
  }
}

function decryptField(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.includes(':')) {
    return ciphertext;
  }
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return ciphertext;
    const [ivHex, authTagHex, encryptedHex] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return ciphertext;
  }
}

// Default hierarchical payer directory with Master Claims Hubs & Wired States
const DEFAULT_CLINIC_PAYER_DIRECTORY = [
  {
    id: 'dd_ins_hub',
    parentCarrier: 'DD Ins (Master Claims Hub)',
    carrier: 'Delta Dental Ins (DD CA / TX / PA / NY / FL / GA)',
    name: 'Delta Dental Ins (DD CA / TX / PA / NY / FL / GA)',
    matchKeys: [
      'dd ins',
      'dd ca',
      'dd tx',
      'dd pa',
      'dd ny',
      'dd fl',
      'dd ga',
      'delta dental of california',
      'delta dental of texas',
      'delta dental of pennsylvania',
      'delta dental of new york',
      'delta dental of florida',
      'delta dental ca',
      'delta ca',
    ],
    address: 'P.O. Box 997330, Sacramento, CA 95899-7330',
    phone: '(888) 335-8227',
    payorId: '94276',
    networkStatus: 'In-Network',
    feeSchedule: 'Delta Dental PPO',
    portalUrl: 'https://www.deltadentalins.com',
  },
  {
    id: 'dd_fep',
    parentCarrier: 'DD Ins (Master Claims Hub)',
    carrier: 'Delta Dental FEP (DD FEP)',
    name: 'Delta Dental FEP (DD FEP)',
    matchKeys: ['dd fep', 'delta dental fep', 'federal employees dental', 'fedvip delta'],
    address: 'P.O. Box 537007, Sacramento, CA 95853-7007',
    phone: '(855) 410-3255',
    payorId: 'FEPDD',
    networkStatus: 'Out-of-Network',
    feeSchedule: 'FEP / Standard Fee',
    portalUrl: 'https://www.deltadentalins.com',
  },
  {
    id: 'dd_ppo',
    parentCarrier: 'DD Ins (Master Claims Hub)',
    carrier: 'Delta Dental PPO / National',
    name: 'Delta Dental PPO / National',
    matchKeys: ['delta dental', 'delta ppo', 'delta premier', 'delta dental ppo'],
    address: 'P.O. Box 9051, Farmington Hills, MI 48333',
    phone: '(800) 524-0149',
    payorId: '05430',
    networkStatus: 'In-Network',
    feeSchedule: 'Delta Dental PPO',
    portalUrl: 'https://www.deltadentalins.com',
  },
  {
    id: 'cigna',
    parentCarrier: 'Cigna Healthcare',
    carrier: 'Cigna Dental DPPO',
    name: 'Cigna Dental DPPO',
    matchKeys: ['cigna', 'cigna dental', 'cigna dppo'],
    address: 'P.O. Box 188037, Chattanooga, TN 37422-8037',
    phone: '(800) 244-6224',
    payorId: '62308',
    networkStatus: 'In-Network',
    feeSchedule: 'Cigna DPPO Advantage',
    portalUrl: 'https://cignaforhcp.cigna.com',
  },
  {
    id: 'metlife',
    parentCarrier: 'MetLife',
    carrier: 'MetLife Dental PDP',
    name: 'MetLife Dental PDP',
    matchKeys: ['metlife', 'metlife dental', 'metlife pdp', 'metlife pdp plus'],
    address: 'P.O. Box 981282, El Paso, TX 79998-1282',
    phone: '(877) 638-3379',
    payorId: '65978',
    networkStatus: 'In-Network',
    feeSchedule: 'MetLife PDP Plus',
    portalUrl: 'https://dental.metlife.com',
  },
  {
    id: 'guardian',
    parentCarrier: 'Guardian',
    carrier: 'Guardian DentalGuard Preferred',
    name: 'Guardian DentalGuard Preferred',
    matchKeys: ['guardian', 'guardian dental', 'dentalguard'],
    address: 'P.O. Box 981572, El Paso, TX 79998-1572',
    phone: '(800) 541-7846',
    payorId: '64246',
    networkStatus: 'In-Network',
    feeSchedule: 'DentalGuard Preferred PPO',
    portalUrl: 'https://www.guardiananytime.com',
  },
  {
    id: 'aetna',
    parentCarrier: 'Aetna',
    carrier: 'Aetna Dental PPO',
    name: 'Aetna Dental PPO',
    matchKeys: ['aetna', 'aetna dental', 'aetna ppo'],
    address: 'P.O. Box 14094, Lexington, KY 40512-4094',
    phone: '(877) 238-6200',
    payorId: '60054',
    networkStatus: 'In-Network',
    feeSchedule: 'Aetna PPO II',
    portalUrl: 'https://www.aetna.com',
  },
];

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS dentverify;');
    await client.query('SET search_path TO dentverify, public;');

    // 1. Practices Table (Multi-tenancy per Clinic)
    await client.query(`
      CREATE TABLE IF NOT EXISTS dentverify.practices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        subscription_tier VARCHAR(50) DEFAULT 'pro',
        payer_directory_json JSONB,
        clinic_ai_settings_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE dentverify.practices
      ADD COLUMN IF NOT EXISTS payer_directory_json JSONB,
      ADD COLUMN IF NOT EXISTS clinic_ai_settings_json JSONB DEFAULT '{}'::jsonb;
    `);

    // 2. Users Table (Clinic Accounts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS dentverify.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        practice_id UUID REFERENCES dentverify.practices(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        is_active BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Payer Portal Vault (Encrypted Credentials)
    await client.query(`
      CREATE TABLE IF NOT EXISTS dentverify.payer_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        practice_id UUID REFERENCES dentverify.practices(id) ON DELETE CASCADE,
        payer_key VARCHAR(50) NOT NULL,
        username_enc TEXT NOT NULL,
        password_enc TEXT NOT NULL,
        tax_id_or_npi VARCHAR(50),
        extra_data_enc TEXT,
        status VARCHAR(50) DEFAULT 'active',
        last_used_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(practice_id, payer_key)
      );
    `);

    // 4. Verifications Table (Persistent Insurance History)
    await client.query(`
      CREATE TABLE IF NOT EXISTS dentverify.verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        practice_id UUID REFERENCES dentverify.practices(id) ON DELETE CASCADE,
        user_id UUID REFERENCES dentverify.users(id) ON DELETE SET NULL,
        source VARCHAR(50) DEFAULT 'manual_upload',
        carrier VARCHAR(255),
        patient_name_enc TEXT NOT NULL,
        patient_name_masked VARCHAR(255),
        member_id_enc TEXT,
        dob_enc TEXT,
        network_status VARCHAR(100),
        breakdown_json JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 5. Audit Logs Table (Immutable HIPAA Access Logs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS dentverify.audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        practice_id UUID REFERENCES dentverify.practices(id) ON DELETE SET NULL,
        user_id UUID REFERENCES dentverify.users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        target_id UUID,
        ip_address VARCHAR(45),
        user_agent TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed 3 Clinics & 4 Users if not yet seeded
    const existingPractices = await client.query('SELECT id, name, payer_directory_json FROM dentverify.practices ORDER BY created_at ASC;');
    const defaultDirJson = JSON.stringify(DEFAULT_CLINIC_PAYER_DIRECTORY);

    let clinic1Id, clinic2Id, clinic3Id;

    if (existingPractices.rows.length === 0) {
      const c1 = await client.query(
        `INSERT INTO dentverify.practices (name, subscription_tier, payer_directory_json) VALUES ($1, 'pro', $2) RETURNING id;`,
        ['Clinic 1', defaultDirJson]
      );
      clinic1Id = c1.rows[0].id;
    } else {
      clinic1Id = existingPractices.rows[0].id;
      if (existingPractices.rows[0].name === 'DentVerify Dental Clinic' || existingPractices.rows[0].name === 'Clinic 1 (Primary Workspace)') {
        await client.query(`UPDATE dentverify.practices SET name = 'Clinic 1' WHERE id = $1`, [clinic1Id]);
      }
      if (!existingPractices.rows[0].payer_directory_json) {
        await client.query(`UPDATE dentverify.practices SET payer_directory_json = $1 WHERE id = $2`, [defaultDirJson, clinic1Id]);
      }
    }

    if (existingPractices.rows.length < 2) {
      const c2 = await client.query(
        `INSERT INTO dentverify.practices (name, subscription_tier, payer_directory_json) VALUES ($1, 'pro', $2) RETURNING id;`,
        ['Clinic 2', defaultDirJson]
      );
      clinic2Id = c2.rows[0].id;
    } else {
      clinic2Id = existingPractices.rows[1].id;
      if (existingPractices.rows[1].name === 'Clinic 2 Workspace' || existingPractices.rows[1].name === 'Clinic 2 (Branch Workspace)') {
        await client.query(`UPDATE dentverify.practices SET name = 'Clinic 2' WHERE id = $1`, [clinic2Id]);
      }
      if (!existingPractices.rows[1].payer_directory_json) {
        await client.query(`UPDATE dentverify.practices SET payer_directory_json = $1 WHERE id = $2`, [defaultDirJson, clinic2Id]);
      }
    }

    if (existingPractices.rows.length < 3) {
      const c3 = await client.query(
        `INSERT INTO dentverify.practices (name, subscription_tier, payer_directory_json) VALUES ($1, 'pro', $2) RETURNING id;`,
        ['Clinic 3', defaultDirJson]
      );
      clinic3Id = c3.rows[0].id;
    } else {
      clinic3Id = existingPractices.rows[2].id;
      if (existingPractices.rows[2].name === 'Clinic 3 Workspace' || existingPractices.rows[2].name === 'Clinic 3 (Partner Workspace)') {
        await client.query(`UPDATE dentverify.practices SET name = 'Clinic 3' WHERE id = $1`, [clinic3Id]);
      }
      if (!existingPractices.rows[2].payer_directory_json) {
        await client.query(`UPDATE dentverify.practices SET payer_directory_json = $1 WHERE id = $2`, [defaultDirJson, clinic3Id]);
      }
    }

    // Fix any accidental double-@ typo in user emails (e.g. admin@@dentverify.com -> admin@dentverify.com)
    await client.query(`UPDATE dentverify.users SET email = REGEXP_REPLACE(email, '@+', '@', 'g') WHERE email LIKE '%@@%';`);

    // Ensure Website Owner role is unassigned to any single clinic so Master Owner mode works
    await client.query(`UPDATE dentverify.users SET practice_id = NULL WHERE role = 'owner';`);

    // Purge any unused default demo/seed accounts that had public passwords in legacy builds
    await client.query(`
      DELETE FROM dentverify.users
      WHERE email IN (
        'clinic1@dentverify.com',
        'staff1@dentverify.com',
        'staff2@dentverify.com',
        'clinic2@dentverify.com',
        'c2user1@dentverify.com',
        'clinic3@dentverify.com',
        'c3user1@dentverify.com'
      ) AND last_login_at IS NULL;
    `);

    console.log('✅ PostgreSQL: DentVerify multi-clinic schema & security checks initialized.');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDb,
  encryptField,
  decryptField,
  DEFAULT_CLINIC_PAYER_DIRECTORY,
};
