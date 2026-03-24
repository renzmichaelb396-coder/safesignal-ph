import Database from 'better-sqlite3';

export interface SurgeWarning {
  barangay: string;
  count: number;
  threshold: number;
  window_minutes: number;
  message: string;
}

export function checkSurge(
  db: Database.Database,
  barangay: string,
  settings: { surge_threshold?: number; surge_window_minutes?: number } | null
): SurgeWarning | null {
  const threshold = settings?.surge_threshold || 5;
  const windowMinutes = settings?.surge_window_minutes || 2;
  const windowMs = windowMinutes * 60 * 1000;

  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM sos_alerts a
    JOIN citizens c ON a.citizen_id = c.id
    WHERE c.barangay = ?
    AND a.triggered_at > ?
    AND a.status IN ('ACTIVE', 'ACKNOWLEDGED')
  `).get(barangay, Date.now() - windowMs) as { count: number };

  if (result.count >= threshold) {
    return {
      barangay,
      count: result.count,
      threshold,
      window_minutes: windowMinutes,
      message: `SURGE ALERT: ${result.count} active alerts in ${barangay} within ${windowMinutes} minutes!`,
    };
  }
  return null;
}
