// SafeSignal PH v1.0.1
import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
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
    // Create tables if they don't exist yet (idempotent schema bootstrap)
    await pool.query(`CREATE TABLE IF NOT EXISTS stations (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, barangay TEXT, latitude FLOAT, longitude FLOAT, contact_number TEXT, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS station_settings (id SERIAL PRIMARY KEY, station_id INT UNIQUE REFERENCES stations(id), surge_threshold INT DEFAULT 5, surge_window_minutes INT DEFAULT 2, cooldown_minutes INT DEFAULT 10, strike_limit INT DEFAULT 3)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS officers (id SERIAL PRIMARY KEY, station_id INT REFERENCES stations(id), badge_number TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'DISPATCHER', password_hash TEXT NOT NULL, is_active BOOL DEFAULT true, last_login BIGINT, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS citizens (id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, address TEXT, barangay TEXT, city TEXT, pin_hash TEXT NOT NULL, photo_url TEXT, verified BOOL DEFAULT false, strike_count INT DEFAULT 0, is_suspended BOOL DEFAULT false, suspension_reason TEXT, registered_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000), last_active BIGINT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS citizen_trust_scores (id SERIAL PRIMARY KEY, citizen_id INT UNIQUE REFERENCES citizens(id), score INT DEFAULT 100, total_alerts INT DEFAULT 0, false_alarms INT DEFAULT 0, resolved_emergencies INT DEFAULT 0, last_updated BIGINT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sos_alerts (id SERIAL PRIMARY KEY, citizen_id INT REFERENCES citizens(id), lat FLOAT NOT NULL, lng FLOAT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', triggered_at BIGINT, acknowledged_at BIGINT, resolved_at BIGINT, cancelled_at BIGINT, location_accuracy FLOAT, assigned_officer_id INT REFERENCES officers(id), is_suspicious BOOL DEFAULT false, suspicious_reason TEXT, notes TEXT, cancellation_reason TEXT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS alert_location_history (id SERIAL PRIMARY KEY, alert_id INT REFERENCES sos_alerts(id), lat FLOAT NOT NULL, lng FLOAT NOT NULL, recorded_at BIGINT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS otp_codes (id SERIAL PRIMARY KEY, citizen_id INT REFERENCES citizens(id), code TEXT NOT NULL, expires_at BIGINT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS officer_locations (officer_id INT UNIQUE REFERENCES officers(id), lat FLOAT, lng FLOAT, heading FLOAT, status TEXT DEFAULT 'ON_DUTY', updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000))`);
    await pool.query(`ALTER TABLE officer_locations ADD COLUMN IF NOT EXISTS heading FLOAT`);
    await pool.query(`ALTER TABLE officer_locations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ON_DUTY'`);
    await pool.query(`ALTER TABLE officer_locations ADD COLUMN IF NOT EXISTS updated_at BIGINT`);
    const stationResult = await pool.query(`
      INSERT INTO stations (name, barangay, latitude, longitude, contact_number)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, ['Pasay City Police Station', 'Pasay City', 14.5378, 120.9932, '+63-2-8551-0000']);
    const stationId = stationResult.rows[0].id;
    await pool.query(`
      INSERT INTO station_settings (station_id, surge_threshold, surge_window_minutes, cooldown_minutes, strike_limit)
      VALUES ($1, 5, 2, 10, 3)
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
    // Seed demo citizen account for demos
    await pool.query(`
      INSERT INTO citizens (full_name, phone, address, barangay, city, pin_hash, verified, strike_count, is_suspended)
      VALUES ('Demo Citizen', '09171234567', '123 Leveriza St', 'Barangay 76', 'Pasay City', $1, true, 0, false)
      ON CONFLICT (phone) DO NOTHING
    `, [hashPin('1234')]);
    console.log('[SafeSignal] Demo citizen ensured: 09171234567 / 1234');
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

// Cold-start init
initDb().catch(err => console.error('[SafeSignal] Cold-start initDb error:', err));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

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
    const token = signOfficerToken({ id: officer.id, email: officer.email, role: officer.role, badge_number: officer.badge_number });
    const stationResult = await pool.query('SELECT * FROM stations WHERE id = $1', [officer.station_id]);
    res.json({ token, officer: { id: officer.id, full_name: officer.full_name, badge_number: officer.badge_number, role: officer.role, email: officer.email, station: stationResult.rows[0] } });
  } catch (error) { console.error('Login error:', error); res.status(500).json({ error: 'Failed to process login' }); }
});

