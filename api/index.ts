// SafeSignal PH v1.0.1
import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import webpush from 'web-push';

// VAPID keys for Web Push (set in Vercel env vars)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BODUL6wNT8YyVp5WL0Q-uLqPZVd8q2lnR9d1v1XLW3ykrWHx0MCqhlOIFgAImAgaBx6rU2KYWmBlgX71dlgCl1o';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'bpPPRubMXNCQSiW7K_edavPdZ8cIT-yVhnPbIHOXtoo';
webpush.setVapidDetails('mailto:admin@pasay.safesignal.ph', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Database ──────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://postgres.royymgtupuecnxqhnzle:RespondPH_Pilot2025@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
});

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

let seeded = false;
async function initDb(): Promise<void> {
  if (seeded) return;
  try {
    await pool.query('SELECT 1');

    // === PRIORITY FIX: Run PNP-002/002B cleanup FIRST, in own try-catch ===
    // DEF-08: rename officer PNP-102 "Maria Santos" to "Rosa Santos" to avoid name collision with demo citizen
    try {
      await pool.query(`UPDATE officers SET full_name = 'Rosa Santos' WHERE badge_number = 'PNP-102' AND full_name = 'Maria Santos'`);
    } catch {}
    // DEF-09: soft-delete API Test User citizen (hide from pilot-facing views)
    try {
      await pool.query(`UPDATE citizens SET is_suspended = true, suspension_reason = 'Test account — not a real citizen' WHERE phone = '09881234001' AND full_name = 'API Test User'`);
    } catch {}
    try {
      const ghost = await pool.query(`SELECT id FROM officers WHERE badge_number = 'PNP-002B'`);
      if (ghost.rows.length > 0) {
        const ghostId = ghost.rows[0].id;
        const real = await pool.query(`SELECT id FROM officers WHERE badge_number = 'PNP-002'`);
        const realId = real.rows.length > 0 ? real.rows[0].id : null;
        await pool.query(`UPDATE officers SET email = 'ghost-002b@removed.local', is_active = 0 WHERE id = $1`, [ghostId]);
        if (realId) {
          await pool.query(`UPDATE sos_alerts SET assigned_officer_id = $1 WHERE assigned_officer_id = $2`, [realId, ghostId]);
        }
        console.log('[SafeSignal] PNP-002B ghost neutralized');
      }
      const officerFixHash = await bcrypt.hash('password123', 10);
      await pool.query(`UPDATE officers SET role = 'OFFICER', email = 'officer@pasay.safesignal.ph', password_hash = $1, is_active = 1 WHERE badge_number = 'PNP-002'`, [officerFixHash]);
      console.log('[SafeSignal] PNP-002 force-corrected');
    } catch (fixErr) {
      console.error('[SafeSignal] PNP-002 fix error:', fixErr);
    }
    // ── Phase 1: base tables with no cross-table FK (run in parallel) ──────────
    await Promise.all([
      pool.query(`CREATE TABLE IF NOT EXISTS stations (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, barangay TEXT, latitude FLOAT, longitude FLOAT, contact_number TEXT, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000))`),
      pool.query(`CREATE TABLE IF NOT EXISTS citizens (id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, address TEXT, barangay TEXT, city TEXT, pin_hash TEXT NOT NULL, photo_url TEXT, verified BOOL DEFAULT false, strike_count INT DEFAULT 0, is_suspended BOOL DEFAULT false, suspension_reason TEXT, registered_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000), last_active BIGINT)`),
    ]);
    // ── Phase 2: tables that depend on stations or citizens ───────────────────
    await Promise.all([
      pool.query(`CREATE TABLE IF NOT EXISTS station_settings (id SERIAL PRIMARY KEY, station_id INT UNIQUE REFERENCES stations(id), surge_threshold INT DEFAULT 5, surge_window_minutes INT DEFAULT 2, cooldown_minutes INT DEFAULT 10, strike_limit INT DEFAULT 2)`),
      pool.query(`CREATE TABLE IF NOT EXISTS officers (id SERIAL PRIMARY KEY, station_id INT REFERENCES stations(id), badge_number TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'DISPATCHER', password_hash TEXT NOT NULL, is_active BOOL DEFAULT true, last_login BIGINT, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000))`),
      pool.query(`CREATE TABLE IF NOT EXISTS citizen_trust_scores (id SERIAL PRIMARY KEY, citizen_id INT UNIQUE REFERENCES citizens(id), score INT DEFAULT 100, total_alerts INT DEFAULT 0, false_alarms INT DEFAULT 0, resolved_emergencies INT DEFAULT 0, last_updated BIGINT)`),
      pool.query(`CREATE TABLE IF NOT EXISTS otp_codes (id SERIAL PRIMARY KEY, citizen_id INT REFERENCES citizens(id), code TEXT NOT NULL, expires_at BIGINT)`),
    ]);
    // ── Phase 3: tables that depend on officers ───────────────────────────────
    await Promise.all([
      pool.query(`CREATE TABLE IF NOT EXISTS sos_alerts (id SERIAL PRIMARY KEY, citizen_id INT REFERENCES citizens(id), lat FLOAT NOT NULL, lng FLOAT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', triggered_at BIGINT, acknowledged_at BIGINT, resolved_at BIGINT, cancelled_at BIGINT, location_accuracy FLOAT, assigned_officer_id INT REFERENCES officers(id), is_suspicious BOOL DEFAULT false, suspicious_reason TEXT, notes TEXT, cancellation_reason TEXT)`),
      pool.query(`CREATE TABLE IF NOT EXISTS officer_locations (officer_id INT UNIQUE REFERENCES officers(id), lat FLOAT, lng FLOAT, heading FLOAT, status TEXT DEFAULT 'ON_DUTY', updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000))`),
      pool.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (id SERIAL PRIMARY KEY, officer_id INT REFERENCES officers(id), endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000))`),
    ]);
    // ── Phase 4: tables that depend on sos_alerts ─────────────────────────────
    await pool.query(`CREATE TABLE IF NOT EXISTS alert_location_history (id SERIAL PRIMARY KEY, alert_id INT REFERENCES sos_alerts(id), lat FLOAT NOT NULL, lng FLOAT NOT NULL, recorded_at BIGINT)`);
    // ── Phase 5: column additions + type migrations
    // CRITICAL: DDL on the same table MUST run sequentially (PostgreSQL exclusive locks).
    // Different tables can run in parallel safely.
    await Promise.all([
      // officer_locations — 3 sequential column adds
      pool.query(`ALTER TABLE officer_locations ADD COLUMN IF NOT EXISTS heading FLOAT`)
        .then(() => pool.query(`ALTER TABLE officer_locations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ON_DUTY'`))
        .then(() => pool.query(`ALTER TABLE officer_locations ADD COLUMN IF NOT EXISTS updated_at BIGINT`)),
      // citizens — column adds then type migrations, all sequential on same table
      pool.query(`ALTER TABLE citizens ADD COLUMN IF NOT EXISTS gov_id_type TEXT`)
        .then(() => pool.query(`ALTER TABLE citizens ADD COLUMN IF NOT EXISTS gov_id_number TEXT`))
        .then(() => pool.query(`ALTER TABLE citizens ADD COLUMN IF NOT EXISTS gov_id_photo TEXT`))
        .then(() => pool.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='citizens' AND column_name='is_suspended' AND data_type='integer') THEN ALTER TABLE citizens ALTER COLUMN is_suspended TYPE BOOLEAN USING (is_suspended::integer != 0); END IF; END $$`))
        .then(() => pool.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='citizens' AND column_name='verified' AND data_type='integer') THEN ALTER TABLE citizens ALTER COLUMN verified TYPE BOOLEAN USING (verified::integer != 0); END IF; END $$`)),
      // sos_alerts — column adds sequential on same table
      pool.query(`ALTER TABLE sos_alerts ADD COLUMN IF NOT EXISTS incident_photo TEXT`),
      // officers — duty_status and phone for nearby-officers feature
      pool.query(`ALTER TABLE officers ADD COLUMN IF NOT EXISTS duty_status TEXT DEFAULT 'ON_DUTY'`)
        .then(() => pool.query(`ALTER TABLE officers ADD COLUMN IF NOT EXISTS phone TEXT`)),
    ]);
    // ── Phase 6: indexes (all idempotent, run in parallel) ────────────────────
    await Promise.all([
      pool.query(`CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_alerts(status)`),
      pool.query(`CREATE INDEX IF NOT EXISTS idx_sos_triggered ON sos_alerts(triggered_at)`),
      pool.query(`CREATE INDEX IF NOT EXISTS idx_sos_citizen ON sos_alerts(citizen_id)`),
      pool.query(`CREATE INDEX IF NOT EXISTS idx_sos_officer ON sos_alerts(assigned_officer_id)`),
      pool.query(`CREATE INDEX IF NOT EXISTS idx_citizens_phone ON citizens(phone)`),
    ]);
    const stationResult = await pool.query(`
      INSERT INTO stations (name, barangay, latitude, longitude, contact_number)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, ['Pasay City Police Station', 'Pasay City', 14.5378, 120.9932, '+63-2-8551-0000']);
    const stationId = stationResult.rows[0].id;
    await pool.query(`
      INSERT INTO station_settings (station_id, surge_threshold, surge_window_minutes, cooldown_minutes, strike_limit)
      VALUES ($1, 5, 2, 10, 2)
      ON CONFLICT (station_id) DO NOTHING
    `, [stationId]);
    const officers = [
      { badge: 'PNP-001', email: 'dispatcher@pasay.safesignal.ph', full_name: 'Maria Lopez', role: 'DISPATCHER' },
      { badge: 'PNP-002', email: 'officer@pasay.safesignal.ph', full_name: 'Carlos Mendoza', role: 'OFFICER' },
      { badge: 'PNP-ADM', email: 'admin@pasay.safesignal.ph', full_name: 'Chief Antonio Reyes', role: 'STATION_ADMIN' },
    ];
    for (const officer of officers) {
      const existing = await pool.query('SELECT id FROM officers WHERE badge_number = $1', [officer.badge]);
      if (existing.rows.length === 0) {
        const passwordHash = await bcrypt.hash('password123', 10);
        await pool.query(`
          INSERT INTO officers (station_id, badge_number, email, full_name, role, password_hash, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, 1)
        `, [stationId, officer.badge, officer.email, officer.full_name, officer.role, passwordHash]);
        console.log('[SafeSignal] Seeded officer:', officer.badge);
      }
    }
    // Seed demo citizen account — always reset to verified/active on cold start
    // Try BOOLEAN literals (post-migration columns), fall back to INTEGER (pre-migration)
    try {
      await pool.query(`
        INSERT INTO citizens (full_name, phone, address, barangay, city, pin_hash, verified, strike_count, is_suspended)
        VALUES ('Demo Citizen', '09171234567', '123 Leveriza St', 'Barangay 76', 'Pasay City', $1, true, 0, false)
        ON CONFLICT (phone) DO UPDATE
          SET pin_hash = EXCLUDED.pin_hash,
              verified = true,
              is_suspended = false,
              suspension_reason = NULL,
              strike_count = 0
      `, [hashPin('1234')]);
    } catch {
      await pool.query(`
        INSERT INTO citizens (full_name, phone, address, barangay, city, pin_hash, verified, strike_count, is_suspended)
        VALUES ('Demo Citizen', '09171234567', '123 Leveriza St', 'Barangay 76', 'Pasay City', $1, 1, 0, 0)
        ON CONFLICT (phone) DO UPDATE
          SET pin_hash = EXCLUDED.pin_hash,
              verified = 1,
              is_suspended = 0,
              suspension_reason = NULL,
              strike_count = 0
      `, [hashPin('1234')]);
    }
    // Also ensure trust score row exists for demo citizen
    await pool.query(`
      INSERT INTO citizen_trust_scores (citizen_id, score, total_alerts, false_alarms, resolved_emergencies)
      SELECT id, 100, 0, 0, 0 FROM citizens WHERE phone = '09171234567'
      ON CONFLICT (citizen_id) DO NOTHING
    `);
    console.log('[SafeSignal] Demo citizen ensured: 09171234567 / PIN 1234 (verified, active)');
        seeded = true;
    console.log('[SafeSignal] initDb complete');
  } catch (err) {
    console.error('[SafeSignal] initDb error:', err);
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'safesignal-ph-secret-key-2024';

interface CitizenPayload { type: 'citizen'; id: number; phone: string; }
interface OfficerPayload { type: 'officer'; id: number; email: string; role: string; badge_number: string; }

function signCitizenToken(p: Omit<CitizenPayload, 'type'>): string {
  return jwt.sign({ type: 'citizen', ...p }, JWT_SECRET, { expiresIn: '7d' });
}
function signOfficerToken(p: Omit<OfficerPayload, 'type'>): string {
  return jwt.sign({ type: 'officer', ...p }, JWT_SECRET, { expiresIn: '24h' });
}
function verifyToken(token: string): CitizenPayload | OfficerPayload | null {
  try { return jwt.verify(token, JWT_SECRET) as any; } catch { return null; }
}
function extractToken(req: any): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  if (req.query?.token && typeof req.query.token === 'string') return req.query.token;
  return null;
}
function requireOfficerAuth(req: any, res: any, next: any): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ error: 'No token provided' }); return; }
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'officer') { res.status(401).json({ error: 'Invalid or expired token' }); return; }
  req.officer = payload;
  next();
}
function requireAdminAuth(req: any, res: any, next: any): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ error: 'No token provided' }); return; }
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'officer') { res.status(401).json({ error: 'Invalid or expired token' }); return; }
  if ((payload as OfficerPayload).role !== 'STATION_ADMIN') { res.status(403).json({ error: 'Admin access required' }); return; }
  req.officer = payload;
  next();
}
function requireCitizenAuth(req: any, res: any, next: any): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ error: 'No token provided' }); return; }
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'citizen') { res.status(401).json({ error: 'Invalid or expired token' }); return; }
  req.citizen = payload;
  next();
}

// ── SSE ───────────────────────────────────────────────────────────────────────
const sseClients: Map<string, any> = new Map();
function addSSEClient(req: any, res: any): void {
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);
  sseClients.set(clientId, { id: clientId, res });
  req.on('close', () => { sseClients.delete(clientId); });
}
function broadcastEvent(eventType: string, data: unknown): void {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const dead: string[] = [];
  for (const [id, client] of Array.from(sseClients.entries())) {
    try { client.res.write(payload); } catch { dead.push(id); }
  }
  for (const id of dead) sseClients.delete(id);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; lockUntil: number }>();
function recordFailedAttempt(key: string): void {
  const current = loginAttempts.get(key) || { count: 0, lockUntil: 0 };
  current.count += 1;
  if (current.count >= 5) { current.lockUntil = Date.now() + 60 * 1000; current.count = 0; }
  loginAttempts.set(key, current);
}
function normalizeAlert(a: any): any { const r = { ...a }; delete r.password_hash; return r; }
function normalizeCitizen(c: any): any { const r = { ...c }; delete r.pin_hash; return r; }
async function getFullAlert(alertId: any): Promise<any> {
  const r = await pool.query(`SELECT a.*, c.full_name, c.phone, c.barangay, c.address, c.photo_url, c.strike_count, c.is_suspended, t.score as trust_score, t.total_alerts, t.false_alarms, t.resolved_emergencies, o.full_name as officer_name, o.badge_number as officer_badge FROM sos_alerts a JOIN citizens c ON a.citizen_id = c.id LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id LEFT JOIN officers o ON a.assigned_officer_id = o.id WHERE a.id = $1`, [alertId]);
  return r.rows[0] ? normalizeAlert(r.rows[0]) : null;
}
async function getAlertWithCitizen(alertId: any): Promise<any> {
  const r = await pool.query(`SELECT a.*, c.full_name, c.phone, c.barangay, c.address, c.photo_url, c.strike_count, c.is_suspended, t.score as trust_score, o.full_name as officer_name, o.badge_number as officer_badge FROM sos_alerts a JOIN citizens c ON a.citizen_id = c.id LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id LEFT JOIN officers o ON a.assigned_officer_id = o.id WHERE a.id = $1`, [alertId]);
  return r.rows[0] || null;
}

// ── Web Push helper ───────────────────────────────────────────────────────────
async function sendPushToOfficers(officerIds: number[], payload: object): Promise<void> {
  try {
    const subs = await pool.query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE officer_id = ANY($1)',
      [officerIds]
    );
    await Promise.allSettled(
      subs.rows.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
      )
    );
  } catch (err) { console.error('[SafeSignal] sendPush error:', err); }
}

// Cold-start init
initDb().catch(err => console.error('[SafeSignal] Cold-start initDb error:', err));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// ── Web Push routes ───────────────────────────────────────────────────────────
// GET /api/push/vapid-public-key
app.get('/api/push/vapid-public-key', (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/officer/push-subscribe
app.post('/api/officer/push-subscribe', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'endpoint and keys (p256dh, auth) are required' });
    }
    const officerId = (req.officer as OfficerPayload).id;
    await pool.query(
      `INSERT INTO push_subscriptions (officer_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET officer_id = $1, p256dh = $3, auth = $4`,
      [officerId, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ ok: true });
  } catch (err) { console.error('[SafeSignal] push-subscribe error:', err); res.status(500).json({ error: 'Failed to save subscription' }); }
});

// DELETE /api/officer/push-unsubscribe
app.delete('/api/officer/push-unsubscribe', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Failed to remove subscription' }); }
});

// ── SSE endpoint ──────────────────────────────────────────────────────────────
app.get('/api/dispatch/events', requireOfficerAuth, (req, res) => addSSEClient(req, res));

// ─────────────────────────── DISPATCH ROUTES ─────────────────────────────────

// POST /api/dispatch/login
app.post('/api/dispatch/login', async (req: any, res: any) => {
  try {
    const { email, password, badge_number } = req.body;
    if (!email || !password || !badge_number) {
      res.status(400).json({ error: 'email, password, and badge_number are required' }); return;
    }
    const attemptKey = email.toLowerCase();
    const attempts = loginAttempts.get(attemptKey);
    if (attempts && attempts.lockUntil > Date.now()) {
      const remaining = Math.ceil((attempts.lockUntil - Date.now()) / 1000);
      res.status(429).json({ error: `Too many attempts. Try again in ${remaining} seconds.` }); return;
    }
    const or = await pool.query(
      `SELECT * FROM officers WHERE email = $1 AND badge_number = $2`,
      [email, badge_number]
    );
    const officer = or.rows[0];
    if (!officer || !officer.is_active) { recordFailedAttempt(attemptKey); res.status(401).json({ error: 'Invalid credentials' }); return; }
    const valid = await bcrypt.compare(password, officer.password_hash);
    if (!valid) { recordFailedAttempt(attemptKey); res.status(401).json({ error: 'Invalid credentials' }); return; }
    loginAttempts.delete(attemptKey);
    await pool.query('UPDATE officers SET last_login = $1 WHERE id = $2', [Date.now(), officer.id]);
    const rememberMe = req.body.remember === true;
    const tokenExpiry = rememberMe ? '30d' : '24h';
    const token = jwt.sign({ type: 'officer', id: officer.id, email: officer.email, role: officer.role, badge_number: officer.badge_number }, process.env.JWT_SECRET || 'safesignal-secret-2025', { expiresIn: tokenExpiry });
    const stationResult = await pool.query('SELECT * FROM stations WHERE id = $1', [officer.station_id]);
    res.json({ token, officer: { id: officer.id, full_name: officer.full_name, badge_number: officer.badge_number, role: officer.role, email: officer.email, station: stationResult.rows[0] } });
  } catch (error) { console.error('Login error:', error); res.status(500).json({ error: 'Failed to process login' }); }
});

// POST /api/dispatch/register
app.post('/api/dispatch/register', async (req: any, res: any) => {
  try {
    const { full_name, email, badge_number, password, role } = req.body;
    if (!full_name || !email || !badge_number || !password) {
      res.status(400).json({ error: 'full_name, email, badge_number, and password are required' }); return;
    }
    const allowedRoles = ['OFFICER', 'DISPATCHER'];
    const assignedRole = allowedRoles.includes(role) ? role : 'OFFICER';

    // Check for duplicate email or badge_number
    const existing = await pool.query(
      'SELECT id FROM officers WHERE email = $1 OR badge_number = $2',
      [email, badge_number]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email or badge number already exists.' }); return;
    }

    // Get station
    const stationResult = await pool.query('SELECT id FROM stations LIMIT 1');
    let stationId: number;
    if (stationResult.rows.length > 0) {
      stationId = stationResult.rows[0].id;
    } else {
      const newStation = await pool.query(
        `INSERT INTO stations (name, barangay, contact_number) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        ['Pasay City Police Station', 'Pasay City', '(02) 833-0000']
      );
      stationId = newStation.rows[0].id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO officers (full_name, email, badge_number, station_id, role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id, full_name, email, badge_number, role`,
      [full_name, email, badge_number, stationId, assignedRole, passwordHash]
    );
    res.status(201).json({ message: 'Account created successfully.', officer: result.rows[0] });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// GET /api/dispatch/alerts
app.get('/api/dispatch/alerts', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const { status, all } = req.query;
    let query = `SELECT a.*, c.full_name, c.phone, c.barangay, c.address, c.photo_url, c.strike_count, c.is_suspended, t.score as trust_score, o.full_name as officer_name, o.badge_number as officer_badge FROM sos_alerts a JOIN citizens c ON a.citizen_id = c.id LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id LEFT JOIN officers o ON a.assigned_officer_id = o.id`;
    const params: any[] = [];
    if (status) {
      query += ' WHERE a.status = $1'; params.push(status);
    } else if (!all) {
      query += " WHERE a.status IN ('ACTIVE', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE')";
    }
    query += ' ORDER BY a.triggered_at DESC';
    const result = await pool.query(query, params);
    res.json({ alerts: result.rows.map(normalizeAlert) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch alerts' }); }
});

// GET /api/dispatch/alerts/export
app.get('/api/dispatch/alerts/export', requireOfficerAuth, async (_req: any, res: any) => {
  try {
    const result = await pool.query(`SELECT a.id, c.full_name, c.phone, c.barangay, a.status, a.triggered_at, a.acknowledged_at, a.resolved_at, a.cancelled_at, a.lat, a.lng, a.notes, a.cancellation_reason, o.full_name as officer_name, o.badge_number as officer_badge, t.score as trust_score FROM sos_alerts a JOIN citizens c ON a.citizen_id = c.id LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id LEFT JOIN officers o ON a.assigned_officer_id = o.id ORDER BY a.triggered_at DESC`);

    // Format a BIGINT timestamp to Philippine readable date
    const fmtDate = (ts: any) => {
      if (!ts) return '';
      const d = new Date(Number(ts));
      return d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    };
    const fmtShort = (ts: any) => {
      if (!ts) return '';
      return new Date(Number(ts)).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: '2-digit' });
    };
    // CSV cell — quote if contains comma, newline, or quote
    const cell = (v: any) => {
      const s = v == null ? '' : String(v);
      return (s.includes(',') || s.includes('\n') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const row = (...cols: any[]) => cols.map(cell).join(',');

    const now = Date.now();
    const total = result.rows.length;
    const resolved = result.rows.filter((r: any) => r.status === 'RESOLVED').length;
    const falseAlarms = result.rows.filter((r: any) => r.status === 'FALSE_ALARM').length;
    const cancelled = result.rows.filter((r: any) => r.status === 'CANCELLED').length;
    const active = result.rows.filter((r: any) => ['ACTIVE','ACKNOWLEDGED','EN_ROUTE','ON_SCENE'].includes(r.status)).length;
    const resolutionRate = total > 0 ? ((resolved / total) * 100).toFixed(1) : '0.0';
    const falseAlarmRate = total > 0 ? ((falseAlarms / total) * 100).toFixed(1) : '0.0';

    const responseTimes = result.rows
      .filter((r: any) => r.status === 'RESOLVED' && r.acknowledged_at && r.triggered_at)
      .map((r: any) => (Number(r.acknowledged_at) - Number(r.triggered_at)) / 60000);
    const avgResponse = responseTimes.length > 0
      ? (responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length).toFixed(1)
      : 'N/A';

    const firstAlert = result.rows.length > 0 ? result.rows[result.rows.length - 1].triggered_at : null;
    const lastAlert  = result.rows.length > 0 ? result.rows[0].triggered_at : null;
    const reportPeriod = firstAlert && lastAlert
      ? `${fmtShort(firstAlert)} — ${fmtShort(lastAlert)}`
      : 'No alerts recorded';

    // Build CSV with BOM (Excel UTF-8), letterhead, summary, then data
    const lines: string[] = [];
    lines.push('\uFEFF'); // BOM
    lines.push(row('PASAY CITY POLICE STATION'));
    lines.push(row('SafeSignal PH — Emergency Response System'));
    lines.push(row('INCIDENT REPORT EXPORT'));
    lines.push(row(''));
    lines.push(row('Date Generated:', fmtDate(now)));
    lines.push(row('Report Period:', reportPeriod));
    lines.push(row('Generated By:', 'SafeSignal PH Dispatch System'));
    lines.push(row(''));
    lines.push(row('--- SUMMARY ---'));
    lines.push(row('Total Incidents:', total));
    lines.push(row('Resolved:', resolved));
    lines.push(row('Cancelled:', cancelled));
    lines.push(row('False Alarms:', falseAlarms));
    lines.push(row('Active/In-Progress:', active));
    lines.push(row('Resolution Rate:', `${resolutionRate}%`));
    lines.push(row('False Alarm Rate:', `${falseAlarmRate}%`));
    lines.push(row('Avg Response Time (Resolved):', avgResponse === 'N/A' ? 'N/A' : `${avgResponse} min`));
    lines.push(row(''));
    lines.push(row('--- INCIDENT LOG ---'));
    lines.push(row('Incident #','Citizen Name','Phone','Barangay','Status','Date / Time Triggered','Date / Time Acknowledged','Date / Time Resolved','Date / Time Cancelled','GPS Latitude','GPS Longitude','Assigned Officer','Badge No.','Trust Score','Notes / Disposition'));
    for (const a of result.rows) {
      lines.push(row(
        a.id,
        a.full_name,
        a.phone,
        a.barangay || '',
        a.status,
        fmtDate(a.triggered_at),
        fmtDate(a.acknowledged_at),
        fmtDate(a.resolved_at),
        fmtDate(a.cancelled_at),
        a.lat != null ? Number(a.lat).toFixed(6) : '',
        a.lng != null ? Number(a.lng).toFixed(6) : '',
        a.officer_name || '',
        a.officer_badge || '',
        a.trust_score != null ? a.trust_score : '',
        a.notes || a.cancellation_reason || '',
      ));
    }
    lines.push(row(''));
    lines.push(row('--- END OF REPORT ---'));
    lines.push(row('This document is computer-generated from SafeSignal PH. For official use only.'));

    const csv = lines.join('\r\n');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // YYYY-MM-DD
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="PCPS-SafeSignal-Incident-Report-${today}.csv"`);
    res.send(csv);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to export alerts' }); }
});

