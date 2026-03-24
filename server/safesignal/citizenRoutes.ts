import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, hashPin } from './database';
import { signCitizenToken, requireCitizenAuth, CitizenPayload } from './auth';
import { broadcastEvent } from './sse';
import { checkSurge } from './surgeDetection';

const router = Router();

// POST /api/citizen/register
router.post('/register', async (req: Request, res: Response) => {
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

    const db = getDb();
    const existing = db.prepare('SELECT id FROM citizens WHERE phone = ?').get(phone);
    if (existing) {
      res.status(409).json({ error: 'Phone number already registered' });
      return;
    }

    const pinHash = hashPin(pin);
    const result = db.prepare(`
      INSERT INTO citizens (full_name, phone, address, barangay, pin_hash, photo_url, verified)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(full_name, phone, address || null, barangay || null, pinHash, photo_url || null);

    const citizenId = result.lastInsertRowid as number;

    // Create trust score record
    db.prepare(`
      INSERT INTO citizen_trust_scores (citizen_id, score, total_alerts, false_alarms, resolved_emergencies)
      VALUES (?, 100, 0, 0, 0)
    `).run(citizenId);

    // Create mock OTP (always 123456 for demo)
    db.prepare(`
      INSERT INTO otp_codes (citizen_id, code, expires_at)
      VALUES (?, '123456', ?)
    `).run(citizenId, Date.now() + 10 * 60 * 1000);

    res.status(201).json({ citizen_id: citizenId, message: 'OTP sent to your phone' });
  } catch (error) {
    console.error('Register handler error:', error);
    res.status(500).json({ error: 'Failed to process registration' });
  }
});

// POST /api/citizen/verify-otp
router.post('/verify-otp', (req: Request, res: Response) => {
  try {
    const { citizen_id, otp } = req.body;
    if (!citizen_id || !otp) {
      res.status(400).json({ error: 'citizen_id and otp are required' });
      return;
    }

    // Mock: always accept "123456"
    if (otp !== '123456') {
      res.status(400).json({ error: 'Invalid OTP code' });
      return;
    }

    const db = getDb();
    const citizen = db.prepare('SELECT * FROM citizens WHERE id = ?').get(citizen_id) as any;
    if (!citizen) {
      res.status(404).json({ error: 'Citizen not found' });
      return;
    }

    db.prepare('UPDATE citizens SET verified = 1 WHERE id = ?').run(citizen_id);

    const token = signCitizenToken({ id: citizen.id, phone: citizen.phone });
    res.json({ token, citizen: { id: citizen.id, full_name: citizen.full_name, phone: citizen.phone } });
  } catch (error) {
    console.error('Verify OTP handler error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// POST /api/citizen/login
router.post('/login', (req: Request, res: Response) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      res.status(400).json({ error: 'phone and pin are required' });
      return;
    }

    const db = getDb();
    const citizen = db.prepare('SELECT * FROM citizens WHERE phone = ?').get(phone) as any;
    if (!citizen) {
      res.status(401).json({ error: 'Invalid phone or PIN' });
      return;
    }
    if (!citizen.verified) {
      res.status(401).json({ error: 'Account not verified. Please complete OTP verification.' });
      return;
    }

    const pinHash = hashPin(pin);
    if (citizen.pin_hash !== pinHash) {
      res.status(401).json({ error: 'Invalid phone or PIN' });
      return;
    }

    db.prepare('UPDATE citizens SET last_active = ? WHERE id = ?').run(Date.now(), citizen.id);

    const token = signCitizenToken({ id: citizen.id, phone: citizen.phone });
    res.json({
      token,
      citizen: {
        id: citizen.id,
        full_name: citizen.full_name,
        phone: citizen.phone,
        barangay: citizen.barangay,
        is_suspended: citizen.is_suspended === 1,
        suspension_reason: citizen.suspension_reason,
      }
    });
  } catch (error) {
    console.error('Login handler error:', error);
    res.status(500).json({ error: 'Failed to process login' });
  }
});

// GET /api/citizen/profile
router.get('/profile', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const db = getDb();
    const citizen = db.prepare('SELECT * FROM citizens WHERE id = ?').get(citizenPayload.id) as any;
    if (!citizen) {
      res.status(404).json({ error: 'Citizen not found' });
      return;
    }
    const trust = db.prepare('SELECT * FROM citizen_trust_scores WHERE citizen_id = ?').get(citizen.id) as any;

    res.json({
      citizen: {
        id: citizen.id,
        full_name: citizen.full_name,
        phone: citizen.phone,
        address: citizen.address,
        barangay: citizen.barangay,
        city: citizen.city,
        photo_url: citizen.photo_url,
        verified: citizen.verified === 1,
        strike_count: citizen.strike_count,
        is_suspended: citizen.is_suspended === 1,
        suspension_reason: citizen.suspension_reason,
        registered_at: citizen.registered_at,
        last_active: citizen.last_active,
        trust: trust ? {
          score: trust.score,
          total_alerts: trust.total_alerts,
          false_alarms: trust.false_alarms,
          resolved_emergencies: trust.resolved_emergencies,
        } : { score: 100, total_alerts: 0, false_alarms: 0, resolved_emergencies: 0 }
      }
    });
  } catch (error) {
    console.error('Profile handler error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/citizen/profile
router.put('/profile', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const { full_name, address, barangay, photo_url } = req.body;
    const db = getDb();
    db.prepare(`
      UPDATE citizens SET full_name = COALESCE(?, full_name), address = COALESCE(?, address),
      barangay = COALESCE(?, barangay), photo_url = COALESCE(?, photo_url) WHERE id = ?
    `).run(full_name || null, address || null, barangay || null, photo_url || null, citizenPayload.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Update profile handler error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/citizen/verify-pin
router.post('/verify-pin', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const { pin } = req.body;
    if (!pin) {
      res.status(400).json({ error: 'pin is required' });
      return;
    }
    const db = getDb();
    const citizen = db.prepare('SELECT pin_hash FROM citizens WHERE id = ?').get(citizenPayload.id) as any;
    const pinHash = hashPin(pin);
    res.json({ valid: citizen?.pin_hash === pinHash });
  } catch (error) {
    console.error('Verify PIN handler error:', error);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

// POST /api/citizen/sos
router.post('/sos', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const { lat, lng, accuracy, pin } = req.body;

    if (!lat || !lng || !pin) {
      res.status(400).json({ error: 'lat, lng, and pin are required' });
      return;
    }

    const db = getDb();
    const citizen = db.prepare('SELECT * FROM citizens WHERE id = ?').get(citizenPayload.id) as any;

    if (!citizen) {
      res.status(404).json({ error: 'Citizen not found' });
      return;
    }

    // Check suspension
    if (citizen.is_suspended) {
      res.status(403).json({ error: 'Account suspended', reason: citizen.suspension_reason });
      return;
    }

    // Verify PIN
    const pinHash = hashPin(pin);
    if (citizen.pin_hash !== pinHash) {
      res.status(401).json({ error: 'Invalid PIN' });
      return;
    }

    // Check cooldown (10 minutes)
    const settings = db.prepare('SELECT * FROM station_settings LIMIT 1').get() as any;
    const cooldownMs = (settings?.cooldown_minutes || 10) * 60 * 1000;
    const recentAlert = db.prepare(`
      SELECT id FROM sos_alerts
      WHERE citizen_id = ? AND status IN ('ACTIVE', 'ACKNOWLEDGED')
      AND triggered_at > ?
    `).get(citizenPayload.id, Date.now() - cooldownMs) as any;

    if (recentAlert) {
      res.status(429).json({ error: 'Cooldown active. Please wait before sending another alert.' });
      return;
    }

    // Check for existing active alert
    const activeAlert = db.prepare(`
      SELECT id FROM sos_alerts WHERE citizen_id = ? AND status IN ('ACTIVE', 'ACKNOWLEDGED')
    `).get(citizenPayload.id) as any;

    if (activeAlert) {
      res.status(409).json({ error: 'You already have an active alert', alert_id: activeAlert.id });
      return;
    }

    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO sos_alerts (citizen_id, lat, lng, status, triggered_at, location_accuracy)
      VALUES (?, ?, ?, 'ACTIVE', ?, ?)
    `).run(citizenPayload.id, lat, lng, now, accuracy || null);

    const alertId = result.lastInsertRowid as number;

    // Record initial GPS point
    db.prepare(`
      INSERT INTO alert_location_history (alert_id, lat, lng, recorded_at)
      VALUES (?, ?, ?, ?)
    `).run(alertId, lat, lng, now);

    // Update trust score total_alerts
    db.prepare(`
      UPDATE citizen_trust_scores SET total_alerts = total_alerts + 1, last_updated = ? WHERE citizen_id = ?
    `).run(now, citizenPayload.id);

    db.prepare('UPDATE citizens SET last_active = ? WHERE id = ?').run(now, citizenPayload.id);

    // Get full alert with citizen info for broadcast
    const alert = getAlertWithCitizen(db, alertId);

    // Broadcast SSE
    broadcastEvent('new_alert', { alert });

    // Check surge
    const surgeWarning = checkSurge(db, citizen.barangay, settings);
    if (surgeWarning) {
      broadcastEvent('surge_warning', surgeWarning);
    }

    res.status(201).json({ alert: { id: alertId, status: 'ACTIVE', triggered_at: now } });
  } catch (error) {
    console.error('SOS handler error:', error);
    res.status(500).json({ error: 'Failed to process SOS request' });
  }
});

