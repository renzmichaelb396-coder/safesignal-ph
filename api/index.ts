import express, { Request, Response } from 'express';
import cors from 'cors';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import initSqlJs from 'sql.js';

const JWT_SECRET = process.env.JWT_SECRET || 'safesignal-ph-secret-key-2024';

// Global database instance
let SQL: any = null;
let db: any = null;
let dbInitialized = false;
const loginAttempts = new Map<string, { count: number; lockUntil: number }>();

// Initialize the app
const app = express();
app.use(cors());
app.use(express.json());

// Types
interface CitizenPayload {
  type: 'citizen';
  id: number;
  phone: string;
}

interface OfficerPayload {
  type: 'officer';
  id: number;
  email: string;
  role: string;
  badge_number: string;
}

// Utility functions
function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function signCitizenToken(payload: Omit<CitizenPayload, 'type'>): string {
  return jwt.sign({ type: 'citizen', ...payload }, JWT_SECRET, { expiresIn: '7d' });
}

function signOfficerToken(payload: Omit<OfficerPayload, 'type'>): string {
  return jwt.sign({ type: 'officer', ...payload }, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token: string): CitizenPayload | OfficerPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as CitizenPayload | OfficerPayload;
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  if (req.query?.token && typeof req.query.token === 'string') {
    return req.query.token;
  }
  return null;
}

// Middleware
function requireCitizenAuth(req: Request, res: Response, next: any): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'citizen') {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  (req as any).citizen = payload;
  next();
}

function requireOfficerAuth(req: Request, res: Response, next: any): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'officer') {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  (req as any).officer = payload;
  next();
}