// GET /api/dispatch/alerts/:id
app.get('/api/dispatch/alerts/:id', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const alertResult = await pool.query(`SELECT a.*, c.full_name, c.phone, c.barangay, c.address, c.photo_url, c.strike_count, c.is_suspended, t.score as trust_score, t.total_alerts, t.false_alarms, t.resolved_emergencies, o.full_name as officer_name, o.badge_number as officer_badge FROM sos_alerts a JOIN citizens c ON a.citizen_id = c.id LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id LEFT JOIN officers o ON a.assigned_officer_id = o.id WHERE a.id = $1`, [req.params.id]);
    const alert = alertResult.rows[0];
    if (!alert) { res.status(404).json({ error: 'Alert not found' }); return; }
    const locResult = await pool.query(`SELECT lat, lng, recorded_at FROM alert_location_history WHERE alert_id = $1 ORDER BY recorded_at ASC`, [alert.id]);
    res.json({ alert: { ...normalizeAlert(alert), location_history: locResult.rows } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch alert details' }); }
});

// POST /api/dispatch/alerts/:id/acknowledge
app.post('/api/dispatch/alerts/:id/acknowledge', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const officerPayload = req.officer as OfficerPayload;
    const alertResult = await pool.query('SELECT * FROM sos_alerts WHERE id = $1', [req.params.id]);
    const alert = alertResult.rows[0];
    if (!alert) { res.status(404).json({ error: 'Alert not found' }); return; }
    if (alert.status !== 'ACTIVE') { res.status(400).json({ error: 'Alert is not in ACTIVE status' }); return; }
    const now = Date.now();
    await pool.query(`UPDATE sos_alerts SET status = 'ACKNOWLEDGED', acknowledged_at = $1, assigned_officer_id = $2 WHERE id = $3`, [now, officerPayload.id, alert.id]);
    const updated = await getFullAlert(alert.id);
    broadcastEvent('alert_updated', { alert: updated });
    res.json({ alert: updated });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to acknowledge alert' }); }
});

