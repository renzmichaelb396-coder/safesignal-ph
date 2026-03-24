import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, hashPin } from './database';
import { signOfficerToken, requireOfficerAuth, requireAdminAuth, OfficerPayload } from './auth';
import { broadcastEvent } from './sse';

const router = Router();

// Track login attempts for lockout
const loginAttempts = new Map<string, { count: number; lockUntil: number }>();

// POST /api/dispatch/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, badge_number } = req.body;
    if (!email || !password || !badge_number) {
      res.status(400).json({ error: 'email, password, and badge_number are required' });
      return;
    }

    const attemptKey = email.toLowerCase();
    const attempts = loginAttempts.get(attemptKey);
    if (attempts && attempts.lockUntil > Date.now()) {
      const remaining = Math.ceil((attempts.lockUntil - Date.now()) / 1000);
      res.status(429).json({ error: `Too many attempts. Try again in ${remaining} seconds.`, locked_until: attempts.lockUntil });
      return;
    }

    const db = getDb();
    const officer = db.prepare(`
      SELECT * FROM officers WHERE email = ? AND badge_number = ? AND is_active = 1
    `).get(email, badge_number) as any;

    if (!officer) {
      recordFailedAttempt(loginAttempts, attemptKey);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, officer.password_hash);
    if (!valid) {
      recordFailedAttempt(loginAttempts, attemptKey);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    loginAttempts.delete(attemptKey);
    db.prepare('UPDATE officers SET last_login = ? WHERE id = ?').run(Date.now(), officer.id);

    const token = signOfficerToken({
      id: officer.id,
      email: officer.email,
      role: officer.role,
      badge_number: officer.badge_number,
    });

    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(officer.station_id) as any;

    res.json({
      token,
      officer: {
        id: officer.id,
        full_name: officer.full_name,
        badge_number: officer.badge_number,
        role: officer.role,
        email: officer.email,
        station,
      }
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

// GET /api/dispatch/alerts
router.get('/alerts', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const db = getDb();
    let query = `
      SELECT a.*, c.full_name, c.phone, c.barangay, c.address, c.photo_url,
      c.strike_count, c.is_suspended,
      t.score as trust_score,
      o.full_name as officer_name, o.badge_number as officer_badge
      FROM sos_alerts a
      JOIN citizens c ON a.citizen_id = c.id
      LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id
      LEFT JOIN officers o ON a.assigned_officer_id = o.id
    `;
    const params: any[] = [];
    if (status) {
      query += ' WHERE a.status = ?';
      params.push(status);
    }
    query += ' ORDER BY a.triggered_at DESC';

    const alerts = db.prepare(query).all(...params) as any[];
    res.json({ alerts: alerts.map(normalizeAlert) });
  } catch (error) {
    console.error('Get alerts handler error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/dispatch/alerts/export
router.get('/alerts/export', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const alerts = db.prepare(`
      SELECT a.id, c.full_name, c.phone, c.barangay, a.status,
      a.triggered_at, a.acknowledged_at, a.resolved_at, a.cancelled_at,
      a.lat, a.lng, a.notes, a.cancellation_reason,
      o.full_name as officer_name, o.badge_number as officer_badge,
      t.score as trust_score
      FROM sos_alerts a
      JOIN citizens c ON a.citizen_id = c.id
      LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id
      LEFT JOIN officers o ON a.assigned_officer_id = o.id
      WHERE a.status IN ('RESOLVED','CANCELLED','FALSE_ALARM')
      ORDER BY a.triggered_at DESC
    `).all() as any[];

    const headers = ['ID','Citizen','Phone','Barangay','Status','Triggered','Acknowledged','Resolved','Cancelled','Lat','Lng','Officer','Badge','Trust Score','Notes'];
    const rows = alerts.map(a => [
      a.id, a.full_name, a.phone, a.barangay, a.status,
      a.triggered_at ? new Date(a.triggered_at).toISOString() : '',
      a.acknowledged_at ? new Date(a.acknowledged_at).toISOString() : '',
      a.resolved_at ? new Date(a.resolved_at).toISOString() : '',
      a.cancelled_at ? new Date(a.cancelled_at).toISOString() : '',
      a.lat, a.lng, a.officer_name || '', a.officer_badge || '', a.trust_score || '',
      (a.notes || a.cancellation_reason || '').replace(/,/g, ';')
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="safesignal-alerts.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export alerts handler error:', error);
    res.status(500).json({ error: 'Failed to export alerts' });
  }
});

// GET /api/dispatch/alerts/:id
router.get('/alerts/:id', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const alert = db.prepare(`
      SELECT a.*, c.full_name, c.phone, c.barangay, c.address, c.photo_url,
      c.strike_count, c.is_suspended,
      t.score as trust_score, t.total_alerts, t.false_alarms, t.resolved_emergencies,
      o.full_name as officer_name, o.badge_number as officer_badge
      FROM sos_alerts a
      JOIN citizens c ON a.citizen_id = c.id
      LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id
      LEFT JOIN officers o ON a.assigned_officer_id = o.id
      WHERE a.id = ?
    `).get(req.params.id) as any;

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const locationHistory = db.prepare(`
      SELECT lat, lng, recorded_at FROM alert_location_history WHERE alert_id = ? ORDER BY recorded_at ASC
    `).all(alert.id) as any[];

    res.json({ alert: { ...normalizeAlert(alert), location_history: locationHistory } });
  } catch (error) {
    console.error('Get alert detail handler error:', error);
    res.status(500).json({ error: 'Failed to fetch alert details' });
  }
});

// POST /api/dispatch/alerts/:id/acknowledge
router.post('/alerts/:id/acknowledge', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const officerPayload = (req as any).officer as OfficerPayload;
    const db = getDb();
    const alert = db.prepare('SELECT * FROM sos_alerts WHERE id = ?').get(req.params.id) as any;

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    if (alert.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Alert is not in ACTIVE status' });
      return;
    }

    const now = Date.now();
    db.prepare(`
      UPDATE sos_alerts SET status = 'ACKNOWLEDGED', acknowledged_at = ?, assigned_officer_id = ? WHERE id = ?
    `).run(now, officerPayload.id, alert.id);

    const updated = getFullAlert(db, alert.id);
    broadcastEvent('alert_updated', { alert: updated });
    res.json({ alert: updated });
  } catch (error) {
    console.error('Acknowledge handler error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// POST /api/dispatch/alerts/:id/resolve
router.post('/alerts/:id/resolve', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { notes } = req.body;
    const db = getDb();
    const alert = db.prepare('SELECT * FROM sos_alerts WHERE id = ?').get(req.params.id) as any;

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    if (!['ACTIVE', 'ACKNOWLEDGED'].includes(alert.status)) {
      res.status(400).json({ error: 'Alert cannot be resolved in current status' });
      return;
    }

    const now = Date.now();
    db.prepare(`
      UPDATE sos_alerts SET status = 'RESOLVED', resolved_at = ?, notes = ? WHERE id = ?
    `).run(now, notes || null, alert.id);

    const trust = db.prepare('SELECT score FROM citizen_trust_scores WHERE citizen_id = ?').get(alert.citizen_id) as any;
    const newScore = Math.min(100, (trust?.score || 100) + 10);
    db.prepare(`
      UPDATE citizen_trust_scores SET score = ?, resolved_emergencies = resolved_emergencies + 1, last_updated = ? WHERE citizen_id = ?
    `).run(newScore, now, alert.citizen_id);

    const updated = getFullAlert(db, alert.id);
    broadcastEvent('alert_updated', { alert: updated });
    res.json({ alert: updated });
  } catch (error) {
    console.error('Resolve handler error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// POST /api/dispatch/alerts/:id/false-alarm
router.post('/alerts/:id/false-alarm', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { notes } = req.body;
    const db = getDb();
    const alert = db.prepare('SELECT * FROM sos_alerts WHERE id = ?').get(req.params.id) as any;

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const now = Date.now();
    db.prepare(`
      UPDATE sos_alerts SET status = 'FALSE_ALARM', cancelled_at = ?, notes = ? WHERE id = ?
    `).run(now, notes || null, alert.id);

    const citizen = db.prepare('SELECT * FROM citizens WHERE id = ?').get(alert.citizen_id) as any;
    const settings = db.prepare('SELECT * FROM station_settings LIMIT 1').get() as any;
    const strikeLimit = settings?.strike_limit || 3;
    const newStrikes = (citizen.strike_count || 0) + 1;

    let isSuspended = citizen.is_suspended;
    let suspensionReason = citizen.suspension_reason;
    if (newStrikes >= strikeLimit) {
      isSuspended = 1;
      suspensionReason = `Auto-suspended after ${newStrikes} false alarms`;
    }

    db.prepare(`
      UPDATE citizens SET strike_count = ?, is_suspended = ?, suspension_reason = ? WHERE id = ?
    `).run(newStrikes, isSuspended, suspensionReason, alert.citizen_id);

    const trust = db.prepare('SELECT score FROM citizen_trust_scores WHERE citizen_id = ?').get(alert.citizen_id) as any;
    const newScore = Math.max(0, (trust?.score || 100) - 15);
    db.prepare(`
      UPDATE citizen_trust_scores SET score = ?, false_alarms = false_alarms + 1, last_updated = ? WHERE citizen_id = ?
    `).run(newScore, now, alert.citizen_id);

    const updated = getFullAlert(db, alert.id);
    broadcastEvent('alert_updated', { alert: updated });
    res.json({ alert: updated });
  } catch (error) {
    console.error('False alarm handler error:', error);
    res.status(500).json({ error: 'Failed to mark false alarm' });
  }
});

// POST /api/dispatch/alerts/:id/suspicious
router.post('/alerts/:id/suspicious', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const db = getDb();
    const alert = db.prepare('SELECT * FROM sos_alerts WHERE id = ?').get(req.params.id) as any;

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    db.prepare(`
      UPDATE sos_alerts SET is_suspicious = 1, suspicious_reason = ? WHERE id = ?
    `).run(reason || 'Flagged by dispatcher', alert.id);

    const updated = getFullAlert(db, alert.id);
    broadcastEvent('alert_updated', { alert: updated });
    res.json({ alert: updated });
  } catch (error) {
    console.error('Suspicious handler error:', error);
    res.status(500).json({ error: 'Failed to flag alert' });
  }
});

// GET /api/dispatch/citizens
router.get('/citizens', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { search, filter } = req.query;
    const db = getDb();
    let query = `
      SELECT c.*, t.score as trust_score, t.total_alerts, t.false_alarms, t.resolved_emergencies
      FROM citizens c
      LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ' AND (c.full_name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (filter === 'suspended') {
      query += ' AND c.is_suspended = 1';
    } else if (filter === 'active') {
      query += ' AND c.is_suspended = 0';
    }
    query += ' ORDER BY c.registered_at DESC';

    const citizens = db.prepare(query).all(...params) as any[];
    res.json({ citizens: citizens.map(normalizeCitizen) });
  } catch (error) {
    console.error('Get citizens handler error:', error);
    res.status(500).json({ error: 'Failed to fetch citizens' });
  }
});

// GET /api/dispatch/citizens/:id
router.get('/citizens/:id', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const citizen = db.prepare(`
      SELECT c.*, t.score as trust_score, t.total_alerts, t.false_alarms, t.resolved_emergencies
      FROM citizens c
      LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id
      WHERE c.id = ?
    `).get(req.params.id) as any;

    if (!citizen) {
      res.status(404).json({ error: 'Citizen not found' });
      return;
    }

    const alerts = db.prepare(`
      SELECT * FROM sos_alerts WHERE citizen_id = ? ORDER BY triggered_at DESC
    `).all(citizen.id) as any[];

    res.json({ citizen: normalizeCitizen(citizen), alerts: alerts.map(normalizeAlert) });
  } catch (error) {
    console.error('Get citizen detail handler error:', error);
    res.status(500).json({ error: 'Failed to fetch citizen details' });
  }
});

// POST /api/dispatch/citizens/:id/suspend
router.post('/citizens/:id/suspend', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const db = getDb();
    db.prepare(`
      UPDATE citizens SET is_suspended = 1, suspension_reason = ? WHERE id = ?
    `).run(reason || 'Suspended by dispatcher', req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Suspend citizen handler error:', error);
    res.status(500).json({ error: 'Failed to suspend citizen' });
  }
});

// POST /api/dispatch/citizens/:id/unsuspend
router.post('/citizens/:id/unsuspend', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    db.prepare(`
      UPDATE citizens SET is_suspended = 0, suspension_reason = NULL WHERE id = ?
    `).run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Unsuspend citizen handler error:', error);
    res.status(500).json({ error: 'Failed to unsuspend citizen' });
  }
});

// POST /api/dispatch/citizens/:id/reset-strikes
router.post('/citizens/:id/reset-strikes', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    db.prepare('UPDATE citizens SET strike_count = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Reset strikes handler error:', error);
    res.status(500).json({ error: 'Failed to reset strikes' });
  }
});

// GET /api/dispatch/officers
router.get('/officers', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const officers = db.prepare(`
      SELECT o.*, s.name as station_name FROM officers o
      LEFT JOIN stations s ON o.station_id = s.id
      ORDER BY o.created_at DESC
    `).all() as any[];
    res.json({ officers: officers.map(o => ({ ...o, password_hash: undefined })) });
  } catch (error) {
    console.error('Get officers handler error:', error);
    res.status(500).json({ error: 'Failed to fetch officers' });
  }
});

// POST /api/dispatch/officers
router.post('/officers', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { full_name, email, badge_number, password, role } = req.body;
    if (!full_name || !email || !badge_number || !password || !role) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const db = getDb();
    const station = db.prepare('SELECT id FROM stations LIMIT 1').get() as any;
    const passwordHash = await bcrypt.hash(password, 10);

    const result = db.prepare(`
      INSERT INTO officers (full_name, email, badge_number, station_id, role, password_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(full_name, email, badge_number, station.id, role, passwordHash);
    res.status(201).json({ officer: { id: result.lastInsertRowid, full_name, email, badge_number, role } });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Email or badge number already exists' });
    } else {
      console.error('Create officer handler error:', err);
      res.status(500).json({ error: 'Failed to create officer' });
    }
  }
});

// POST /api/dispatch/officers/:id/toggle-active
router.post('/officers/:id/toggle-active', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const officerPayload = (req as any).officer as OfficerPayload;
    const db = getDb();
    const officer = db.prepare('SELECT * FROM officers WHERE id = ?').get(req.params.id) as any;

    if (!officer) {
      res.status(404).json({ error: 'Officer not found' });
      return;
    }
    if (officer.id === officerPayload.id) {
      res.status(400).json({ error: 'Cannot deactivate yourself' });
      return;
    }

    db.prepare('UPDATE officers SET is_active = ? WHERE id = ?').run(officer.is_active ? 0 : 1, officer.id);
    res.json({ success: true, is_active: !officer.is_active });
  } catch (error) {
    console.error('Toggle active handler error:', error);
    res.status(500).json({ error: 'Failed to toggle officer status' });
  }
});

