import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';
import { dispatchApi, formatDate, getInitials } from '../../lib/api';

export default function OfficerDashboard() {
  const { officer, logout } = useDispatchAuth();
  const [, navigate] = useLocation();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    if (!officer) { navigate('/dispatch/login'); return; }
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [officer]);

  const loadData = async () => {
    try {
      const [alertsRes, statsRes] = await Promise.all([
        dispatchApi.getAlerts('ACTIVE'),
        dispatchApi.getStats(),
      ]);
      setAlerts(alertsRes.alerts || []);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    setActionLoading(id);
    try { await dispatchApi.acknowledge(id); await loadData(); }
    catch (err) { console.error('Acknowledge failed:', err); }
    finally { setActionLoading(null); }
  };

  const handleResolve = async (id: number) => {
    setActionLoading(id);
    try { await dispatchApi.resolve(id, 'Resolved by officer'); await loadData(); }
    catch (err) { console.error('Resolve failed:', err); }
    finally { setActionLoading(null); }
  };

  const handleLogout = () => { logout(); navigate('/dispatch/login'); };
  if (!officer) return null;
  const initials = getInitials(officer.full_name || officer.email || 'O');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', color: '#e6edf3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ backgroundColor: '#161b22', borderBottom: '1px solid #30363d', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '22px' }}>🛡️</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffc107', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>RespondPH</div>
            <div style={{ fontSize: '10px', color: '#8b949e', textTransform: 'uppercase' as const }}>Officer Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{officer.full_name}</div>
            <div style={{ fontSize: '11px', color: '#8b949e' }}>{officer.badge_number} · {(officer.role || '').toUpperCase()}</div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#ffc107', color: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>{initials}</div>
          <button onClick={handleLogout} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, backgroundColor: 'transparent', color: '#8b949e', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Active Now', value: stats.active_count ?? 0, color: '#f85149', icon: '🚨' },
              { label: 'Today', value: stats.today_count ?? 0, color: '#ffc107', icon: '📋' },
              { label: 'Resolved', value: stats.resolved_count ?? 0, color: '#3fb950', icon: '✅' },
            ].map((s) => (
              <div key={s.label} style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', textAlign: 'center' as const }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{s.icon}</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '12px', color: '#8b949e', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🚨</span>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Active Alerts</h2>
              <span style={{ backgroundColor: '#f85149', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>{alerts.length}</span>
            </div>
            <button onClick={loadData} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: 'transparent', color: '#8b949e', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer' }}>↻ Refresh</button>
          </div>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center' as const, color: '#8b949e' }}>⏳ Loading...</div>
          ) : alerts.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' as const, color: '#8b949e' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#3fb950' }}>All Clear</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>No active alerts</div>
            </div>
          ) : alerts.map((alert: any) => (
            <div key={alert.id} style={{ padding: '20px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#ffc107' }}>{getInitials(alert.full_name || 'CZ')}</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{alert.full_name || 'Unknown'}</div>
                    <div style={{ fontSize: '12px', color: '#8b949e' }}>{alert.phone || ''}</div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: alert.status === 'ACTIVE' ? 'rgba(248,81,73,0.15)' : 'rgba(255,193,7,0.15)', color: alert.status === 'ACTIVE' ? '#f85149' : '#ffc107', border: `1px solid ${alert.status === 'ACTIVE' ? '#f85149' : '#ffc107'}` }}>{alert.status}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#8b949e', display: 'flex', gap: '16px' }}>
                  {alert.lat && alert.lng && <span>📍 {Number(alert.lat).toFixed(4)}, {Number(alert.lng).toFixed(4)}</span>}
                  <span>🕐 {formatDate(alert.triggered_at)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {alert.status === 'ACTIVE' && (
                  <button onClick={() => handleAcknowledge(alert.id)} disabled={actionLoading === alert.id} style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(255,193,7,0.1)', color: '#ffc107', border: '1px solid #ffc107', borderRadius: '6px', cursor: 'pointer' }}>{actionLoading === alert.id ? '...' : 'Ack'}</button>
                )}
                <button onClick={() => handleResolve(alert.id)} disabled={actionLoading === alert.id} style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(63,185,80,0.1)', color: '#3fb950', border: '1px solid #3fb950', borderRadius: '6px', cursor: 'pointer' }}>{actionLoading === alert.id ? '...' : 'Resolve'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