// POST /api/dispatch/alerts/:id/assign — assign officer to alert
app.post('/api/dispatch/alerts/:id/assign', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const { officer_id } = req.body;
    if (!officer_id) { res.status(400).json({ error: 'officer_id is required' }); return; }
    const alertResult = await pool.query('SELECT * FROM sos_alerts WHERE id = $1', [req.params.id]);
    const alert = alertResult.rows[0];
    if (!alert) { res.status(404).json({ error: 'Alert not found' }); return; }
    await pool.query('UPDATE sos_alerts SET assigned_officer_id = $1 WHERE id = $2', [officer_id, req.params.id]);
    const updated = await getFullAlert(alert.id);
    broadcastEvent('alert_updated', { alert: updated });
    // Fire Web Push to assigned officer (works even when screen is off)
    const pushPayload = {
      title: '\uD83D\uDEA8 EMERGENCY \u2014 You have been assigned!',
      body: `Citizen: ${updated?.full_name || 'Unknown'} | Barangay: ${updated?.barangay || ''}`,
      url: '/dispatch/login',
    };
    await sendPushToOfficers([Number(officer_id)], pushPayload);
    res.json({ alert: updated });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to assign officer' }); }
});

// POST /api/dispatch/alerts/:id/resolve
app.post('/api/dispatch/alerts/:id/resolve', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const { notes } = req.body;
    const alertResult = await pool.query('SELECT * FROM sos_alerts WHERE id = $1', [req.params.id]);
    const alert = alertResult.rows[0];
    if (!alert) { res.status(404).json({ error: 'Alert not found' }); return; }
    if (!['ACTIVE', 'ACKNOWLEDGED'].includes(alert.status)) { res.status(400).json({ error: 'Alert cannot be resolved in current status' }); return; }
    const now = Date.now();
    await pool.query(`UPDATE sos_alerts SET status = 'RESOLVED', resolved_at = $1, notes = $2 WHERE id = $3`, [now, notes || null, alert.id]);
    const trustResult = await pool.query('SELECT score FROM citizen_trust_scores WHERE citizen_id = $1', [alert.citizen_id]);
    const newScore = Math.min(100, (trustResult.rows[0]?.score || 100) + 10);
    await pool.query(`UPDATE citizen_trust_scores SET score = $1, resolved_emergencies = resolved_emergencies + 1, last_updated = $2 WHERE citizen_id = $3`, [newScore, now, alert.citizen_id]);
    const updated = await getFullAlert(alert.id);
    broadcastEvent('alert_updated', { alert: updated });
    res.json({ alert: updated });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to resolve alert' }); }
});

