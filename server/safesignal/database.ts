import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../safesignal.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Migration guard: delete DB if schema is stale OR seed emails are wrong
  try {
    const o = db.prepare("SELECT email FROM officers WHERE email = 'dispatcher@pasay.safesignal.ph'").get();
    if (!o) throw new Error('stale seed');
  } catch {
    db.close();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }

  initSchema();
  seedData();
  return db;
}

export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function initSchema(): void {
  if (!db) return;

  db.exec(`CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    barangay TEXT,
    latitude REAL,
    longitude REAL,
    contact_number TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS officers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL,
    badge_number TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'DISPATCHER',
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (station_id) REFERENCES stations(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS citizens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE,
    address TEXT,
    barangay TEXT,
    city TEXT,
    photo_url TEXT,
    latitude REAL,
    longitude REAL,
    pin_hash TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    strike_count INTEGER NOT NULL DEFAULT 0,
    is_suspended INTEGER NOT NULL DEFAULT 0,
    suspension_reason TEXT,
    emergency_contacts TEXT,
    registered_at INTEGER DEFAULT (strftime('%s','now')),
    last_active INTEGER
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS citizen_trust_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_id INTEGER NOT NULL UNIQUE,
    score REAL DEFAULT 100.0,
    total_alerts INTEGER DEFAULT 0,
    false_alarms INTEGER DEFAULT 0,
    resolved_emergencies INTEGER DEFAULT 0,
    last_updated INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (citizen_id) REFERENCES citizens(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sos_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_id INTEGER NOT NULL,
    station_id INTEGER,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    alert_type TEXT DEFAULT 'EMERGENCY',
    description TEXT,
    lat REAL,
    lng REAL,
    location_accuracy REAL,
    triggered_at INTEGER DEFAULT (strftime('%s','now')),
    acknowledged_at INTEGER,
    assigned_officer_id INTEGER,
    resolved_at INTEGER,
    cancelled_at INTEGER,
    notes TEXT,
    cancellation_reason TEXT,
    is_suspicious INTEGER DEFAULT 0,
    suspicious_reason TEXT,
    FOREIGN KEY (citizen_id) REFERENCES citizens(id),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (assigned_officer_id) REFERENCES officers(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS alert_location_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL,
    lat REAL,
    lng REAL,
    recorded_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (alert_id) REFERENCES sos_alerts(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS station_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL UNIQUE,
    surge_threshold INTEGER DEFAULT 5,
    surge_window_minutes INTEGER DEFAULT 2,
    cooldown_minutes INTEGER DEFAULT 10,
    strike_limit INTEGER DEFAULT 3,
    response_timeout_minutes INTEGER DEFAULT 15,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (station_id) REFERENCES stations(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    expires_at INTEGER,
    is_used INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (citizen_id) REFERENCES citizens(id)
  )`);
}

function seedData(): void {
  if (!db) return;
  const stationCount = (db.prepare('SELECT COUNT(*) as count FROM stations').get() as { count: number }).count;
  if (stationCount > 0) return;

  // Station (map center: Pasay Police Station)
  const stationId = db.prepare(
    `INSERT INTO stations (name, barangay, latitude, longitude, contact_number) VALUES (?, ?, ?, ?, ?)`
  ).run('Pasay City Police Station', 'Pasay City', 14.5547, 120.9987, '+63-2-8551-0000').lastInsertRowid as number;

  // Officers — Local dev credentials:
  //   PNP-001 / pnp001@safesignal.ph / password123  (DISPATCHER)
  //   PNP-002 / pnp002@safesignal.ph / password123  (DISPATCHER)
  //   ADM-001 / adm001@safesignal.ph / password123  (STATION_ADMIN)
  const officerStmt = db.prepare(
    `INSERT INTO officers (station_id, badge_number, email, full_name, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const officerDefs = [
    { badge: 'PNP-001', email: 'dispatcher@pasay.safesignal.ph', name: 'Maria Lopez', role: 'DISPATCHER' },
    { badge: 'PNP-002', email: 'officer@pasay.safesignal.ph', name: 'Carlos Mendoza', role: 'DISPATCHER' },
    { badge: 'PNP-ADM', email: 'admin@pasay.safesignal.ph', name: 'Chief Antonio Reyes', role: 'STATION_ADMIN' },
  ];
  for (const o of officerDefs) {
    officerStmt.run(stationId, o.badge, o.email, o.name, o.role, bcryptjs.hashSync('password123', 10));
  }

  // Citizens (pre-verified for testing, PIN: 1234)
  const citizenStmt = db.prepare(
    `INSERT INTO citizens (full_name, phone, barangay, latitude, longitude, pin_hash, verified) VALUES (?, ?, ?, ?, ?, ?, 1)`
  );
  const citizenDefs = [
    { name: 'Juan Dela Cruz',  phone: '09171234567', barangay: 'Pasay City', lat: 14.5400, lng: 120.9950 },
    { name: 'Maria Santos',    phone: '09172345678', barangay: 'Pasay City', lat: 14.5350, lng: 120.9920 },
    { name: 'Pedro Reyes',     phone: '09173456789', barangay: 'Pasay City', lat: 14.5380, lng: 120.9900 },
    { name: 'Ana Gonzales',    phone: '09174567890', barangay: 'Pasay City', lat: 14.5420, lng: 120.9960 },
    { name: 'Miguel Torres',   phone: '09175678901', barangay: 'Pasay City', lat: 14.5360, lng: 120.9880 },
  ];
  const citizenIds: number[] = [];
  for (const c of citizenDefs) {
    citizenIds.push(citizenStmt.run(c.name, c.phone, c.barangay, c.lat, c.lng, hashPin('1234')).lastInsertRowid as number);
  }

  // Trust scores
  const trustStmt = db.prepare(
    `INSERT INTO citizen_trust_scores (citizen_id, score, total_alerts, false_alarms, resolved_emergencies) VALUES (?, ?, ?, ?, ?)`
  );
  for (let i = 0; i < citizenIds.length; i++) {
    trustStmt.run(citizenIds[i], 95.0 - i * 5, i + 1, i > 0 ? 1 : 0, i + 1);
  }

  // Demo alerts
  const now = Date.now();
  const alertStmt = db.prepare(
    `INSERT INTO sos_alerts (citizen_id, station_id, status, alert_type, lat, lng, triggered_at, is_suspicious) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const alertDefs = [
    { ci: 0, status: 'ACTIVE',       suspicious: 0 },
    { ci: 1, status: 'ACKNOWLEDGED', suspicious: 0 },
    { ci: 2, status: 'RESOLVED',     suspicious: 0 },
    { ci: 3, status: 'FALSE_ALARM',  suspicious: 0 },
    { ci: 4, status: 'ACTIVE',       suspicious: 1 },
  ];
  for (let i = 0; i < alertDefs.length; i++) {
    const a = alertDefs[i];
    const c = citizenDefs[a.ci];
    const triggeredAt = now - 300_000 * (i + 1);
    const alertId = alertStmt.run(citizenIds[a.ci], stationId, a.status, 'EMERGENCY', c.lat, c.lng, triggeredAt, a.suspicious).lastInsertRowid;
    db.prepare(`INSERT INTO alert_location_history (alert_id, lat, lng, recorded_at) VALUES (?, ?, ?, ?)`)
      .run(alertId, c.lat, c.lng, triggeredAt);
  }

  // Station settings
  db.prepare(
    `INSERT INTO station_settings (station_id, surge_threshold, surge_window_minutes, cooldown_minutes, strike_limit, response_timeout_minutes) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(stationId, 5, 2, 10, 3, 15);
}