// GET /api/dispatch/alerts
app.get('/api/dispatch/alerts', requireOfficerAuth, async (req: any, res: any) => {
  try {
    const { status } = req.query;
    let query = `SELECT a.*, c.full_name, c.phone, c.barangay, c.address, c.photo_url, c.strike_count, c.is_suspended, t.score as trust_score, o.full_name as officer_name, o.badge_number as officer_badge FROM sos_alerts a JOIN citizens c ON a.citizen_id = c.id LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id LEFT JOIN officers o ON a.assigned_officer_id = o.id`;
    const params: any[] = [];
    if (status) { query += ' WHERE a.status = $1'; params.push(status); }
    query += ' ORDER BY a.triggered_at DESC';
    const result = await pool.query(query, params);
    res.json({ alerts: result.rows.map(normalizeAlert) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch alerts' }); }
});

// GET /api/dispatch/alerts/export
app.get('/api/dispatch/alerts/export', requireOfficerAuth, async (_req: any, res: any) => {
  try {
    const result = await pool.query(`SELECT a.id, c.full_name, c.phone, c.barangay, a.status, a.triggered_at, a.acknowledged_at, a.resolved_at, a.cancelled_at, a.lat, a.lng, a.notes, a.cancellation_reason, o.full_name as officer_name, o.badge_number as officer_badge, t.score as trust_score FROM sos_alerts a JOIN citizens c ON a.citizen_id = c.id LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id LEFT JOIN officers o ON a.assigned_officer_id = o.id WHERE a.status IN ('RESOLVED','CANCELLED','FALSE_ALARM') ORDER BY a.triggered_at DESC`);
    const headers = ['ID','Citizen','Phone','Barangay','Status','Triggered','Acknowledged','Resolved','Cancelled','Lat','Lng','Officer','Badge','Trust Score','Notes'];
    const rows = result.rows.map((a: any) => [a.id, a.full_name, a.phone, a.barangay, a.status, a.triggered_at ? new Date(a.triggered_at).toISOString() : '', a.acknowledged_at ? new Date(a.acknowledged_at).toISOString() : '', a.resolved_at ? new Date(a.resolved_at).toISOString() : '', a.cancelled_at ? new Date(a.cancelled_at).toISOString() : '', a.lat, a.lng, a.officer_name || '', a.officer_badge || '', a.trust_score || '', (a.notes || a.cancellation_reason || '').replace(/,/g, ';')]);
    const csv = [headers, ...rows].map((r: any[]) => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="safesignal-alerts.csv"');
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
    const strikeLimit = settings?.strike_limit || 3;
    const newStrikes = (citizen.strike_count || 0) + 1;
    let isSuspended = citizen.is_suspended;
    let suspensionReason = citizen.suspension_reason;
    if (newStrikes >= strikeLimit) { isSuspended = true; suspensionReason = `Auto-suspended after ${newStrikes} false alarms`; }
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

// GET /api/dispatch/officers
app.get('/api/dispatch/officers', requireOfficerAuth, async (_req: any, res: any) => {
  try {
    const result = await pool.query(`SELECT o.*, s.name as station_name FROM officers o LEFT JOIN stations s ON o.station_id = s.id WHERE o.is_active = 1 ORDER BY o.created_at DESC`);
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
    await pool.query('UPDATE officers SET is_active = $1 WHERE id = $2', [officer.is_active ? 0 : 1, officer.id]);
    res.json({ success: true, is_active: !officer.is_active });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to toggle officer status' }); }
});

// GET /api/dispatch/stats
app.get('/api/dispatch/stats', requireOfficerAuth, async (_req: any, res: any) => {
  try {
    const [total, active, acknowledged, resolved, falseAlarms, cancelled] = await Promise.all([
      pool.query('SELECT COUNT(*) as c FROM sos_alerts'),
      pool.query("SELECT COUNT(*) as c FROM sos_alerts WHERE status = 'ACTIVE'"),
      pool.query("SELECT COUNT(*) as c FROM sos_alerts WHERE status = 'ACKNOWLEDGED'"),
      pool.query("SELECT COUNT(*) as c FROM sos_alerts WHERE status = 'RESOLVED'"),
      pool.query("SELECT COUNT(*) as c FROM sos_alerts WHERE status = 'FALSE_ALARM'"),
      pool.query("SELECT COUNT(*) as c FROM sos_alerts WHERE status = 'CANCELLED'"),
    ]);
    const t = parseInt(total.rows[0].c, 10);
    const fa = parseInt(falseAlarms.rows[0].c, 10);
    res.json({ stats: { total: t, active: parseInt(active.rows[0].c, 10), acknowledged: parseInt(acknowledged.rows[0].c, 10), resolved: parseInt(resolved.rows[0].c, 10), false_alarms: fa, cancelled: parseInt(cancelled.rows[0].c, 10), false_alarm_rate: t > 0 ? Math.round((fa / t) * 100) : 0, avg_response_time_ms: 0 } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to fetch stats' }); }
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

// POST /api/citizen/register
app.post('/api/citizen/register', async (req: any, res: any) => {
  try {
    const { full_name, phone, address, barangay, pin, photo_url } = req.body;
    if (!full_name || !phone || !pin) { res.status(400).json({ error: 'full_name, phone, and pin are required' }); return; }
    if (!/^09\d{9}$/.test(phone)) { res.status(400).json({ error: 'Phone must be 11 digits starting with 09' }); return; }
    if (!/^\d{4}$/.test(pin)) { res.status(400).json({ error: 'PIN must be 4 digits' }); return; }
    const existing = await pool.query('SELECT id FROM citizens WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) { res.status(409).json({ error: 'Phone number already registered' }); return; }
    const pinHash = hashPin(pin);
    const result = await pool.query(`INSERT INTO citizens (full_name, phone, address, barangay, pin_hash, photo_url, verified) VALUES ($1, $2, $3, $4, $5, $6, 0) RETURNING id`, [full_name, phone, address || null, barangay || null, pinHash, photo_url || null]);
    const citizenId = result.rows[0].id;
    await pool.query(`INSERT INTO citizen_trust_scores (citizen_id, score, total_alerts, false_alarms, resolved_emergencies) VALUES ($1, 100, 0, 0, 0)`, [citizenId]);
    await pool.query(`INSERT INTO otp_codes (citizen_id, code, expires_at) VALUES ($1, '123456', $2)`, [citizenId, Date.now() + 10 * 60 * 1000]);
    res.status(201).json({ citizen_id: citizenId, message: 'OTP sent to your phone' });
  } catch (error) { console.error('Register error:', error); res.status(500).json({ error: 'Failed to process registration' }); }
});

// POST /api/citizen/verify-otp
app.post('/api/citizen/verify-otp', async (req: any, res: any) => {
  try {
    const { citizen_id, otp } = req.body;
    if (!citizen_id || !otp) { res.status(400).json({ error: 'citizen_id and otp are required' }); return; }
    if (otp !== '123456') { res.status(400).json({ error: 'Invalid OTP code' }); return; }
    const citizenResult = await pool.query('SELECT * FROM citizens WHERE id = $1', [citizen_id]);
    const citizen = citizenResult.rows[0];
    if (!citizen) { res.status(404).json({ error: 'Citizen not found' }); return; }
    await pool.query('UPDATE citizens SET verified = 1 WHERE id = $1', [citizen_id]);
    const token = signCitizenToken({ id: citizen.id, phone: citizen.phone });
    res.json({ token, citizen: { id: citizen.id, full_name: citizen.full_name, phone: citizen.phone } });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to verify OTP' }); }
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
    const { lat, lng, accuracy, pin } = req.body;
    if (!lat || !lng || !pin) { res.status(400).json({ error: 'lat, lng, and pin are required' }); return; }
    const citizenResult = await pool.query('SELECT * FROM citizens WHERE id = $1', [cp.id]);
    const citizen = citizenResult.rows[0];
    if (!citizen) { res.status(404).json({ error: 'Citizen not found' }); return; }
    if (citizen.is_suspended) { res.status(403).json({ error: 'Account suspended', reason: citizen.suspension_reason }); return; }
    const pinHash = hashPin(pin);
    if (citizen.pin_hash !== pinHash) { res.status(401).json({ error: 'Invalid PIN' }); return; }
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
    const result = await pool.query(`INSERT INTO sos_alerts (citizen_id, lat, lng, status, triggered_at, location_accuracy) VALUES ($1, $2, $3, 'ACTIVE', $4, $5) RETURNING id`, [cp.id, lat, lng, now, accuracy || null]);
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
    const alertResult = await pool.query(`SELECT a.*, o.full_name as officer_name, o.badge_number as officer_badge FROM sos_alerts a LEFT JOIN officers o ON a.assigned_officer_id = o.id WHERE a.citizen_id = $1 AND a.status IN ('ACTIVE', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE') ORDER BY a.triggered_at DESC LIMIT 1`, [cp.id]);
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
    await pool.query(`INSERT INTO otp_codes (citizen_id, code, expires_at) VALUES ($1, '123456', $2)`, [citizen_id, Date.now() + 10 * 60 * 1000]);
    res.json({ message: 'OTP resent' });  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to resend OTP' }); }
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
    const { status } = req.body;
    const valid = ['ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE', 'RESOLVED'];
    if (!valid.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const alertResult = await pool.query(
      'SELECT * FROM sos_alerts WHERE id = $1 AND assigned_officer_id = $2',
      [req.params.id, officerPayload.id]
    );
    if (!alertResult.rows[0]) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    const now = Date.now();
    await pool.query(
      `UPDATE sos_alerts SET status = $1, resolved_at = CASE WHEN $1 = 'RESOLVED' THEN $2 ELSE resolved_at END WHERE id = $3`,
      [status, now, req.params.id]
    );
    const updated = await getAlertWithCitizen(req.params.id);
    broadcastEvent('alert_updated', { alert: updated });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update status' });
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