// POST /api/dispatch/alerts/:id/false-alarm
app.post('/api/dispatch/alerts/:id/false-alarm', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const { notes } = req.body;
    const alertResult = await pool.query('SELECT * FROM sos_alerts WHERE id = $1', [req.params.id]);
    const alert = alertResult.rows[0];
    if (!alert) { res.status(404).json({ error: 'Alert not found' }); return; }
    const now = Date.now();
    await pool.query(`UPDATE sos_alerts SET status = 'FALSE_ALARM', cancelled_at = $1, notes = $2 WHERE id = $3`, [now, notes || null, alert.id]);
    const citizenResult = await pool.query('SELECT * FROM citizens WHERE id = $1', [alert.citizen_id]);
    const citizen = citizenResult.rows[0];
    const settingsResult = await pool.query('SELECT * FROM station_settings LIMIT 1');
    const settings = settingsResult.rows[0];
    const strikeLimit = settings?.strike_limit || 2;
    const newStrikes = (citizen.strike_count || 0) + 1;
    let isSuspended = citizen.is_suspended;
    let suspensionReason = citizen.suspension_reason;
    if (newStrikes >= strikeLimit) { isSuspended = 1; suspensionReason = `Auto-suspended after ${newStrikes} false alarms`; }
    await pool.query(`UPDATE citizens SET strike_count = $1, is_suspended = $2, suspension_reason = $3 WHERE id = $4`, [newStrikes, isSuspended, suspensionReason, alert.citizen_id]);
    const trustResult = await pool.query('SELECT score FROM citizen_trust_scores WHERE citizen_id = $1', [alert.citizen_id]);
    const newScore = Math.max(0, (trustResult.rows[0]?.score || 100) - 15);
    await pool.query(`UPDATE citizen_trust_scores SET score = $1, false_alarms = false_alarms + 1, last_updated = $2 WHERE citizen_id = $3`, [newScore, now, alert.citizen_id]);
    const updated = await getFullAlert(alert.id);
    broadcastEvent('alert_updated', { alert: updated });
    res.json({ alert: updated });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to mark false alarm' }); }
});

// POST /api/dispatch/alerts/:id/suspicious
app.post('/api/dispatch/alerts/:id/suspicious', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const { reason } = req.body;
    const alertResult = await pool.query('SELECT * FROM sos_alerts WHERE id = $1', [req.params.id]);
    const alert = alertResult.rows[0];
    if (!alert) { res.status(404).json({ error: 'Alert not found' }); return; }
    await pool.query(`UPDATE sos_alerts SET is_suspicious = 1, suspicious_reason = $1 WHERE id = $2`, [reason || 'Flagged by dispatcher', alert.id]);
    const updated = await getFullAlert(alert.id);
    broadcastEvent('alert_updated', { alert: updated });
    res.json({ alert: updated });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to flag alert' }); }
});