// GET /api/citizen/active-alert
router.get('/active-alert', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const db = getDb();
    const alert = db.prepare(`
      SELECT a.*, o.full_name as officer_name, o.badge_number as officer_badge
      FROM sos_alerts a
      LEFT JOIN officers o ON a.assigned_officer_id = o.id
      WHERE a.citizen_id = ? AND a.status IN ('ACTIVE', 'ACKNOWLEDGED')
      ORDER BY a.triggered_at DESC LIMIT 1
    `).get(citizenPayload.id) as any;

    if (!alert) {
      res.json({ alert: null });
      return;
    }

    const locationHistory = db.prepare(`
      SELECT lat, lng, recorded_at FROM alert_location_history
      WHERE alert_id = ? ORDER BY recorded_at ASC
    `).all(alert.id) as any[];

    res.json({
      alert: {
        ...alert,
        is_suspicious: alert.is_suspicious === 1,
        location_history: locationHistory,
      }
    });
  } catch (error) {
    console.error('Active alert handler error:', error);
    res.status(500).json({ error: 'Failed to fetch active alert' });
  }
});

// POST /api/citizen/sos/cancel
router.post('/sos/cancel', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const { reason } = req.body;
    const db = getDb();

    const alert = db.prepare(`
      SELECT * FROM sos_alerts WHERE citizen_id = ? AND status IN ('ACTIVE', 'ACKNOWLEDGED')
      ORDER BY triggered_at DESC LIMIT 1
    `).get(citizenPayload.id) as any;

    if (!alert) {
      res.status(404).json({ error: 'No active alert found' });
      return;
    }

    const now = Date.now();
    db.prepare(`
      UPDATE sos_alerts SET status = 'CANCELLED', cancelled_at = ?, cancellation_reason = ? WHERE id = ?
    `).run(now, reason || 'No reason provided', alert.id);

    // Trust score: -5 for accidental cancel
    if (reason === 'Accidental' || reason === 'accidental') {
      const trust = db.prepare('SELECT score FROM citizen_trust_scores WHERE citizen_id = ?').get(citizenPayload.id) as any;
      const newScore = Math.max(0, (trust?.score || 100) - 5);
      db.prepare(`
        UPDATE citizen_trust_scores SET score = ?, last_updated = ? WHERE citizen_id = ?
      `).run(newScore, now, citizenPayload.id);
    }

    const updatedAlert = getAlertWithCitizen(db, alert.id);
    broadcastEvent('alert_updated', { alert: updatedAlert });

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel SOS handler error:', error);
    res.status(500).json({ error: 'Failed to cancel SOS' });
  }
});

