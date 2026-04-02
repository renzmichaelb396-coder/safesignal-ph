import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';
import { dispatchApi } from '../../lib/api';

export default function OfficerDashboard() {
  const { officer, loading } = useDispatchAuth();
  const [, navigate] = useLocation();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!officer || officer.role !== 'OFFICER') {
      navigate('/dispatch/login');
      return;
    }
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loading, officer]);

  async function loadData() {
    try {
      setRefreshing(true);
      const [alertsData, statsData] = await Promise.all([
        dispatchApi.getAlerts('ACTIVE'),
        dispatchApi.getStats(),
      ]);
      setAlerts((alertsData as any)?.alerts || []);
      setStats(statsData);
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAcknowledge(id: string) {
    try { await dispatchApi.acknowledge(id); loadData(); } catch (e) { console.error(e); }
  }

  async function handleResolve(id: string) {
    try { await dispatchApi.resolve(id, 'Resolved by officer'); loadData(); } catch (e) { console.error(e); }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', color: '#ffc107', fontSize: '16px' }}>
        Loading...
      </div>
    );
  }

  if (!officer || officer.role !== 'OFFICER') return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>🛡️</span>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffc107', letterSpacing: '1px' }}>RESPONDPH</div>
            <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>Pasay City Police</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e6edf3' }}>{officer.full_name}</div>
          <div style={{ fontSize: '11px', color: '#8b949e' }}>{officer.badge_number} — Field Officer</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '20px 24px' }}>
        {[
          { label: 'Active Now', value: (stats as any)?.active_count ?? 0, color: '#f85149' },
          { label: 'Acknowledged', value: (stats as any)?.acknowledged_count ?? 0, color: '#ffc107' },
          { label: 'Resolved Today', value: (stats as any)?.today_count ?? 0, color: '#3fb950' },
        ].map(s => (
          <div key={s.label} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8b949e' }}>
            Active Alerts ({alerts.length})
          </h2>
          {refreshing && <span style={{ fontSize: '11px', color: '#8b949e' }}>Refreshing...</span>}
        </div>
        {alerts.length === 0 ? (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '32px', textAlign: 'center', color: '#8b949e' }}>
            No active alerts
          </div>
        ) : (
          alerts.map((alert: any) => (
            <div key={alert.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{alert.full_name || alert.citizen_name}</div>
                  <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '2px' }}>{alert.barangay} · {alert.phone}</div>
                </div>
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(248,81,73,0.15)', color: '#f85149', border: '1px solid rgba(248,81,73,0.3)', fontWeight: 600 }}>
                  {alert.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {alert.status === 'ACTIVE' && (
                  <button onClick={() => handleAcknowledge(alert.id)} style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: 'rgba(255,193,7,0.15)', border: '1px solid rgba(255,193,7,0.3)', borderRadius: '4px', color: '#ffc107', cursor: 'pointer' }}>
                    ✋ Acknowledge
                  </button>
                )}
                <button onClick={() => handleResolve(alert.id)} style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: 'rgba(63,185,80,0.15)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: '4px', color: '#3fb950', cursor: 'pointer' }}>
                  ✅ Resolve
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ borderTop: '1px solid #30363d', padding: '12px 24px', textAlign: 'center', fontSize: '11px', color: '#8b949e' }}>
        RespondPH v1.0 — Field Officer Portal
      </div>
    </div>
  );
}