// GET /api/dispatch/citizens
app.get('/api/dispatch/citizens', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const { search, filter } = req.query;
    let query = `SELECT c.*, t.score as trust_score, t.total_alerts, t.false_alarms, t.resolved_emergencies FROM citizens c LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id WHERE 1=1`;
    const params: any[] = [];
    let paramIdx = 1;
    if (search) { query += ` AND (c.full_name ILIKE $${paramIdx} OR c.phone ILIKE $${paramIdx + 1})`; params.push(`%${search}%`, `%${search}%`); paramIdx += 2; }
    if (filter === 'suspended') { query += ` AND c.is_suspended = 1`; }
    else if (filter === 'active') { query += ` AND (c.is_suspended = 0 OR c.is_suspended IS NULL)`; }
    query += ' ORDER BY c.registered_at DESC';
    const result = await pool.query(query, params);
    res.json({ citizens: result.rows.map(normalizeCitizen) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch citizens' }); }
});

// GET /api/dispatch/citizens/:id
app.get('/api/dispatch/citizens/:id', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const citizenResult = await pool.query(`SELECT c.*, t.score as trust_score, t.total_alerts, t.false_alarms, t.resolved_emergencies FROM citizens c LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id WHERE c.id = $1`, [req.params.id]);
    const citizen = citizenResult.rows[0];
    if (!citizen) { res.status(404).json({ error: 'Citizen not found' }); return; }
    const alertsResult = await pool.query(`SELECT * FROM sos_alerts WHERE citizen_id = $1 ORDER BY triggered_at DESC`, [citizen.id]);
    res.json({ citizen: normalizeCitizen(citizen), alerts: alertsResult.rows.map(normalizeAlert) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch citizen details' }); }
});

// POST /api/dispatch/citizens/:id/suspend
app.post('/api/dispatch/citizens/:id/suspend', requireOfficerAuth, async (req: any, res: any) => {
  try { const { reason } = req.body; await pool.query(`UPDATE citizens SET is_suspended = 1, suspension_reason = $1 WHERE id = $2`, [reason || 'Suspended by dispatcher', req.params.id]); res.json({ success: true }); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Failed to suspend citizen' }); }
});

// POST /api/dispatch/citizens/:id/unsuspend
app.post('/api/dispatch/citizens/:id/unsuspend', requireOfficerAuth, async (req: any, res: any) => {
  try { await pool.query(`UPDATE citizens SET is_suspended = 0, suspension_reason = NULL WHERE id = $1`, [req.params.id]); res.json({ success: true }); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Failed to unsuspend citizen' }); }
});

// POST /api/dispatch/citizens/:id/reset-strikes
app.post('/api/dispatch/citizens/:id/reset-strikes', requireOfficerAuth, async (req: any, res: any) => {
  try { await pool.query('UPDATE citizens SET strike_count = 0 WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Failed to reset strikes' }); }
});

// PATCH /api/dispatch/citizens/:id/verify — Station Admin only
app.patch('/api/dispatch/citizens/:id/verify', requireOfficerAuth, async (req: any, res: any) => {
  try {
    if (req.officer.role !== 'STATION_ADMIN') { res.status(403).json({ error: 'Only Station Admin can verify citizens' }); return; }
    const { verified } = req.body;
    await pool.query(`UPDATE citizens SET verified = $1 WHERE id = $2`, [verified ? 1 : 0, req.params.id]);
    res.json({ success: true, verified: !!verified });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to update verification status' }); }
});

// GET /api/dispatch/officers
app.get('/api/dispatch/officers', requireOfficerAuth, async (_req: any, res: any) => {
  try {
    const result = await pool.query(`SELECT o.*, s.name as station_name, ol.lat as officer_lat, ol.lng as officer_lng, ol.status as duty_status, ol.updated_at as location_updated_at FROM officers o LEFT JOIN stations s ON o.station_id = s.id LEFT JOIN officer_locations ol ON ol.officer_id = o.id ORDER BY o.created_at DESC`);
    res.json({ officers: result.rows.map((o: any) => { const r = { ...o }; delete r.password_hash; return r; }) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch officers' }); }
});

// POST /api/dispatch/officers
app.post('/api/dispatch/officers', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { full_name, email, badge_number, password, role } = req.body;
    if (!full_name || !email || !badge_number || !password || !role) { res.status(400).json({ error: 'All fields are required' }); return; }
    const stationResult = await pool.query('SELECT id FROM stations LIMIT 1');
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(`INSERT INTO officers (full_name, email, badge_number, station_id, role, password_hash, is_active) VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING id`, [full_name, email, badge_number, stationResult.rows[0].id, role, passwordHash]);
    res.status(201).json({ officer: { id: result.rows[0].id, full_name, email, badge_number, role } });
  } catch (err: any) {
    if (err.code === '23505') { res.status(409).json({ error: 'Email or badge number already exists' }); }
    else { console.error(err); res.status(500).json({ error: 'Failed to create officer' }); }
  }
});

// POST /api/dispatch/officers/:id/toggle-active
app.post('/api/dispatch/officers/:id/toggle-active', requireAdminAuth, async (req: any, res: any) => {
  try {
    const officerPayload = req.officer as OfficerPayload;
    const officerResult = await pool.query('SELECT * FROM officers WHERE id = $1', [req.params.id]);
    const officer = officerResult.rows[0];
    if (!officer) { res.status(404).json({ error: 'Officer not found' }); return; }
    if (officer.id === officerPayload.id) { res.status(400).json({ error: 'Cannot deactivate yourself' }); return; }
    const newActive = officer.is_active ? 0 : 1;
    await pool.query('UPDATE officers SET is_active = $1 WHERE id = $2', [newActive, officer.id]);
    res.json({ success: true, is_active: newActive });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to toggle officer status' }); }
});

// GET /api/dispatch/stats
app.get('/api/dispatch/stats', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const { period, start, end } = req.query;
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    if (period === 'custom' && start && end) {
      params.push(new Date(start as string).getTime());
      params.push(new Date((end as string) + 'T23:59:59').getTime());
      whereClause = 'WHERE triggered_at >= $1 AND triggered_at <= $2';
    } else if (period === '30d') {
      params.push(Date.now() - 30 * 24 * 60 * 60 * 1000);
      whereClause = 'WHERE triggered_at >= $1';
    } else if (period === '90d') {
      params.push(Date.now() - 90 * 24 * 60 * 60 * 1000);
      whereClause = 'WHERE triggered_at >= $1';
    }
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [statusRows, avgResp, todayCount, activeCitizens] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as c FROM sos_alerts ${whereClause} GROUP BY status`, params),
      pool.query(`SELECT AVG(acknowledged_at - triggered_at) as avg_ms FROM sos_alerts ${whereClause} AND acknowledged_at IS NOT NULL`, params),
      pool.query('SELECT COUNT(*) as c FROM sos_alerts WHERE triggered_at >= $1', [todayStart.getTime()]),
      pool.query('SELECT COUNT(*) as c FROM citizens WHERE COALESCE(is_suspended::boolean, false) = false'),
    ]);
    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const row of statusRows.rows) { statusCounts[row.status] = parseInt(row.c, 10); total += parseInt(row.c, 10); }
    const fa = statusCounts['FALSE_ALARM'] || 0;
    const resolvedCount = statusCounts['RESOLVED'] || 0;
    const cancelledCount = statusCounts['CANCELLED'] || 0;
    const terminalTotal = resolvedCount + fa + cancelledCount;
    const resolutionRate = terminalTotal > 0 ? Math.round((resolvedCount / terminalTotal) * 100) : 0;
    const avgMs = avgResp.rows[0]?.avg_ms ? parseFloat(avgResp.rows[0].avg_ms) : null;
    const avgMinutes = avgMs != null && avgMs > 0 ? Math.round((avgMs / 60000) * 10) / 10 : null;
    res.json({ stats: { total, active: statusCounts['ACTIVE'] || 0, acknowledged: statusCounts['ACKNOWLEDGED'] || 0, en_route: statusCounts['EN_ROUTE'] || 0, on_scene: statusCounts['ON_SCENE'] || 0, resolved: resolvedCount, false_alarms: fa, cancelled: cancelledCount, false_alarm_rate: total > 0 ? Math.round((fa / total) * 100) : 0, resolution_rate: resolutionRate, avg_response_minutes: avgMinutes, today_count: parseInt(todayCount.rows[0].c, 10), active_citizens: parseInt(activeCitizens.rows[0].c, 10) } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch stats' }); }
});

// GET /api/dispatch/reports — weekly or monthly grouping, timezone-aware (Manila)
app.get('/api/dispatch/reports', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const groupBy = (req.query.groupBy as string) === 'month' ? 'month' : 'week';
    const periodParam = req.query.period as string;
    const cutoff = periodParam === '30d' ? Date.now() - 30 * 24 * 60 * 60 * 1000
      : periodParam === 'all' ? 0
      : Date.now() - 90 * 24 * 60 * 60 * 1000;
    const result = await pool.query(`
      SELECT
        DATE_TRUNC($1, to_timestamp(triggered_at / 1000.0) AT TIME ZONE 'Asia/Manila') AS period_start,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved,
        COUNT(*) FILTER (WHERE status = 'FALSE_ALARM')::int AS false_alarms,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
        AVG(CASE WHEN acknowledged_at IS NOT NULL AND triggered_at IS NOT NULL
            THEN (acknowledged_at - triggered_at) / 60000.0 END) AS avg_response_min
      FROM sos_alerts
      WHERE triggered_at >= $2
      GROUP BY period_start
      ORDER BY period_start DESC
      LIMIT 12
    `, [groupBy, cutoff]);
    const reports = result.rows.map((r: any) => ({
      period_start: r.period_start,
      label: groupBy === 'month'
        ? new Date(r.period_start).toLocaleDateString('en-PH', { month: 'short', year: 'numeric', timeZone: 'Asia/Manila' })
        : 'Wk ' + new Date(r.period_start).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }),
      total: r.total,
      resolved: r.resolved,
      false_alarms: r.false_alarms,
      cancelled: r.cancelled,
      avg_response_min: r.avg_response_min != null ? Math.round(parseFloat(r.avg_response_min) * 10) / 10 : null,
    }));
    res.json({ reports });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch reports' }); }
});

// GET /api/dispatch/settings
app.get('/api/dispatch/settings', requireOfficerAuth, async (_req: any, res: any) => {
  try {
    const [settingsResult, stationResult] = await Promise.all([pool.query('SELECT * FROM station_settings LIMIT 1'), pool.query('SELECT * FROM stations LIMIT 1')]);
    res.json({ settings: settingsResult.rows[0], station: stationResult.rows[0] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch settings' }); }
});

// PUT /api/dispatch/settings
app.put('/api/dispatch/settings', requireAdminAuth, async (req: any, res: any) => {
  try {
    const { surge_threshold, surge_window_minutes, cooldown_minutes, strike_limit } = req.body;
    await pool.query(`UPDATE station_settings SET surge_threshold = COALESCE($1, surge_threshold), surge_window_minutes = COALESCE($2, surge_window_minutes), cooldown_minutes = COALESCE($3, cooldown_minutes), strike_limit = COALESCE($4, strike_limit) WHERE id = 1`, [surge_threshold || null, surge_window_minutes || null, cooldown_minutes || null, strike_limit || null]);
    res.json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to update settings' }); }
});

// ─────────────────────────── CITIZEN ROUTES ──────────────────────────────────

// SMS helper — sends OTP via Semaphore (Philippine SMS gateway)
async function sendSmsOtp(phone: string, code: string): Promise<void> {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  if (!apiKey) { console.warn('SEMAPHORE_API_KEY not set — OTP not sent via SMS'); return; }
  // Convert 09XXXXXXXXX → 639XXXXXXXXX (Semaphore international format)
  const intlPhone = '63' + phone.substring(1);
  const body = new URLSearchParams({
    apikey: apiKey,
    number: intlPhone,
    message: `Your Pasay City Emergency Response OTP is: ${code}. Valid for 10 minutes. Do not share this code.`,
    sendername: 'PASAY911',
  });
  const resp = await fetch('https://api.semaphore.co/api/v4/messages', { method: 'POST', body });
  if (!resp.ok) { console.error('Semaphore SMS failed:', await resp.text()); }
}

// POST /api/citizen/register
app.post('/api/citizen/register', async (req: any, res: any) => {
  try {
    const { full_name, phone, address, barangay, pin, photo_url, gov_id_type, gov_id_number, gov_id_photo } = req.body;
    if (!full_name || !phone || !pin) { res.status(400).json({ error: 'full_name, phone, and pin are required' }); return; }
    if (!gov_id_type || !gov_id_number) { res.status(400).json({ error: 'Government ID type and number are required' }); return; }
    if (!gov_id_photo) { res.status(400).json({ error: 'A photo of your government ID is required' }); return; }
    if (!/^09\d{9}$/.test(phone)) { res.status(400).json({ error: 'Phone must be 11 digits starting with 09' }); return; }
    if (!/^\d{4}$/.test(pin)) { res.status(400).json({ error: 'PIN must be 4 digits' }); return; }
    const existing = await pool.query('SELECT id FROM citizens WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) { res.status(409).json({ error: 'Phone number already registered' }); return; }
    const pinHash = hashPin(pin);
    const result = await pool.query(`INSERT INTO citizens (full_name, phone, address, barangay, pin_hash, photo_url, verified, gov_id_type, gov_id_number, gov_id_photo) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9) RETURNING id`, [full_name, phone, address || null, barangay || null, pinHash, photo_url || null, gov_id_type, gov_id_number, gov_id_photo]);
    const citizenId = result.rows[0].id;
    await pool.query(`INSERT INTO citizen_trust_scores (citizen_id, score, total_alerts, false_alarms, resolved_emergencies) VALUES ($1, 100, 0, 0, 0)`, [citizenId]);
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    await pool.query(`INSERT INTO otp_codes (citizen_id, code, expires_at) VALUES ($1, $2, $3)`, [citizenId, otpCode, Date.now() + 10 * 60 * 1000]);
    await sendSmsOtp(phone, otpCode);
    res.status(201).json({ citizen_id: citizenId, message: 'OTP sent to your phone' });
  } catch (error) { console.error('Register error:', error); res.status(500).json({ error: 'Failed to process registration' }); }
});

// POST /api/citizen/verify-otp
app.post('/api/citizen/verify-otp', async (req: any, res: any) => {
  try {
    const { citizen_id, otp } = req.body;
    if (!citizen_id || !otp) { res.status(400).json({ error: 'citizen_id and otp are required' }); return; }
    const otpResult = await pool.query(
      `SELECT code, expires_at FROM otp_codes WHERE citizen_id = $1 ORDER BY id DESC LIMIT 1`,
      [citizen_id]
    );
    const otpRow = otpResult.rows[0];
    if (!otpRow) { res.status(400).json({ error: 'No OTP found. Please register again.' }); return; }
    if (Date.now() > Number(otpRow.expires_at)) { res.status(400).json({ error: 'OTP has expired. Please request a new one.' }); return; }
    if (otp !== otpRow.code) { res.status(400).json({ error: 'Invalid OTP code' }); return; }
    const citizenResult = await pool.query('SELECT * FROM citizens WHERE id = $1', [citizen_id]);
    const citizen = citizenResult.rows[0];
    if (!citizen) { res.status(404).json({ error: 'Citizen not found' }); return; }
    await pool.query('UPDATE citizens SET verified = 1 WHERE id = $1', [citizen_id]);
    await pool.query('DELETE FROM otp_codes WHERE citizen_id = $1', [citizen_id]);
    const token = signCitizenToken({ id: citizen.id, phone: citizen.phone });
    res.json({ token, citizen: { id: citizen.id, full_name: citizen.full_name, phone: citizen.phone } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to verify OTP' }); }
});

// POST /api/citizen/forgot-pin — sends OTP to phone for PIN reset
app.post('/api/citizen/forgot-pin', async (req: any, res: any) => {
  try {
    const { phone } = req.body;
    if (!phone) { res.status(400).json({ error: 'phone is required' }); return; }
    const citizenResult = await pool.query('SELECT id, phone FROM citizens WHERE phone = $1 AND verified = 1', [phone]);
    if (!citizenResult.rows[0]) { res.status(404).json({ error: 'No verified account found for this number' }); return; }
    const citizen = citizenResult.rows[0];
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    await pool.query(`INSERT INTO otp_codes (citizen_id, code, expires_at) VALUES ($1, $2, $3)`, [citizen.id, otpCode, Date.now() + 10 * 60 * 1000]);
    await sendSmsOtp(phone, otpCode);
    res.json({ citizen_id: citizen.id, message: 'OTP sent to your phone' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to send OTP' }); }
});

// POST /api/citizen/reset-pin — verifies OTP and sets new PIN
app.post('/api/citizen/reset-pin', async (req: any, res: any) => {
  try {
    const { citizen_id, otp, new_pin } = req.body;
    if (!citizen_id || !otp || !new_pin) { res.status(400).json({ error: 'citizen_id, otp, and new_pin are required' }); return; }
    if (!/^\d{4}$/.test(new_pin)) { res.status(400).json({ error: 'PIN must be exactly 4 digits' }); return; }
    const otpResult = await pool.query(`SELECT code, expires_at FROM otp_codes WHERE citizen_id = $1 ORDER BY id DESC LIMIT 1`, [citizen_id]);
    const otpRow = otpResult.rows[0];
    if (!otpRow) { res.status(400).json({ error: 'No OTP found. Please request a new one.' }); return; }
    if (Date.now() > Number(otpRow.expires_at)) { res.status(400).json({ error: 'OTP has expired. Please request a new one.' }); return; }
    if (otp !== otpRow.code) { res.status(400).json({ error: 'Invalid OTP code' }); return; }
    const pinHash = hashPin(new_pin);
    await pool.query('UPDATE citizens SET pin_hash = $1 WHERE id = $2', [pinHash, citizen_id]);
    await pool.query('DELETE FROM otp_codes WHERE citizen_id = $1', [citizen_id]);
    res.json({ message: 'PIN reset successful. You can now log in.' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to reset PIN' }); }
});

// POST /api/citizen/login
app.post('/api/citizen/login', async (req: any, res: any) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) { res.status(400).json({ error: 'phone and pin are required' }); return; }
    const citizenResult = await pool.query('SELECT * FROM citizens WHERE phone = $1', [phone]);
    const citizen = citizenResult.rows[0];
    if (!citizen) { res.status(401).json({ error: 'Invalid phone or PIN' }); return; }
    if (!citizen.verified) { res.status(401).json({ error: 'Account not verified. Please complete OTP verification.' }); return; }
    const pinHash = hashPin(pin);
    if (citizen.pin_hash !== pinHash) { res.status(401).json({ error: 'Invalid phone or PIN' }); return; }
    await pool.query('UPDATE citizens SET last_active = $1 WHERE id = $2', [Date.now(), citizen.id]);
    const token = signCitizenToken({ id: citizen.id, phone: citizen.phone });
    res.json({ token, citizen: { id: citizen.id, full_name: citizen.full_name, phone: citizen.phone, barangay: citizen.barangay, is_suspended: citizen.is_suspended, suspension_reason: citizen.suspension_reason } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to process login' }); }
});

// GET /api/citizen/profile
app.get('/api/citizen/profile', requireCitizenAuth, async (req: any, res: any) => {
  try {
    const cp = req.citizen as CitizenPayload;
    const citizenResult = await pool.query('SELECT * FROM citizens WHERE id = $1', [cp.id]);
    const citizen = citizenResult.rows[0];
    if (!citizen) { res.status(404).json({ error: 'Citizen not found' }); return; }
    const trustResult = await pool.query('SELECT * FROM citizen_trust_scores WHERE citizen_id = $1', [citizen.id]);
    const trust = trustResult.rows[0];
    res.json({ citizen: { id: citizen.id, full_name: citizen.full_name, phone: citizen.phone, address: citizen.address, barangay: citizen.barangay, city: citizen.city, photo_url: citizen.photo_url, verified: citizen.verified, strike_count: citizen.strike_count, is_suspended: citizen.is_suspended, suspension_reason: citizen.suspension_reason, registered_at: citizen.registered_at, last_active: citizen.last_active, trust: trust ? { score: trust.score, total_alerts: trust.total_alerts, false_alarms: trust.false_alarms, resolved_emergencies: trust.resolved_emergencies } : { score: 100, total_alerts: 0, false_alarms: 0, resolved_emergencies: 0 } } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch profile' }); }
});

// PUT /api/citizen/profile
app.put('/api/citizen/profile', requireCitizenAuth, async (req: any, res: any) => {
  try {
    const cp = req.citizen as CitizenPayload;
    const { full_name, address, barangay, photo_url } = req.body;
    await pool.query(`UPDATE citizens SET full_name = COALESCE($1, full_name), address = COALESCE($2, address), barangay = COALESCE($3, barangay), photo_url = COALESCE($4, photo_url) WHERE id = $5`, [full_name || null, address || null, barangay || null, photo_url || null, cp.id]);
    res.json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to update profile' }); }
});

// POST /api/citizen/verify-pin
app.post('/api/citizen/verify-pin', requireCitizenAuth, async (req: any, res: any) => {
  try {
    const cp = req.citizen as CitizenPayload;
    const { pin } = req.body;
    if (!pin) { res.status(400).json({ error: 'pin is required' }); return; }
    const citizenResult = await pool.query('SELECT pin_hash FROM citizens WHERE id = $1', [cp.id]);
    const pinHash = hashPin(pin);
    res.json({ valid: citizenResult.rows[0]?.pin_hash === pinHash });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to verify PIN' }); }
});

// POST /api/citizen/sos
app.post('/api/citizen/sos', requireCitizenAuth, async (req: any, res: any) => {
  try {
    const cp = req.citizen as CitizenPayload;
    const { lat, lng, accuracy, pin, incident_photo } = req.body;
    if (!lat || !lng || !pin) { res.status(400).json({ error: 'lat, lng, and pin are required' }); return; }
    const citizenResult = await pool.query('SELECT * FROM citizens WHERE id = $1', [cp.id]);
    const citizen = citizenResult.rows[0];
    if (!citizen) { res.status(404).json({ error: 'Citizen not found' }); return; }
    if (citizen.is_suspended) { res.status(403).json({ error: 'Account suspended', reason: citizen.suspension_reason }); return; }
    const pinHash = hashPin(pin);
    if (citizen.pin_hash !== pinHash) { res.status(401).json({ error: 'Invalid PIN' }); return; }
    // Geo-fence: only accept SOS from within Pasay City boundaries
    const PASAY_LAT_MIN = 14.510, PASAY_LAT_MAX = 14.590;
    const PASAY_LNG_MIN = 120.970, PASAY_LNG_MAX = 121.030;
    if (lat < PASAY_LAT_MIN || lat > PASAY_LAT_MAX || lng < PASAY_LNG_MIN || lng > PASAY_LNG_MAX) {
      res.status(403).json({ error: 'Outside coverage area. SafeSignal PH currently covers Pasay City only.' });
      return;
    }
    const settingsResult = await pool.query('SELECT * FROM station_settings LIMIT 1');
    const settings = settingsResult.rows[0];
    const cooldownMs = (settings?.cooldown_minutes || 10) * 60 * 1000;
    // Cooldown and duplicate checks must cover ALL in-progress statuses.
    // If an officer is already EN_ROUTE or ON_SCENE, the citizen must not trigger a second SOS.
    const recentAlert = await pool.query(`SELECT id FROM sos_alerts WHERE citizen_id = $1 AND status IN ('ACTIVE', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE') AND triggered_at > $2`, [cp.id, Date.now() - cooldownMs]);
    if (recentAlert.rows.length > 0) { res.status(429).json({ error: 'Cooldown active. Please wait before sending another alert.' }); return; }
    const activeAlert = await pool.query(`SELECT id FROM sos_alerts WHERE citizen_id = $1 AND status IN ('ACTIVE', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE')`, [cp.id]);
    if (activeAlert.rows.length > 0) { res.status(409).json({ error: 'You already have an active alert', alert_id: activeAlert.rows[0].id }); return; }
    const now = Date.now();
    const result = await pool.query(`INSERT INTO sos_alerts (citizen_id, lat, lng, status, triggered_at, location_accuracy, incident_photo) VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6) RETURNING id`, [cp.id, lat, lng, now, accuracy || null, incident_photo || null]);
    const alertId = result.rows[0].id;
    await pool.query(`INSERT INTO alert_location_history (alert_id, lat, lng, recorded_at) VALUES ($1, $2, $3, $4)`, [alertId, lat, lng, now]);
    await pool.query(`UPDATE citizen_trust_scores SET total_alerts = total_alerts + 1, last_updated = $1 WHERE citizen_id = $2`, [now, cp.id]);
    await pool.query('UPDATE citizens SET last_active = $1 WHERE id = $2', [now, cp.id]);
    const alertWithCitizen = await getAlertWithCitizen(alertId);
    broadcastEvent('new_alert', { alert: alertWithCitizen });
    if (citizen.barangay) {
      const windowMs = (settings?.surge_window_minutes || 2) * 60 * 1000;
      // Surge count includes all in-progress statuses — an EN_ROUTE/ON_SCENE alert is still an active emergency.
      const surgeResult = await pool.query(`SELECT COUNT(*) as count FROM sos_alerts a JOIN citizens c ON a.citizen_id = c.id WHERE c.barangay = $1 AND a.triggered_at > $2 AND a.status IN ('ACTIVE', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE')`, [citizen.barangay, Date.now() - windowMs]);
      const surgeCount = parseInt(surgeResult.rows[0].count, 10);
      const threshold = settings?.surge_threshold || 5;
      if (surgeCount >= threshold) {
        broadcastEvent('surge_warning', { barangay: citizen.barangay, count: surgeCount, threshold, window_minutes: settings?.surge_window_minutes || 2, message: `SURGE ALERT: ${surgeCount} active alerts in ${citizen.barangay} within ${settings?.surge_window_minutes || 2} minutes!` });
      }
    }
    res.status(201).json({ alert: { id: alertId, status: 'ACTIVE', triggered_at: now } });
  } catch (error) { console.error('SOS error:', error); res.status(500).json({ error: 'Failed to process SOS request' }); }
});

// GET /api/citizen/active-alert
app.get('/api/citizen/active-alert', requireCitizenAuth, async (req: any, res: any) => {
  try {
    const cp = req.citizen as CitizenPayload;
    const alertResult = await pool.query(`SELECT a.*, o.full_name as officer_name, o.badge_number as officer_badge, ol.lat as officer_lat, ol.lng as officer_lng FROM sos_alerts a LEFT JOIN officers o ON a.assigned_officer_id = o.id LEFT JOIN officer_locations ol ON ol.officer_id = o.id WHERE a.citizen_id = $1 AND a.status IN ('ACTIVE', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE') ORDER BY a.triggered_at DESC LIMIT 1`, [cp.id]);
    const alert = alertResult.rows[0];
    if (!alert) { res.json({ alert: null }); return; }
    const locResult = await pool.query(`SELECT lat, lng, recorded_at FROM alert_location_history WHERE alert_id = $1 ORDER BY recorded_at ASC`, [alert.id]);
    res.json({ alert: { ...alert, location_history: locResult.rows } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch active alert' }); }
});

// POST /api/citizen/sos/cancel
app.post('/api/citizen/sos/cancel', requireCitizenAuth, async (req: any, res: any) => {
  try {
    const cp = req.citizen as CitizenPayload;
    const { reason } = req.body;
    const alertResult = await pool.query(`SELECT * FROM sos_alerts WHERE citizen_id = $1 AND status IN ('ACTIVE', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE') ORDER BY triggered_at DESC LIMIT 1`, [cp.id]);
    const alert = alertResult.rows[0];
    if (!alert) { res.status(404).json({ error: 'No active alert found' }); return; }
    const now = Date.now();
    await pool.query(`UPDATE sos_alerts SET status = 'CANCELLED', cancelled_at = $1, cancellation_reason = $2 WHERE id = $3`, [now, reason || 'No reason provided', alert.id]);
    if (reason === 'Accidental' || reason === 'accidental') {
      const trustResult = await pool.query('SELECT score FROM citizen_trust_scores WHERE citizen_id = $1', [cp.id]);
      const newScore = Math.max(0, (trustResult.rows[0]?.score || 100) - 5);
      await pool.query(`UPDATE citizen_trust_scores SET score = $1, last_updated = $2 WHERE citizen_id = $3`, [newScore, now, cp.id]);
    }
    const updatedAlert = await getAlertWithCitizen(alert.id);
    broadcastEvent('alert_updated', { alert: updatedAlert });
    res.json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to cancel SOS' }); }
});

// POST /api/citizen/location-update
app.post('/api/citizen/location-update', requireCitizenAuth, async (req: any, res: any) => {
  try {
    const cp = req.citizen as CitizenPayload;
    const { lat, lng } = req.body;
    if (!lat || !lng) { res.status(400).json({ error: 'lat and lng are required' }); return; }
    const alertResult = await pool.query(`SELECT id FROM sos_alerts WHERE citizen_id = $1 AND status IN ('ACTIVE', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE') ORDER BY triggered_at DESC LIMIT 1`, [cp.id]);
    const alert = alertResult.rows[0];
    if (!alert) { res.json({ success: false, message: 'No active alert' }); return; }
    const now = Date.now();
    await pool.query(`INSERT INTO alert_location_history (alert_id, lat, lng, recorded_at) VALUES ($1, $2, $3, $4)`, [alert.id, lat, lng, now]);
    broadcastEvent('location_update', { alert_id: alert.id, lat, lng, recorded_at: now });
    res.json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to update location' }); }
});

// GET /api/citizen/alerts
app.get('/api/citizen/alerts', requireCitizenAuth, async (req: any, res: any) => {
  try {
    const cp = req.citizen as CitizenPayload;
    const result = await pool.query(`SELECT * FROM sos_alerts WHERE citizen_id = $1 ORDER BY triggered_at DESC`, [cp.id]);
    res.json({ alerts: result.rows });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch alerts' }); }
});

// POST /api/citizen/resend-otp
app.post('/api/citizen/resend-otp', async (req: any, res: any) => {
  try {
    const { citizen_id } = req.body;
    if (!citizen_id) { res.status(400).json({ error: 'citizen_id is required' }); return; }
    const citizenResult = await pool.query('SELECT phone FROM citizens WHERE id = $1', [citizen_id]);
    if (!citizenResult.rows[0]) { res.status(404).json({ error: 'Citizen not found' }); return; }
    const phone = citizenResult.rows[0].phone;
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    await pool.query(`INSERT INTO otp_codes (citizen_id, code, expires_at) VALUES ($1, $2, $3)`, [citizen_id, otpCode, Date.now() + 10 * 60 * 1000]);
    await sendSmsOtp(phone, otpCode);
    res.json({ message: 'OTP resent' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to resend OTP' }); }
});

// GET /api/dispatch/nearby-officers?lat=X&lng=Y
app.get('/api/dispatch/nearby-officers', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    if (isNaN(lat) || isNaN(lng)) { res.status(400).json({ error: 'lat and lng are required' }); return; }
    const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
    // Haversine distance in km using PostgreSQL math
    const result = await pool.query(
      `SELECT o.id, o.full_name, o.badge_number, o.phone, o.duty_status,
              ol.lat, ol.lng, ol.updated_at,
              (6371 * acos(
                cos(radians($1)) * cos(radians(ol.lat)) *
                cos(radians(ol.lng) - radians($2)) +
                sin(radians($1)) * sin(radians(ol.lat))
              )) AS distance_km
       FROM officer_locations ol
       JOIN officers o ON ol.officer_id = o.id
       WHERE o.is_active = true
         AND ol.updated_at > $3
       ORDER BY distance_km ASC
       LIMIT 5`,
      [lat, lng, fifteenMinAgo]
    );
    res.json({ officers: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch nearby officers' });
  }
});

// GET /api/dispatch/officer-locations
app.get('/api/dispatch/officer-locations', requireOfficerAuth, async (_req: any, res: any) => {
  try {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const result = await pool.query(
      `SELECT ol.officer_id, ol.lat, ol.lng, ol.heading, ol.status, ol.updated_at,
              o.full_name, o.badge_number, o.role
       FROM officer_locations ol
       JOIN officers o ON ol.officer_id = o.id
       WHERE ol.updated_at > $1
       ORDER BY ol.updated_at DESC`,
      [fiveMinAgo]
    );
    res.json({ officers: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch officer locations' });
  }
});

// POST /api/dispatch/officer-location (officer updates own GPS location)
app.post('/api/dispatch/officer-location', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const officerPayload = req.officer as OfficerPayload;
    const { lat, lng, heading, status } = req.body;
    if (lat == null || lng == null) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }
    await pool.query(
      `INSERT INTO officer_locations (officer_id, lat, lng, heading, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (officer_id) DO UPDATE SET
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         heading = EXCLUDED.heading,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [officerPayload.id, lat, lng, heading || null, status || 'ON_DUTY', Date.now()]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update officer location' });
  }
});

// ───────────────────────── OFFICER ROUTES ─────────────────────────
// GET /api/officer/active-assignment
app.get('/api/officer/active-assignment', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const officerPayload = req.officer as OfficerPayload;
    const result = await pool.query(
      `SELECT a.id, c.full_name as "citizenName", c.phone as "citizenPhone",
       c.address, a.lat, a.lng, a.status, a.triggered_at as "createdAt"
       FROM sos_alerts a
       JOIN citizens c ON a.citizen_id = c.id
       WHERE a.assigned_officer_id = $1 AND a.status IN ('ACTIVE', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE')
       ORDER BY a.triggered_at DESC LIMIT 1`,
      [officerPayload.id]
    );
    res.json({ assignment: result.rows[0] || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// PATCH /api/officer/assignment/:id/status
app.patch('/api/officer/assignment/:id/status', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const officerPayload = req.officer as OfficerPayload;
    const { status, notes } = req.body;
    const valid = ['ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE', 'RESOLVED'];
    if (!valid.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const alertId = parseInt(req.params.id, 10);
    if (isNaN(alertId)) { res.status(400).json({ error: 'Invalid assignment ID' }); return; }
    const alertResult = await pool.query(
      'SELECT * FROM sos_alerts WHERE id = $1 AND assigned_officer_id = $2',
      [alertId, officerPayload.id]
    );
    if (!alertResult.rows[0]) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    const now = String(Date.now());
    await pool.query(
      `UPDATE sos_alerts SET status = $1,
        resolved_at = CASE WHEN $1 = 'RESOLVED' THEN $2::bigint ELSE resolved_at END,
        acknowledged_at = CASE WHEN $1 = 'ACKNOWLEDGED' AND acknowledged_at IS NULL THEN $2::bigint ELSE acknowledged_at END,
        notes = CASE WHEN $1 = 'RESOLVED' AND $3::text IS NOT NULL THEN $3::text ELSE notes END
       WHERE id = $4`,
      [status, now, notes || null, alertId]
    );
    const updated = await getAlertWithCitizen(alertId);
    broadcastEvent('alert_updated', { alert: updated });
    res.json({ success: true });
  } catch (error) {
    console.error('[SafeSignal] status update error:', (error as any)?.message || error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});


// PATCH /api/officer/duty-status
app.patch('/api/officer/duty-status', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const officerPayload = req.officer as OfficerPayload;
    const { duty_status } = req.body;
    if (!['ON_DUTY', 'OFF_DUTY'].includes(duty_status)) {
      res.status(400).json({ error: 'duty_status must be ON_DUTY or OFF_DUTY' });
      return;
    }
    await pool.query('UPDATE officers SET duty_status = $1 WHERE id = $2', [duty_status, officerPayload.id]);
    res.json({ success: true, duty_status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update duty status' });
  }
});

// === ONE-TIME DB FIX ENDPOINT ===
app.get('/api/fix-db', async (_req: any, res: any) => {
  try {
    // Step 1: neutralize PNP-002B ghost
    const ghost = await pool.query(`SELECT id, email, badge_number FROM officers WHERE badge_number = 'PNP-002B'`);
    let ghostResult = 'no PNP-002B found';
    if (ghost.rows.length > 0) {
      const ghostId = ghost.rows[0].id;
      await pool.query(`UPDATE officers SET email = 'ghost-002b' || '@' || 'removed.local', is_active = 0 WHERE id = $1`, [ghostId]);
      // Reassign alerts
      const real = await pool.query(`SELECT id FROM officers WHERE badge_number = 'PNP-002'`);
      if (real.rows.length > 0) {
        await pool.query(`UPDATE sos_alerts SET assigned_officer_id = $1 WHERE assigned_officer_id = $2`, [real.rows[0].id, ghostId]);
      }
      ghostResult = 'neutralized id=' + ghostId;
    }
    // Step 2: force-correct PNP-002
    const pwHash = await bcrypt.hash('password123', 10);
    await pool.query(`UPDATE officers SET role = 'OFFICER', email = 'officer' || '@' || 'pasay.safesignal.ph', password_hash = $1, is_active = 1 WHERE badge_number = 'PNP-002'`, [pwHash]);
    // Step 3: verify
    const verify = await pool.query(`SELECT id, badge_number, email, role, is_active FROM officers WHERE badge_number IN ('PNP-002', 'PNP-002B') ORDER BY badge_number`);
    res.json({ success: true, ghost: ghostResult, officers: verify.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