// POST /api/citizen/location-update
router.post('/location-update', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const { lat, lng } = req.body;
    if (!lat || !lng) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    const db = getDb();
    const alert = db.prepare(`
      SELECT id FROM sos_alerts WHERE citizen_id = ? AND status IN ('ACTIVE', 'ACKNOWLEDGED')
      ORDER BY triggered_at DESC LIMIT 1
    `).get(citizenPayload.id) as any;

    if (!alert) {
      res.json({ success: false, message: 'No active alert' });
      return;
    }

    const now = Date.now();
    db.prepare(`
      INSERT INTO alert_location_history (alert_id, lat, lng, recorded_at) VALUES (?, ?, ?, ?)
    `).run(alert.id, lat, lng, now);

    broadcastEvent('location_update', { alert_id: alert.id, lat, lng, recorded_at: now });

    res.json({ success: true });
  } catch (error) {
    console.error('Location update handler error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// GET /api/citizen/alerts
router.get('/alerts', requireCitizenAuth, (req: Request, res: Response) => {
  try {
    const citizenPayload = (req as any).citizen as CitizenPayload;
    const db = getDb();
    const alerts = db.prepare(`
      SELECT * FROM sos_alerts WHERE citizen_id = ? ORDER BY triggered_at DESC
    `).all(citizenPayload.id) as any[];

    res.json({ alerts: alerts.map(a => ({ ...a, is_suspicious: a.is_suspicious === 1 })) });
  } catch (error) {
    console.error('Alerts history handler error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST /api/citizen/resend-otp
router.post('/resend-otp', (req: Request, res: Response) => {
  try {
    const { citizen_id } = req.body;
    if (!citizen_id) {
      res.status(400).json({ error: 'citizen_id is required' });
      return;
    }
    const db = getDb();
    db.prepare(`
      INSERT INTO otp_codes (citizen_id, code, expires_at)
      VALUES (?, '123456', ?)
    `).run(citizen_id, Date.now() + 10 * 60 * 1000);
    res.json({ message: 'OTP resent' });
  } catch (error) {
    console.error('Resend OTP handler error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

function getAlertWithCitizen(db: any, alertId: number): any {
  const alert = db.prepare(`
    SELECT a.*, c.full_name, c.phone, c.barangay, c.address, c.photo_url,
    c.strike_count, c.is_suspended,
    t.score as trust_score,
    o.full_name as officer_name, o.badge_number as officer_badge
    FROM sos_alerts a
    JOIN citizens c ON a.citizen_id = c.id
    LEFT JOIN citizen_trust_scores t ON t.citizen_id = c.id
    LEFT JOIN officers o ON a.assigned_officer_id = o.id
    WHERE a.id = ?
  `).get(alertId);
  if (!alert) return null;
  return { ...alert, is_suspicious: alert.is_suspicious === 1 };
}

export default router;