function requireAdminAuth(req: Request, res: Response, next: any): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'officer') {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  if ((payload as OfficerPayload).role !== 'STATION_ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  (req as any).officer = payload;
  next();
}

// Database initialization with sql.js
async function initializeDatabase(): Promise<void> {
  if (dbInitialized) return;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  db = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      barangay TEXT,
      latitude REAL,
      longitude REAL,
      contact_number TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS officers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER NOT NULL,
      badge_number TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (station_id) REFERENCES stations(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS citizens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone_number TEXT,
      barangay TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      pin_hash TEXT NOT NULL,
      emergency_contacts TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS citizen_trust_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      citizen_id INTEGER NOT NULL,
      score REAL DEFAULT 100.0,
      false_alarm_count INTEGER DEFAULT 0,
      verified_alert_count INTEGER DEFAULT 0,
      last_updated INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (citizen_id) REFERENCES citizens(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sos_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      citizen_id INTEGER NOT NULL,
      station_id INTEGER,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      alert_type TEXT,
      triggered_at INTEGER DEFAULT (strftime('%s', 'now')),
      acknowledged_at INTEGER,
      acknowledged_by INTEGER,
      resolved_at INTEGER,
      resolved_by INTEGER,
      resolution_notes TEXT,
      is_suspicious INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (citizen_id) REFERENCES citizens(id),
      FOREIGN KEY (station_id) REFERENCES stations(id),
      FOREIGN KEY (acknowledged_by) REFERENCES officers(id),
      FOREIGN KEY (resolved_by) REFERENCES officers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS alert_location_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER NOT NULL,
      latitude REAL,
      longitude REAL,
      recorded_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (alert_id) REFERENCES sos_alerts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS station_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER NOT NULL UNIQUE,
      surge_threshold INTEGER DEFAULT 5,
      surge_window_minutes INTEGER DEFAULT 2,
      response_timeout_minutes INTEGER DEFAULT 15,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (station_id) REFERENCES stations(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      officer_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER,
      is_used INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (officer_id) REFERENCES officers(id)
    )
  `);

  // Seed data
  const stationCountResult = db.exec('SELECT COUNT(*) as count FROM stations');
  const stationCount = stationCountResult.length > 0 && stationCountResult[0].values.length > 0
    ? stationCountResult[0].values[0][0]
    : 0;

  if (stationCount === 0) {
    // Create station
    db.run(
      'INSERT INTO stations (name, barangay, latitude, longitude, contact_number) VALUES (?, ?, ?, ?, ?)',
      ['Pasay City Police Station', 'Pasay City', 14.5378, 120.9932, '+63-2-8551-0000']
    );

    const stationResult = db.exec('SELECT id FROM stations WHERE name = ?', ['Pasay City Police Station']);
    const stationId = stationResult[0]?.values[0][0] || 1;

    // Create officers
    const officers = [
      { badge: 'PNP-001', name: 'Maria Lopez', role: 'DISPATCHER' },
      { badge: 'PNP-002', name: 'Carlos Mendoza', role: 'DISPATCHER' },
      { badge: 'PNP-ADM', name: 'Chief Antonio Reyes', role: 'STATION_ADMIN' },
    ];

    for (const officer of officers) {
      const passwordHash = bcryptjs.hashSync('password123', 10);
      db.run(
        'INSERT INTO officers (station_id, badge_number, name, role, password_hash) VALUES (?, ?, ?, ?, ?)',
        [stationId, officer.badge, officer.name, officer.role, passwordHash]
      );
    }

    // Create citizens
    const citizens = [
      { name: 'Juan Dela Cruz', phone: '+63-917-1234567', barangay: 'Pasay City', lat: 14.5400, lng: 120.9950 },
      { name: 'Maria Santos', phone: '+63-917-2345678', barangay: 'Pasay City', lat: 14.5350, lng: 120.9920 },
      { name: 'Pedro Reyes', phone: '+63-917-3456789', barangay: 'Pasay City', lat: 14.5380, lng: 120.9900 },
      { name: 'Ana Gonzales', phone: '+63-917-4567890', barangay: 'Pasay City', lat: 14.5420, lng: 120.9960 },
      { name: 'Miguel Torres', phone: '+63-917-5678901', barangay: 'Pasay City', lat: 14.5360, lng: 120.9880 },
    ];

    const citizenIds: number[] = [];
    for (const citizen of citizens) {
      const pinHash = hashPin('1234');
      db.run(
        'INSERT INTO citizens (name, phone_number, barangay, latitude, longitude, pin_hash) VALUES (?, ?, ?, ?, ?, ?)',
        [citizen.name, citizen.phone, citizen.barangay, citizen.lat, citizen.lng, pinHash]
      );
    }

    // Get citizen IDs
    const citizenResult = db.exec('SELECT id FROM citizens ORDER BY id');
    if (citizenResult.length > 0) {
      for (let i = 0; i < citizenResult[0].values.length; i++) {
        citizenIds.push(citizenResult[0].values[i][0]);
      }
    }

    // Create trust scores
    for (let i = 0; i < citizenIds.length; i++) {
      db.run(
        'INSERT INTO citizen_trust_scores (citizen_id, score, false_alarm_count, verified_alert_count) VALUES (?, ?, ?, ?)',
        [citizenIds[i], 95.0 - i * 5, i, 5 - i]
      );
    }

    // Create demo alerts
    const now = Math.floor(Date.now() / 1000);
    const alerts = [
      { citizenIdx: 0, status: 'ACTIVE', type: 'EMERGENCY', suspicious: 0 },
      { citizenIdx: 1, status: 'ACKNOWLEDGED', type: 'EMERGENCY', suspicious: 0 },
      { citizenIdx: 2, status: 'RESOLVED', type: 'EMERGENCY', suspicious: 0 },
      { citizenIdx: 3, status: 'FALSE_ALARM', type: 'EMERGENCY', suspicious: 0 },
      { citizenIdx: 4, status: 'ACTIVE', type: 'EMERGENCY', suspicious: 1 },
    ];

    const alertIds: number[] = [];
    for (let i = 0; i < alerts.length; i++) {
      const alert = alerts[i];
      const triggeredAt = now - (300 * (i + 1));
      if (citizenIds[alert.citizenIdx]) {
        db.run(
          'INSERT INTO sos_alerts (citizen_id, station_id, status, alert_type, triggered_at, is_suspicious) VALUES (?, ?, ?, ?, ?, ?)',
          [citizenIds[alert.citizenIdx], stationId, alert.status, alert.type, triggeredAt, alert.suspicious]
        );
      }
    }

    // Get alert IDs
    const alertResult = db.exec('SELECT id FROM sos_alerts ORDER BY id');
    if (alertResult.length > 0) {
      for (let i = 0; i < alertResult[0].values.length; i++) {
        alertIds.push(alertResult[0].values[i][0]);
      }
    }

    // Add location history
    for (let i = 0; i < Math.min(alertIds.length, citizens.length); i++) {
      const alert = alerts[i];
      const citizen = citizens[alert.citizenIdx];
      const triggeredAt = now - (300 * (i + 1));
      db.run(
        'INSERT INTO alert_location_history (alert_id, latitude, longitude, recorded_at) VALUES (?, ?, ?, ?)',
        [alertIds[i], citizen.lat, citizen.lng, triggeredAt]
      );
    }

    // Create station settings
    db.run(
      'INSERT INTO station_settings (station_id, surge_threshold, surge_window_minutes, response_timeout_minutes) VALUES (?, ?, ?, ?)',
      [stationId, 5, 2, 15]
    );
  }

  dbInitialized = true;
}

// Helper function to run sql.js queries
function dbRun(sql: string, params: any[] = []): any {
  if (!db) return null;
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    stmt.free();
    return { lastInsertRowid: db.getRowsModified() };
  } catch (error) {
    console.error('DB run error:', error, sql);
    return null;
  }
}

// Helper function to execute SELECT queries
function dbExec(sql: string, params: any[] = []): any[] {
  if (!db) return [];
  try {
    const result = db.exec(sql, params);
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => {
      const columns = result[0].columns;
      const obj: any = {};
      columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  } catch (error) {
    console.error('DB exec error:', error, sql);
    return [];
  }
}

// Initialize DB on first request
app.use(async (req: Request, res: Response, next: any) => {
  if (!dbInitialized) {
    try {
      await initializeDatabase();
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }
  next();
});

// CITIZEN ROUTES

app.post('/api/citizen/register', async (req: Request, res: Response) => {
  try {
    const { full_name, phone, address, barangay, pin, photo_url } = req.body;

    if (!full_name || !phone || !pin) {
      res.status(400).json({ error: 'full_name, phone, and pin are required' });
      return;
    }

    if (!/^09\d{9}$/.test(phone)) {
      res.status(400).json({ error: 'Phone must be 11 digits starting with 09' });
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      res.status(400).json({ error: 'PIN must be 4 digits' });
      return;
    }

    const existing = dbExec('SELECT id FROM citizens WHERE phone_number = ?', [phone]);
    if (existing.length > 0) {
      res.status(409).json({ error: 'Phone number already registered' });
      return;
    }

    const pinHash = hashPin(pin);
    dbRun(
      'INSERT INTO citizens (name, phone_number, address, barangay, latitude, longitude, pin_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [full_name, phone, address || null, barangay || null, 0, 0, pinHash]
    );

    const citizen = dbExec('SELECT id FROM citizens WHERE phone_number = ?', [phone]);
    if (citizen.length === 0) {
      res.status(500).json({ error: 'Failed to create citizen' });
      return;
    }

    const citizenId = citizen[0].id;
    dbRun('INSERT INTO citizen_trust_scores (citizen_id, score, false_alarm_count, verified_alert_count) VALUES (?, ?, ?, ?)', [citizenId, 100, 0, 0]);

    res.status(201).json({ citizen_id: citizenId, message: 'Registration successful. OTP sent to your phone (demo: 123456)' });
  } catch (error) {
    console.error('Register handler error:', error);
    res.status(500).json({ error: 'Failed to process registration' });
  }
});

app.post('/api/citizen/verify-otp', (req: Request, res: Response) => {
  try {
    const { citizen_id, otp } = req.body;
    if (!citizen_id || !otp) {
      res.status(400).json({ error: 'citizen_id and otp are required' });
      return;
    }

    if (otp !== '123456') {
      res.status(400).json({ error: 'Invalid OTP code' });
      return;
    }

    const citizen = dbExec('SELECT * FROM citizens WHERE id = ?', [citizen_id]);
    if (citizen.length === 0) {
      res.status(404).json({ error: 'Citizen not found' });
      return;
    }

    const token = signCitizenToken({ id: citizen[0].id, phone: citizen[0].phone_number });
    res.json({ token, citizen: { id: citizen[0].id, name: citizen[0].name, phone: citizen[0].phone_number } });
  } catch (error) {
    console.error('Verify OTP handler error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

app.post('/api/citizen/login', (req: Request, res: Response) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      res.status(400).json({ error: 'phone and pin are required' });
      return;
    }

    // Normalize phone: strip non-digits, try both formats
    const digits = phone.replace(/\D/g, '');
    let citizen = dbExec('SELECT * FROM citizens WHERE phone_number = ?', [phone]);
    if (citizen.length === 0 && digits.length >= 10) {
      const intl = '+63-' + digits.slice(-10, -7) + '-' + digits.slice(-7);
      citizen = dbExec('SELECT * FROM citizens WHERE phone_number = ?', [intl]);
    }
    if (citizen.length === 0 && digits.length >= 10) {
      citizen = dbExec("SELECT * FROM citizens WHERE REPLACE(REPLACE(REPLACE(phone_number, '+', ''), '-', ''), ' ', '') LIKE ?", ['%' + digits.slice(-10)]);
    }
    if (citizen.length === 0) {
      res.status(401).json({ error: 'Invalid phone or PIN' });
      return;
    }

    const pinHash = hashPin(pin);
    if (citizen[0].pin_hash !== pinHash) {
      res.status(401).json({ error: 'Invalid phone or PIN' });
      return;
    }

    const token = signCitizenToken({ id: citizen[0].id, phone: citizen[0].phone_number });
    res.json({
      token,
      citizen: {
        id: citizen[0].id,
        name: citizen[0].name,
        phone: citizen[0].phone_number,
        barangay: citizen[0].barangay,
        status: citizen[0].status,
      },
    });
  } catch (error) {
    console.error('Login handler error:', error);
    res.status(500).json({ error: 'Failed to process login' });
  }
});

app.get('/api/citizen/profile', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const citizen = dbExec('SELECT * FROM citizens WHERE id = ?', [citizenPayload.id]);
    if (citizen.length === 0) {
      res.status(404).json({ error: 'Citizen not found' });
      return;
    }

    const trust = dbExec('SELECT * FROM citizen_trust_scores WHERE citizen_id = ?', [citizen[0].id]);

    res.json({
      citizen: {
        id: citizen[0].id,
        name: citizen[0].name,
        phone: citizen[0].phone_number,
        barangay: citizen[0].barangay,
        status: citizen[0].status,
        trust: trust.length > 0 ? { score: trust[0].score, false_alarms: trust[0].false_alarm_count, verified_alerts: trust[0].verified_alert_count } : { score: 100, false_alarms: 0, verified_alerts: 0 },
      },
    });
  } catch (error) {
    console.error('Profile handler error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/citizen/profile', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const { name, address, barangay } = req.body;
    dbRun('UPDATE citizens SET name = COALESCE(?, name), barangay = COALESCE(?, barangay) WHERE id = ?', [name || null, barangay || null, citizenPayload.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Update profile handler error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.post('/api/citizen/verify-pin', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const { pin } = req.body;
    if (!pin) {
      res.status(400).json({ error: 'pin is required' });
      return;
    }

    const citizen = dbExec('SELECT pin_hash FROM citizens WHERE id = ?', [citizenPayload.id]);
    const pinHash = hashPin(pin);
    res.json({ valid: citizen.length > 0 && citizen[0].pin_hash === pinHash });
  } catch (error) {
    console.error('Verify PIN handler error:', error);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

app.post('/api/citizen/sos', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const { lat, lng, pin } = req.body;

    if (!lat || !lng || !pin) {
      res.status(400).json({ error: 'lat, lng, and pin are required' });
      return;
    }

    const citizen = dbExec('SELECT * FROM citizens WHERE id = ?', [citizenPayload.id]);
    if (citizen.length === 0) {
      res.status(404).json({ error: 'Citizen not found' });
      return;
    }

    const pinHash = hashPin(pin);
    if (citizen[0].pin_hash !== pinHash) {
      res.status(401).json({ error: 'Invalid PIN' });
      return;
    }

    // Check for existing active alert
    const activeAlert = dbExec('SELECT id FROM sos_alerts WHERE citizen_id = ? AND status IN (?, ?)', [citizenPayload.id, 'ACTIVE', 'ACKNOWLEDGED']);
    if (activeAlert.length > 0) {
      res.status(409).json({ error: 'You already have an active alert', alert_id: activeAlert[0].id });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const station = dbExec('SELECT id FROM stations LIMIT 1');
    const stationId = station.length > 0 ? station[0].id : 1;

    dbRun('INSERT INTO sos_alerts (citizen_id, station_id, status, triggered_at) VALUES (?, ?, ?, ?)', [citizenPayload.id, stationId, 'ACTIVE', now]);

    const alert = dbExec('SELECT id FROM sos_alerts WHERE citizen_id = ? AND status = ? ORDER BY id DESC LIMIT 1', [citizenPayload.id, 'ACTIVE']);
    if (alert.length === 0) {
      res.status(500).json({ error: 'Failed to create alert' });
      return;
    }

    const alertId = alert[0].id;
    dbRun('INSERT INTO alert_location_history (alert_id, latitude, longitude, recorded_at) VALUES (?, ?, ?, ?)', [alertId, lat, lng, now]);
    dbRun('UPDATE citizen_trust_scores SET verified_alert_count = verified_alert_count + 1 WHERE citizen_id = ?', [citizenPayload.id]);

    res.status(201).json({ alert: { id: alertId, status: 'ACTIVE', triggered_at: now } });
  } catch (error) {
    console.error('SOS handler error:', error);
    res.status(500).json({ error: 'Failed to process SOS request' });
  }
});

app.get('/api/citizen/active-alert', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const alert = dbExec('SELECT * FROM sos_alerts WHERE citizen_id = ? AND status IN (?, ?) ORDER BY triggered_at DESC LIMIT 1', [citizenPayload.id, 'ACTIVE', 'ACKNOWLEDGED']);

    if (alert.length === 0) {
      res.json({ alert: null });
      return;
    }

    const locationHistory = dbExec('SELECT latitude, longitude, recorded_at FROM alert_location_history WHERE alert_id = ? ORDER BY recorded_at ASC', [alert[0].id]);

    res.json({
      alert: {
        ...alert[0],
        location_history: locationHistory.map((loc: any) => ({ lat: loc.latitude, lng: loc.longitude, recorded_at: loc.recorded_at })),
      },
    });
  } catch (error) {
    console.error('Active alert handler error:', error);
    res.status(500).json({ error: 'Failed to fetch active alert' });
  }
});

app.post('/api/citizen/sos/cancel', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const { reason } = req.body;

    const alert = dbExec('SELECT * FROM sos_alerts WHERE citizen_id = ? AND status IN (?, ?) ORDER BY triggered_at DESC LIMIT 1', [citizenPayload.id, 'ACTIVE', 'ACKNOWLEDGED']);
    if (alert.length === 0) {
      res.status(404).json({ error: 'No active alert found' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    dbRun('UPDATE sos_alerts SET status = ? WHERE id = ?', ['CANCELLED', alert[0].id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel SOS handler error:', error);
    res.status(500).json({ error: 'Failed to cancel SOS' });
  }
});

app.post('/api/citizen/location-update', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const { lat, lng } = req.body;
    if (!lat || !lng) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    const alert = dbExec('SELECT id FROM sos_alerts WHERE citizen_id = ? AND status IN (?, ?) ORDER BY triggered_at DESC LIMIT 1', [citizenPayload.id, 'ACTIVE', 'ACKNOWLEDGED']);
    if (alert.length === 0) {
      res.json({ success: false, message: 'No active alert' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    dbRun('INSERT INTO alert_location_history (alert_id, latitude, longitude, recorded_at) VALUES (?, ?, ?, ?)', [alert[0].id, lat, lng, now]);

    res.json({ success: true });
  } catch (error) {
    console.error('Location update handler error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

app.get('/api/citizen/alerts', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const alerts = dbExec('SELECT * FROM sos_alerts WHERE citizen_id = ? ORDER BY triggered_at DESC', [citizenPayload.id]);
    res.json({ alerts });
  } catch (error) {
    console.error('Alerts history handler error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

app.post('/api/citizen/resend-otp', (req: Request, res: Response) => {
  try {
    const { citizen_id } = req.body;
    if (!citizen_id) {
      res.status(400).json({ error: 'citizen_id is required' });
      return;
    }
    res.json({ message: 'OTP resent (demo: 123456)' });
  } catch (error) {
    console.error('Resend OTP handler error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// DISPATCH ROUTES

app.post('/api/dispatch/login', async (req: Request, res: Response) => {
  try {
    const { badge_number, password } = req.body;
    if (!badge_number || !password) {
      res.status(400).json({ error: 'badge_number and password are required' });
      return;
    }

    const attemptKey = badge_number.toLowerCase();
    const attempts = loginAttempts.get(attemptKey);
    if (attempts && attempts.lockUntil > Date.now()) {
      const remaining = Math.ceil((attempts.lockUntil - Date.now()) / 1000);
      res.status(429).json({ error: `Too many attempts. Try again in ${remaining} seconds.` });
      return;
    }

    const officer = dbExec('SELECT * FROM officers WHERE badge_number = ?', [badge_number]);
    if (officer.length === 0) {
      recordFailedAttempt(loginAttempts, attemptKey);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcryptjs.compare(password, officer[0].password_hash);
    if (!valid) {
      recordFailedAttempt(loginAttempts, attemptKey);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    loginAttempts.delete(attemptKey);

    const token = signOfficerToken({
      id: officer[0].id,
      email: officer[0].name,
      role: officer[0].role,
      badge_number: officer[0].badge_number,
    });

    const station = dbExec('SELECT * FROM stations WHERE id = ?', [officer[0].station_id]);

    res.json({
      token,
      officer: {
        id: officer[0].id,
        name: officer[0].name,
        badge_number: officer[0].badge_number,
        role: officer[0].role,
        station: station.length > 0 ? station[0] : {},
      },
    });
  } catch (error) {
    console.error('Login handler error:', error);
    res.status(500).json({ error: 'Failed to process login' });
  }
});

function recordFailedAttempt(map: Map<string, { count: number; lockUntil: number }>, key: string): void {
  const current = map.get(key) || { count: 0, lockUntil: 0 };
  current.count += 1;
  if (current.count >= 5) {
    current.lockUntil = Date.now() + 60 * 1000;
    current.count = 0;
  }
  map.set(key, current);
}

app.get('/api/dispatch/alerts', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT a.*, c.name, c.phone_number, c.barangay,
      t.score as trust_score
      FROM sos_alerts a
      JOIN citizens c ON a.citizen_id = c.id
      LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id
    `;
    const params: any[] = [];

    if (status) {
      query += ' WHERE a.status = ?';
      params.push(status);
    }
    query += ' ORDER BY a.triggered_at DESC';

    const alerts = dbExec(query, params);
    res.json({ alerts });
  } catch (error) {
    console.error('Get alerts handler error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

app.get('/api/dispatch/alerts/:id', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const alert = dbExec(
      `SELECT a.*, c.name, c.phone_number, c.barangay,
       t.score as trust_score FROM sos_alerts a
       JOIN citizens c ON a.citizen_id = c.id
       LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id
       WHERE a.id = ?`,
      [req.params.id]
    );

    if (alert.length === 0) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const locationHistory = dbExec('SELECT latitude, longitude, recorded_at FROM alert_location_history WHERE alert_id = ? ORDER BY recorded_at ASC', [alert[0].id]);

    res.json({
      alert: {
        ...alert[0],
        location_history: locationHistory.map((loc: any) => ({ lat: loc.latitude, lng: loc.longitude, recorded_at: loc.recorded_at })),
      },
    });
  } catch (error) {
    console.error('Get alert detail handler error:', error);
    res.status(500).json({ error: 'Failed to fetch alert details' });
  }
});

app.post('/api/dispatch/alerts/:id/acknowledge', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const officerPayload = (req as any).officer as OfficerPayload;
    const alert = dbExec('SELECT * FROM sos_alerts WHERE id = ?', [req.params.id]);

    if (alert.length === 0) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    if (alert[0].status !== 'ACTIVE') {
      res.status(400).json({ error: 'Alert is not in ACTIVE status' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    dbRun('UPDATE sos_alerts SET status = ?, acknowledged_at = ?, acknowledged_by = ? WHERE id = ?', ['ACKNOWLEDGED', now, officerPayload.id, alert[0].id]);

    const updated = dbExec('SELECT * FROM sos_alerts WHERE id = ?', [alert[0].id]);
    res.json({ alert: updated.length > 0 ? updated[0] : {} });
  } catch (error) {
    console.error('Acknowledge handler error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

app.post('/api/dispatch/alerts/:id/resolve', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { notes } = req.body;
    const alert = dbExec('SELECT * FROM sos_alerts WHERE id = ?', [req.params.id]);

    if (alert.length === 0) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    if (!['ACTIVE', 'ACKNOWLEDGED'].includes(alert[0].status)) {
      res.status(400).json({ error: 'Alert cannot be resolved in current status' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    dbRun('UPDATE sos_alerts SET status = ?, resolved_at = ?, resolution_notes = ? WHERE id = ?', ['RESOLVED', now, notes || null, alert[0].id]);

    const trust = dbExec('SELECT score FROM citizen_trust_scores WHERE citizen_id = ?', [alert[0].citizen_id]);
    const newScore = Math.min(100, (trust.length > 0 ? trust[0].score : 100) + 10);
    dbRun('UPDATE citizen_trust_scores SET score = ?, verified_alert_count = verified_alert_count + 1 WHERE citizen_id = ?', [newScore, alert[0].citizen_id]);

    const updated = dbExec('SELECT * FROM sos_alerts WHERE id = ?', [alert[0].id]);
    res.json({ alert: updated.length > 0 ? updated[0] : {} });
  } catch (error) {
    console.error('Resolve handler error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

app.post('/api/dispatch/alerts/:id/false-alarm', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { notes } = req.body;
    const alert = dbExec('SELECT * FROM sos_alerts WHERE id = ?', [req.params.id]);

    if (alert.length === 0) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    dbRun('UPDATE sos_alerts SET status = ?, resolved_at = ?, resolution_notes = ? WHERE id = ?', ['FALSE_ALARM', now, notes || null, alert[0].id]);

    const trust = dbExec('SELECT score FROM citizen_trust_scores WHERE citizen_id = ?', [alert[0].citizen_id]);
    const newScore = Math.max(0, (trust.length > 0 ? trust[0].score : 100) - 15);
    dbRun('UPDATE citizen_trust_scores SET score = ?, false_alarm_count = false_alarm_count + 1 WHERE citizen_id = ?', [newScore, alert[0].citizen_id]);

    const updated = dbExec('SELECT * FROM sos_alerts WHERE id = ?', [alert[0].id]);
    res.json({ alert: updated.length > 0 ? updated[0] : {} });
  } catch (error) {
    console.error('False alarm handler error:', error);
    res.status(500).json({ error: 'Failed to mark false alarm' });
  }
});

app.post('/api/dispatch/alerts/:id/suspicious', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const alert = dbExec('SELECT * FROM sos_alerts WHERE id = ?', [req.params.id]);

    if (alert.length === 0) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    dbRun('UPDATE sos_alerts SET is_suspicious = ? WHERE id = ?', [1, alert[0].id]);

    const updated = dbExec('SELECT * FROM sos_alerts WHERE id = ?', [alert[0].id]);
    res.json({ alert: updated.length > 0 ? updated[0] : {} });
  } catch (error) {
    console.error('Suspicious handler error:', error);
    res.status(500).json({ error: 'Failed to flag alert' });
  }
});

app.get('/api/dispatch/citizens', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT c.*, t.score as trust_score, t.false_alarm_count, t.verified_alert_count
      FROM citizens c
      LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ' AND (c.name LIKE ? OR c.phone_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY c.created_at DESC';

    const citizens = dbExec(query, params);
    res.json({ citizens });
  } catch (error) {
    console.error('Get citizens handler error:', error);
    res.status(500).json({ error: 'Failed to fetch citizens' });
  }
});

app.get('/api/dispatch/citizens/:id', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const citizen = dbExec(`
      SELECT c.*, t.score as trust_score, t.false_alarm_count, t.verified_alert_count
      FROM citizens c
      LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (citizen.length === 0) {
      res.status(404).json({ error: 'Citizen not found' });
      return;
    }

    const alerts = dbExec('SELECT * FROM sos_alerts WHERE citizen_id = ? ORDER BY triggered_at DESC', [citizen[0].id]);

    res.json({ citizen: citizen[0], alerts });
  } catch (error) {
    console.error('Get citizen detail handler error:', error);
    res.status(500).json({ error: 'Failed to fetch citizen details' });
  }
});

app.post('/api/dispatch/citizens/:id/suspend', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    dbRun('UPDATE citizens SET status = ? WHERE id = ?', ['SUSPENDED', req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Suspend citizen handler error:', error);
    res.status(500).json({ error: 'Failed to suspend citizen' });
  }
});

app.post('/api/dispatch/citizens/:id/unsuspend', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    dbRun('UPDATE citizens SET status = ? WHERE id = ?', ['ACTIVE', req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Unsuspend citizen handler error:', error);
    res.status(500).json({ error: 'Failed to unsuspend citizen' });
  }
});

app.post('/api/dispatch/citizens/:id/reset-strikes', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    dbRun('UPDATE citizen_trust_scores SET false_alarm_count = ? WHERE citizen_id = ?', [0, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Reset strikes handler error:', error);
    res.status(500).json({ error: 'Failed to reset strikes' });
  }
});

app.get('/api/dispatch/officers', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const officers = dbExec('SELECT o.*, s.name as station_name FROM officers o LEFT JOIN stations s ON o.station_id = s.id ORDER BY o.created_at DESC');
    res.json({ officers: officers.map((o: any) => ({ ...o, password_hash: undefined })) });
  } catch (error) {
    console.error('Get officers handler error:', error);
    res.status(500).json({ error: 'Failed to fetch officers' });
  }
});

app.post('/api/dispatch/officers', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { name, badge_number, password, role } = req.body;
    if (!name || !badge_number || !password || !role) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const station = dbExec('SELECT id FROM stations LIMIT 1');
    const passwordHash = await bcryptjs.hash(password, 10);

    dbRun('INSERT INTO officers (station_id, badge_number, name, role, password_hash) VALUES (?, ?, ?, ?, ?)', [
      station.length > 0 ? station[0].id : 1,
      badge_number,
      name,
      role,
      passwordHash,
    ]);

    res.status(201).json({ success: true });
  } catch (error: any) {
    console.error('Create officer handler error:', error);
    res.status(500).json({ error: 'Failed to create officer' });
  }
});

app.post('/api/dispatch/officers/:id/toggle-active', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const officer = dbExec('SELECT * FROM officers WHERE id = ?', [req.params.id]);

    if (officer.length === 0) {
      res.status(404).json({ error: 'Officer not found' });
      return;
    }

    const newStatus = officer[0].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    dbRun('UPDATE officers SET status = ? WHERE id = ?', [newStatus, officer[0].id]);
    res.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Toggle active handler error:', error);
    res.status(500).json({ error: 'Failed to toggle officer status' });
  }
});

app.get('/api/dispatch/stats', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const total = dbExec('SELECT COUNT(*) as c FROM sos_alerts');
    const active = dbExec("SELECT COUNT(*) as c FROM sos_alerts WHERE status = ?", ['ACTIVE']);
    const acknowledged = dbExec("SELECT COUNT(*) as c FROM sos_alerts WHERE status = ?", ['ACKNOWLEDGED']);
    const resolved = dbExec("SELECT COUNT(*) as c FROM sos_alerts WHERE status = ?", ['RESOLVED']);
    const falseAlarms = dbExec("SELECT COUNT(*) as c FROM sos_alerts WHERE status = ?", ['FALSE_ALARM']);

    res.json({
      stats: {
        total: total.length > 0 ? total[0].c : 0,
        active: active.length > 0 ? active[0].c : 0,
        acknowledged: acknowledged.length > 0 ? acknowledged[0].c : 0,
        resolved: resolved.length > 0 ? resolved[0].c : 0,
        false_alarms: falseAlarms.length > 0 ? falseAlarms[0].c : 0,
        false_alarm_rate: 0,
      },
    });
  } catch (error) {
    console.error('Stats handler error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/dispatch/settings', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const settings = dbExec('SELECT * FROM station_settings LIMIT 1');
    const station = dbExec('SELECT * FROM stations LIMIT 1');
    res.json({ settings: settings.length > 0 ? settings[0] : {}, station: station.length > 0 ? station[0] : {} });
  } catch (error) {
    console.error('Get settings handler error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/dispatch/settings', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { surge_threshold, surge_window_minutes, response_timeout_minutes } = req.body;
    dbRun(
      'UPDATE station_settings SET surge_threshold = COALESCE(?, surge_threshold), surge_window_minutes = COALESCE(?, surge_window_minutes), response_timeout_minutes = COALESCE(?, response_timeout_minutes) WHERE id = 1',
      [surge_threshold || null, surge_window_minutes || null, response_timeout_minutes || null]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Update settings handler error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'SafeSignal API is running' });
});

// Default 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

export default app;
