import React, { useState, useEffect } from 'react';
import { dispatchApi, formatElapsed, getInitials } from '../../lib/api';
import AlertDetailModal from './AlertDetailModal';

type AlertStatus = 'ALL' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_ALARM';

interface Alert {
  id: string;
  full_name: string;
  status: string;
  triggered_at: string;
  barangay: string;
  is_suspicious: boolean;
  trust_score: number;
  phone?: string;
  location?: { lat: number; lng: number };
  location_history?: Array<{ lat: number; lng: number; timestamp: string }>;
}

export default function AlertQueue() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [activeFilter, setActiveFilter] = useState<AlertStatus>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    fetchAlerts(true);
    const interval = setInterval(() => fetchAlerts(false), 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterAlerts();
  }, [alerts, activeFilter]);

  const fetchAlerts = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const response = await dispatchApi.getAlerts();
      setAlerts(response.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAlerts = () => {
    if (activeFilter === 'ALL') {
      setFilteredAlerts(alerts);
    } else {
      setFilteredAlerts(alerts.filter((alert) => alert.status === activeFilter));
    }
  };

  const handleAlertUpdate = (updatedAlert: Alert) => {
    const updatedAlerts = alerts.map((a) => (a.id === updatedAlert.id ? updatedAlert : a));
    setAlerts(updatedAlerts);
    setSelectedAlert(updatedAlert);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return { bg: 'rgba(248, 81, 73, 0.1)', border: '#f85149', text: '#ff7675' };
      case 'ACKNOWLEDGED':
        return { bg: 'rgba(255, 193, 7, 0.1)', border: '#ffc107', text: '#ffc107' };
      case 'RESOLVED':
        return { bg: 'rgba(33, 150, 243, 0.1)', border: '#2196f3', text: '#42a5f5' };
      case 'FALSE_ALARM':
        return { bg: 'rgba(156, 156, 156, 0.1)', border: '#9e9e9e', text: '#a0a0a0' };
      default:
        return { bg: 'rgba(200, 200, 200, 0.1)', border: '#c0c0c0', text: '#c0c0c0' };
    }
  };

  const getTrustColor = (score: number) => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#8bc34a';
    if (score >= 40) return '#ff9800';
    return '#f44336';
  };

  const filters: AlertStatus[] = ['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--dispatch-bg, #0d1117)',
        color: 'var(--dispatch-border, #e6edf3)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '24px',
          borderBottom: '1px solid var(--dispatch-border, #30363d)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600, color: 'var(--ph-gold, #ffc107)' }}>
            Alert Queue
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--dispatch-border, #8b949e)' }}>
            {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          disabled={loading}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#0d1117',
            backgroundColor: 'var(--ph-gold, #ffc107)',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#ffb300';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--ph-gold, #ffc107)';
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          padding: '12px 24px',
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--dispatch-border, #30363d)',
          overflowX: 'auto',
        }}
      >
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              border: '1px solid transparent',
              borderRadius: '6px',
              backgroundColor:
                activeFilter === filter ? 'var(--dispatch-border, #30363d)' : 'transparent',
              color:
                activeFilter === filter ? 'var(--ph-gold, #ffc107)' : 'var(--dispatch-border, #8b949e)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== filter) {
                e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {error && (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid var(--sos-red, #f85149)',
              borderRadius: '6px',
              color: 'var(--sos-red, #f85149)',
              fontSize: '13px',
              marginBottom: '24px',
            }}
          >
            {error}
          </div>
        )}

        {filteredAlerts.length === 0 && !loading && (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--dispatch-border, #8b949e)',
            }}
          >
            <p style={{ fontSize: '32px', margin: '0 0 12px 0' }}>📭</p>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0' }}>No alerts found</p>
            <p style={{ fontSize: '12px', margin: 0 }}>
              {activeFilter === 'ALL' ? 'No alerts in the system' : `No ${activeFilter.toLowerCase()} alerts`}
            </p>
          </div>
        )}

        {loading && (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--dispatch-border, #8b949e)',
            }}
          >
            <p style={{ fontSize: '14px' }}>Loading alerts...</p>
          </div>
        )}

        {!loading && filteredAlerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredAlerts.map((alert) => {
              const statusColor = getStatusColor(alert.status);
              const trustColor = getTrustColor(alert.trust_score);
              const elapsed = formatElapsed(Date.now() - Number(alert.triggered_at));

              return (
                <button
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)}
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--dispatch-border, #161b22)',
                    border: '1px solid var(--dispatch-border, #30363d)',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${statusColor.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--dispatch-bg, #0d1117)';
                    e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--dispatch-border, #161b22)';
                    e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
                  }}
                >
                  {/* Left Section */}
                  <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    {/* Avatar */}
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--ph-gold, #ffc107)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#0d1117',
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(alert.full_name)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px',
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                          {alert.full_name}
                        </p>
                        {alert.is_suspicious && (
                          <span
                            style={{
                              padding: '2px 8px',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: 'rgba(248, 81, 73, 0.15)',
                              color: 'var(--sos-red, #f85149)',
                              borderRadius: '3px',
                              textTransform: 'uppercase',
                            }}
                          >
                            Suspicious
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          margin: '0 0 6px 0',
                          fontSize: '12px',
                          color: 'var(--dispatch-border, #8b949e)',
                        }}
                      >
                        {alert.barangay} • {elapsed}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                        <span style={{ color: 'var(--dispatch-border, #8b949e)' }}>
                          Trust:{' '}
                          <span style={{ color: trustColor, fontWeight: 700 }}>
                            {alert.trust_score}%
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Section */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginLeft: '12px',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: statusColor.bg,
                        color: statusColor.text,
                        border: `1px solid ${statusColor.border}`,
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {alert.status}
                    </span>
                    <span style={{ fontSize: '18px' }}>→</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onUpdate={handleAlertUpdate}
        />
      )}
    </div>
  );
}
