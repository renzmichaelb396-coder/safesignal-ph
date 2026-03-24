import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../safesignal.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema();
  seedData();

  return db;
}

export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function initSchema(): void {
  if (!db) return;

  // Stations table
  db.exec(`
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

  // Officers table
  db.exec(`
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

  // Citizens table
  db.exec(`
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

  // Citizen trust scores table
  db.exec(`
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

  // SOS Alerts table
  db.exec(`
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

  // Alert location history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_location_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER NOT NULL,
      latitude REAL,
      longitude REAL,
      recorded_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (alert_id) REFERENCES sos_alerts(id)
    )
  `);

  // Station settings table
  db.exec(`
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

  // OTP codes table
  db.exec(`
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
}

function seedData(): void {
  if (!db) return;

  // Check if data already exists
  const stationCount = (db.prepare('SELECT COUNT(*) as count FROM stations').get() as { count: number }).count;
  if (stationCount > 0) return;

  // Create Pasay City Police Station
  const stationStmt = db.prepare(`
    INSERT INTO stations (name, barangay, latitude, longitude, contact_number)
    VALUES (?, ?, ?, ?, ?)
  `);
  const stationResult = stationStmt.run(
    'Pasay City Police Station',
    'Pasay City',
    14.5378,
    120.9932,
    '+63-2-8551-0000'
  );
  const stationId = stationResult.lastInsertRowid as number;

  // Create officers
  const officerStmt = db.prepare(`
    INSERT INTO officers (station_id, badge_number, name, role, password_hash)
    VALUES (?, ?, ?, ?, ?)
  `);

  const officers = [
    { badge: 'PNP-001', name: 'Maria Lopez', role: 'DISPATCHER' },
    { badge: 'PNP-002', name: 'Carlos Mendoza', role: 'DISPATCHER' },
    { badge: 'PNP-ADM', name: 'Chief Antonio Reyes', role: 'STATION_ADMIN' },
  ];

  const officerIds: number[] = [];
  for (const officer of officers) {
    const passwordHash = bcryptjs.hashSync('password123', 10);
    const result = officerStmt.run(stationId, officer.badge, officer.name, officer.role, passwordHash);
    officerIds.push(result.lastInsertRowid as number);
  }

  // Create citizens
  const citizenStmt = db.prepare(`
    INSERT INTO citizens (name, phone_number, barangay, latitude, longitude, pin_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

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
    const result = citizenStmt.run(
      citizen.name,
      citizen.phone,
      citizen.barangay,
      citizen.lat,
      citizen.lng,
      pinHash
    );
    citizenIds.push(result.lastInsertRowid as number);
  }

  // Create citizen trust scores
  const trustScoreStmt = db.prepare(`
    INSERT INTO citizen_trust_scores (citizen_id, score, false_alarm_count, verified_alert_count)
    VALUES (?, ?, ?, ?)
  `);

  for (let i = 0; i < citizenIds.length; i++) {
    trustScoreStmt.run(citizenIds[i], 95.0 - i * 5, i, 5 - i);
  }

  // Create demo alerts
  const now = Math.floor(Date.now() / 1000);
  const alertStmt = db.prepare(`
    INSERT INTO sos_alerts (citizen_id, station_id, status, alert_type, triggered_at, is_suspicious)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

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
    const result = alertStmt.run(
      citizenIds[alert.citizenIdx],
      stationId,
      alert.status,
      alert.type,
      triggeredAt,
      alert.suspicious
    );
    alertIds.push(result.lastInsertRowid as number);

    // Add location history for each alert
    const locationStmt = db.prepare(`
      INSERT INTO alert_location_history (alert_id, latitude, longitude, recorded_at)
      VALUES (?, ?, ?, ?)
    `);
    const citizen = citizens[alert.citizenIdx];
    locationStmt.run(alertIds[i], citizen.lat, citizen.lng, triggeredAt);
  }

  // Create station settings
  const settingsStmt = db.prepare(`
    INSERT INTO station_settings (station_id, surge_threshold, surge_window_minutes, response_timeout_minutes)
    VALUES (?, ?, ?, ?)
  `);
  settingsStmt.run(stationId, 5, 2, 15);
}
