import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';
import { dispatchApi } from '../../lib/api';
import DispatchLayout from './DispatchLayout';

export default function Metrics() {
  const { officer, loading: authLoading } = useDispatchAuth();
  const [, navigate] = useLocation();
  const [period, setPeriod] = useState('pilot');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!officer) {
      navigate('/dispatch/login');
      return;
    }
    setLoading(true);
    dispatchApi.getStats(`?period=${period}`)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [officer, authLoading, period]);

  if (authLoading) return null;

  const metricCards = stats ? [
    { label: 'Total Alerts', value: stats.total ?? 0, color: '#e6edf3', icon: 'Ã°ÂÂÂ' },
    { label: 'Active Now', value: stats.active_count ?? 0, color: '#f85149', icon: 'Ã°ÂÂÂ¨' },
    { label: 'Acknowledged', value: stats.acknowledged_count ?? 0, color: '#ffc107', icon: 'Ã°ÂÂÂÃ¯Â¸Â' },
    { label: 'Resolved', value: stats.resolved_count ?? 0, color: '#3fb950', icon: 'Ã¢ÂÂ' },
    { label: 'False Alarms', value: stats.false_alarm_count ?? 0, color: '#8b949e', icon: 'Ã¢ÂÂ Ã¯Â¸Â' },
    { label: 'Today', value: stats.today_count ?? 0, color: '#58a6ff', icon: 'Ã°ÂÂÂ' },
  ] : [];

  return (
    <DispatchLayout>
        {/* Period selector */}
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          {[['pilot','Pilot Period'],['30d','Last 30 Days'],['90d','Last 90 Days']].map(([val,label])=>(
            <button key={val} onClick={()=>setPeriod(val)}
              style={{padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background: period===val ? 'var(--ph-gold,#FFC107)' : 'rgba(255,255,255,0.08)',
                color: period===val ? '#111' : '#aaa'}}>
              {label}
            </button>
          ))}
        </div>
      <div style={{ padding: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600, color: '#e6edf3' }}>Metrics</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>Pasay City Police Station Ã¢ÂÂ performance overview</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center' as const, padding: '64px', color: '#8b949e' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>Ã°ÂÂÂ</div>
            Loading metrics...
          </div>
        ) : !stats ? (
          <div style={{ textAlign: 'center' as const, padding: '64px', color: '#8b949e' }}>No metrics available</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {metricCards.map((m) => (
                <div key={m.label} style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>{m.icon}</div>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: m.color, marginBottom: '6px' }}>{m.value}</div>
                  <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{m.label}</div>
                </div>
              ))}
            </div>

            {stats.total > 0 && (
              <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: '#e6edf3' }}>Resolution Rate</h3>
                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#8b949e' }}>
                  <span>Resolved</span>
                  <span style={{ color: '#3fb950' }}>{stats.total > 0 ? Math.round(((stats.resolved_count ?? 0) / stats.total) * 100) : 0}%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#21262d', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${stats.total > 0 ? Math.round(((stats.resolved_count ?? 0) / stats.total) * 100) : 0}%`, backgroundColor: '#3fb950', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DispatchLayout>
  );
}
