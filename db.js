const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

// Schema tables are explicitly qualified with 'dentverify.'


// AES-256-GCM Encryption for ePHI fields
const ENCRYPTION_KEY = Buffer.from(
  process.env.ENCRYPTION_KEY || '169bfea936320e075cfceb0d8e26941dab0790c72bf50ece5df379ac8546ea6f',
  'hex'
);

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

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS dentverify;');
    await client.query('SET search_path TO dentverify, public;');

    // 1. Practices Table (Multi-tenancy)
    await client.query(`
      CREATE TABLE IF NOT EXISTS dentverify.practices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        subscription_tier VARCHAR(50) DEFAULT 'pro',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
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

    // Ensure Default Practice & Demo Staff User for Smooth Initial Access
    const practiceRes = await client.query(`
      INSERT INTO dentverify.practices (name, subscription_tier)
      VALUES ('DentVerify Dental Clinic', 'enterprise')
      ON CONFLICT DO NOTHING
      RETURNING id;
    `);

    let practiceId;
    if (practiceRes.rows.length > 0) {
      practiceId = practiceRes.rows[0].id;
    } else {
      const p = await client.query('SELECT id FROM dentverify.practices LIMIT 1;');
      practiceId = p.rows[0]?.id;
    }

    if (practiceId) {
      // Default Admin/Staff credentials: admin@dentverify.com / ClinicAdmin2026!
      const bcrypt = require('bcryptjs');
      const salt = bcrypt.genSaltSync(12);
      const hash = bcrypt.hashSync('ClinicAdmin2026!', salt);

      await client.query(`
        INSERT INTO dentverify.users (practice_id, email, password_hash, full_name, role)
        VALUES ($1, 'admin@dentverify.com', $2, 'Dr. Dental Administrator', 'admin')
        ON CONFLICT (email) DO NOTHING;
      `, [practiceId, hash]);
    }

    console.log('✅ PostgreSQL: DentVerify schema & tables initialized successfully.');
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
};
