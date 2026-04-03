import { Router, Request, Response } from 'express';
import { getDb } from './database';
import { requireOfficerAuth, OfficerPayload } from './auth';
import { broadcastEvent } from './sse';

const router = Router();

function ensureTables() {
    const db = getDb();
    db.prepare('CREATE TABLE IF NOT EXISTS officer_locations (officer_id INTEGER PRIMARY KEY, lat REAL NOT NULL, lng REAL NOT NULL, updated_at TEXT NOT NULL)').run();
    db.prepare('CREATE TABLE IF NOT EXISTS alert_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, alert_id INTEGER NOT NULL, officer_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT ' + "'assigned'" + ', assigned_at TEXT NOT NULL, resolved_at TEXT, UNIQUE(alert_id, officer_id))').run();
}
try { ensureTables(); } catch {}

router.get('/active-assignment', requireOfficerAuth, (req: Request, res: Response) => {
    try {
          const officer = (req as any).officer as OfficerPayload;
          const db = getDb();
          const row = db.prepare('SELECT aa.id, aa.alert_id, aa.status as assignment_status, sa.alert_type, sa.description, sa.triggered_at, c.full_name as citizen_name, c.phone FROM alert_assignments aa JOIN sos_alerts sa ON sa.id = aa.alert_id JOIN citizens c ON c.id = sa.citizen_id WHERE aa.officer_id = ? AND aa.status != ' + "'resolved'" + ' ORDER BY aa.assigned_at DESC LIMIT 1').get(officer.id) as any;
          if (!row) return res.json({ assignment: null });
          res.json({ assignment: { alert_id: row.alert_id, alert_type: row.alert_type || 'SOS', description: row.description || '', triggered_at: row.triggered_at, assignment_status: row.assignment_status, citizen: { full_name: row.citizen_name, phone_number: row.phone, trust_score: 50 }, citizen_location: null } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch('/assignment/:alertId/status', requireOfficerAuth, (req: Request, res: Response) => {
    try {
          const officer = (req as any).officer as OfficerPayload;
          const { alertId } = req.params;
          const { status } = req.body;
          if (!['assigned', 'en_route', 'on_scene', 'resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
          const db = getDb();
          if (status === 'resolved') {
                  db.prepare('UPDATE alert_assignments SET status = ?, resolved_at = ? WHERE alert_id = ? AND officer_id = ?').run(status, Date.now().toString(), alertId, officer.id);
          } else {
                  db.prepare('UPDATE alert_assignments SET status = ? WHERE alert_id = ? AND officer_id = ?').run(status, alertId, officer.id);
          }
          broadcastEvent('assignment_status', { alert_id: alertId, status, officer_id: officer.id });
          res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/assignment-history', requireOfficerAuth, (req: Request, res: Response) => {
    try {
          const officer = (req as any).officer as OfficerPayload;
          const db = getDb();
          const rows = db.prepare('SELECT aa.id, aa.alert_id, c.full_name as citizen_name, sa.alert_type, sa.triggered_at, aa.resolved_at, aa.status, CASE WHEN aa.resolved_at IS NOT NULL THEN ROUND((CAST(aa.resolved_at AS REAL) - CAST(aa.assigned_at AS REAL)) / 60000.0, 1) ELSE NULL END as response_time_minutes FROM alert_assignments aa JOIN sos_alerts sa ON sa.id = aa.alert_id JOIN citizens c ON c.id = sa.citizen_id WHERE aa.officer_id = ? ORDER BY aa.assigned_at DESC LIMIT 50').all(officer.id) as any[];
          res.json({ history: rows });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/location-update', requireOfficerAuth, (req: Request, res: Response) => {
    try {
          const officer = (req as any).officer as OfficerPayload;
          const { lat, lng } = req.body;
          if (typeof lat !== 'number' || typeof lng !== 'number') return res.status(400).json({ error: 'lat and lng must be numbers' });
          const db = getDb();
          db.prepare('INSERT INTO officer_locations (officer_id, lat, lng, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(officer_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, updated_at = excluded.updated_at').run(officer.id, lat, lng, Date.now().toString());
          res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/officer-locations', requireOfficerAuth, (req: Request, res: Response) => {
    try {
          const db = getDb();
          const rows = db.prepare('SELECT ol.officer_id, ol.lat, ol.lng, ol.updated_at, o.full_name, o.badge_number FROM officer_locations ol JOIN officers o ON o.id = ol.officer_id').all() as any[];
          res.json({ locations: rows });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