// GET /api/dispatch/stats
router.get('/stats', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const total = (db.prepare('SELECT COUNT(*) as c FROM sos_alerts').get() as any).c;
    const active = (db.prepare("SELECT COUNT(*) as c FROM sos_alerts WHERE status = 'ACTIVE'").get() as any).c;
    const acknowledged = (db.prepare("SELECT COUNT(*) as c FROM sos_alerts WHERE status = 'ACKNOWLEDGED'").get() as any).c;
    const resolved = (db.prepare("SELECT COUNT(*) as c FROM sos_alerts WHERE status = 'RESOLVED'").get() as any).c;
    const falseAlarms = (db.prepare("SELECT COUNT(*) as c FROM sos_alerts WHERE status = 'FALSE_ALARM'").get() as any).c;
    const cancelled = (db.prepare("SELECT COUNT(*) as c FROM sos_alerts WHERE status = 'CANCELLED'").get() as any).c;

    const avgResponse = db.prepare(`
      SELECT AVG(acknowledged_at - triggered_at) as avg_ms
      FROM sos_alerts WHERE acknowledged_at IS NOT NULL
    `).get() as any;

    res.json({
      stats: {
        total, active, acknowledged, resolved, false_alarms: falseAlarms, cancelled,
        false_alarm_rate: total > 0 ? Math.round((falseAlarms / total) * 100) : 0,
        avg_response_time_ms: avgResponse?.avg_ms || 0,
      }
    });
  } catch (error) {
    console.error('Stats handler error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/dispatch/settings
router.get('/settings', requireOfficerAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM station_settings LIMIT 1').get();
    const station = db.prepare('SELECT * FROM stations LIMIT 1').get();
    res.json({ settings, station });
  } catch (error) {
    console.error('Get settings handler error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/dispatch/settings
router.put('/settings', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { surge_threshold, surge_window_minutes, cooldown_minutes, strike_limit } = req.body;
    const db = getDb();
    db.prepare(`
      UPDATE station_settings SET
      surge_threshold = COALESCE(?, surge_threshold),
      surge_window_minutes = COALESCE(?, surge_window_minutes),
      cooldown_minutes = COALESCE(?, cooldown_minutes),
      strike_limit = COALESCE(?, strike_limit)
      WHERE id = 1
    `).run(surge_threshold || null, surge_window_minutes || null, cooldown_minutes || null, strike_limit || null);
    res.json({ success: true });
  } catch (error) {
    console.error('Update settings handler error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

function getFullAlert(db: any, alertId: number): any {
  const alert = db.prepare(`
    SELECT a.*, c.full_name, c.phone, c.barangay, c.address, c.photo_url,
    c.strike_count, c.is_suspended,
    t.score as trust_score, t.total_alerts, t.false_alarms, t.resolved_emergencies,
    o.full_name as officer_name, o.badge_number as officer_badge
    FROM sos_alerts a
    JOIN citizens c ON a.citizen_id = c.id
    LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id
    LEFT JOIN officers o ON a.assigned_officer_id = o.id
    WHERE a.id = ?
  `).get(alertId);
  if (!alert) return null;
  return normalizeAlert(alert);
}

function normalizeAlert(a: any): any {
  return {
    ...a,
    is_suspicious: a.is_suspicious === 1,
    password_hash: undefined,
  };
}

function normalizeCitizen(c: any): any {
  return {
    ...c,
    is_suspended: c.is_suspended === 1,
    verified: c.verified === 1,
    pin_hash: undefined,
  };
}

export default router;
