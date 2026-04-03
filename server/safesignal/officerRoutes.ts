import { Router, Request, Response } from 'express';
import { pool } from './database';
import { requireOfficerAuth, OfficerPayload } from './auth';
import { broadcastEvent } from './sse';

const router = Router();

// GET /api/officer/active-assignment
router.get('/active-assignment', requireOfficerAuth, async (req: Request, res: Response) => {
    try {
          const officer = (req as any).officer as OfficerPayload;
          const result = await pool.query(`
                SELECT
                        aa.id as assignment_id,
                                aa.alert_id,
                                        aa.status as assignment_status,
                                                aa.assigned_at,
                                                        sa.alert_type,
                                                                sa.description,
                                                                        sa.triggered_at,
                                                                                c.full_name as citizen_name,
                                                                                        c.phone_number,
                                                                                                COALESCE(cts.score, 50) as trust_score,
                                                                                                        cl.lat as citizen_lat,
                                                                                                                cl.lng as citizen_lng,
                                                                                                                        cl.updated_at as location_updated_at
                                                                                                                              FROM alert_assignments aa
                                                                                                                                    JOIN sos_alerts sa ON sa.id = aa.alert_id
                                                                                                                                          JOIN citizens c ON c.id = sa.citizen_id
                                                                                                                                                LEFT JOIN citizen_trust_scores cts ON cts.citizen_id = sa.citizen_id
                                                                                                                                                      LEFT JOIN citizen_locations cl ON cl.citizen_id = sa.citizen_id
                                                                                                                                                            WHERE aa.officer_id = $1 AND aa.status != 'resolved'
                                                                                                                                                                  ORDER BY aa.assigned_at DESC
                                                                                                                                                                        LIMIT 1
                                                                                                                                                                            `, [officer.id]);

      if (result.rows.length === 0) {
              return res.json({ assignment: null });
      }

      const row = result.rows[0];
          res.json({
                  assignment: {
                            alert_id: row.alert_id,
                            alert_type: row.alert_type,
                            description: row.description,
                            triggered_at: row.triggered_at,
                            assignment_status: row.assignment_status,
                            citizen: {
                                        full_name: row.citizen_name,
                                        phone_number: row.phone_number,
                                        trust_score: Number(row.trust_score),
                            },
                            citizen_location: row.citizen_lat != null ? {
                                        lat: row.citizen_lat,
                                        lng: row.citizen_lng,
                                        updated_at: row.location_updated_at,
                            } : null,
                  },
          });
    } catch (err: any) {
    res.status(500).json({ error: err.message });
    }
});

// PATCH /api/officer/assignment/:alertId/status
router.patch('/assignment/:alertId/status', requireOfficerAuth, async (req: Request, res: Response) => {
    try {
          const officer = (req as any).officer as OfficerPayload;
          const { alertId } = req.params;
          const { status } = req.body;

      const validStatuses = ['assigned', 'en_route', 'on_scene', 'resolved'];
          if (!validStatuses.includes(status)) {
                  return res.status(400).json({ error: 'Invalid status' });
          }

      const resolvedAt = status === 'resolved' ? Date.now().toString() : null;

      await pool.query(`
            UPDATE alert_assignments
                  SET status = $1, resolved_at = COALESCE($2, resolved_at)
                        WHERE alert_id = $3 AND officer_id = $4
                            `, [status, resolvedAt, alertId, officer.id]);

      broadcastEvent('assignment_status', { alert_id: alertId, status, officer_id: officer.id });

      res.json({ ok: true });
    } catch (err: any) {
    res.status(500).json({ error: err.message });
    }
});

// GET /api/officer/assignment-history
router.get('/assignment-history', requireOfficerAuth, async (req: Request, res: Response) => {
    try {
          const officer = (req as any).officer as OfficerPayload;
          const result = await pool.query(`
                SELECT
                        aa.id,
                                aa.alert_id,
                                        c.full_name as citizen_name,
                                                sa.alert_type,
                                                        sa.triggered_at,
                                                                aa.resolved_at,
                                                                        aa.status,
                                                                                CASE
                                                                                          WHEN aa.resolved_at IS NOT NULL
                                                                                                    THEN ROUND((CAST(aa.resolved_at AS BIGINT) - CAST(aa.assigned_at AS BIGINT)) / 60000.0, 1)
                                                                                                              ELSE NULL
                                                                                                                      END as response_time_minutes
                                                                                                                            FROM alert_assignments aa
                                                                                                                                  JOIN sos_alerts sa ON sa.id = aa.alert_id
                                                                                                                                        JOIN citizens c ON c.id = sa.citizen_id
                                                                                                                                              WHERE aa.officer_id = $1
                                                                                                                                                    ORDER BY aa.assigned_at DESC
                                                                                                                                                          LIMIT 50
                                                                                                                                                              `, [officer.id]);

      res.json({ history: result.rows });
    } catch (err: any) {
    res.status(500).json({ error: err.message });
    }
});

// POST /api/officer/location-update
router.post('/location-update', requireOfficerAuth, async (req: Request, res: Response) => {
    try {
          const officer = (req as any).officer as OfficerPayload;
          const { lat, lng } = req.body;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
              return res.status(400).json({ error: 'lat and lng must be numbers' });
      }

      await pool.query(`
            INSERT INTO officer_locations (officer_id, lat, lng, updated_at)
                  VALUES ($1, $2, $3, $4)
                        ON CONFLICT (officer_id) DO UPDATE SET lat = $2, lng = $3, updated_at = $4
                            `, [officer.id, lat, lng, Date.now().toString()]);

      res.json({ ok: true });
    } catch (err: any) {
    res.status(500).json({ error: err.message });
    }
});

export default router;
