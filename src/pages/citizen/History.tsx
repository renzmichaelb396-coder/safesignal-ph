import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { citizenApi, formatElapsed, formatDate, getStatusBadgeClass } from '../../lib/api';

interface Alert {
  id: number;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED' | 'FALSE_ALARM';
  triggered_at: number;
  lat: number;
  lng: number;
  barangay: string;
}

export default function History() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data: any = await citizenApi.getAlerts();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      ACTIVE: '#FF4444',
      ACKNOWLEDGED: '#FFA500',
      RESOLVED: '#44FF44',
      CANCELLED: '#666666',
      FALSE_ALARM: '#FF6B9D',
    };
    return colors[status] || '#888888';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      ACTIVE: 'Active',
      ACKNOWLEDGED: 'Acknowledged',
      RESOLVED: 'Resolved',
      CANCELLED: 'Cancelled',
      FALSE_ALARM: 'False Alarm',
    };
    return labels[status] || status;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--citizen-bg, #0a0a2e)',
        color: '#fff',
        padding: '0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--ph-blue, #1e4c8f) 0%, var(--ph-gold, #ffc72c) 100%)',
          padding: '16px',
          paddingTop: '20px',
          paddingBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Link href="/home" style={{ color: '#fff', textDecoration: 'none', fontSize: '20px' }}>
            ←
          </Link>
          <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '700' }}>Alert History</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#888' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Loading alerts...</p>
          </div>
        ) : error ? (
          <div
            style={{
              background: '#2a0a0a',
              border: '1px solid #ff4444',
              borderRadius: '8px',
              padding: '16px',
              color: '#ff4444',
              marginBottom: '16px',
            }}
          >
            <p style={{ margin: '0', fontSize: '14px' }}>Error: {error}</p>
            <button
              onClick={fetchAlerts}
              style={{
                marginTop: '8px',
                padding: '8px 16px',
                background: '#ff4444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Retry
            </button>
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#888' }}>
            <p style={{ margin: '0', fontSize: '16px', fontWeight: '500' }}>No alerts yet</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>Your alert history will appear here</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {alerts.map((alert) => {
              const elapsed = Date.now() - alert.triggered_at;
              const elapsedStr = formatElapsed(elapsed);

              return (
                <div
                  key={alert.id}
                  style={{
                    background: '#1a1a3e',
                    border: `1px solid ${getStatusColor(alert.status)}33`,
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Status and Time Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        background: `${getStatusColor(alert.status)}22`,
                        borderRadius: '4px',
                        border: `1px solid ${getStatusColor(alert.status)}66`,
                      }}
                    >
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: getStatusColor(alert.status),
                        }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: getStatusColor(alert.status) }}>
                        {getStatusLabel(alert.status)}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#888' }}>{elapsedStr} ago</span>
                  </div>

                  {/* Barangay and Location */}
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#888' }}>Location</p>
                    <p style={{ margin: '0', fontSize: '14px', fontWeight: '500', color: '#fff' }}>
                      {alert.barangay}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
                      {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <p style={{ margin: '0', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                    {formatDate(alert.triggered_at)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Spacing */}
      <div style={{ height: '32px' }} />
    </div>
  );
}
