import React, { useState, useEffect } from 'react';
import { dispatchApi, formatElapsed, getInitials } from '../../lib/api';
import AlertDetailModal from './AlertDetailModal';
import DispatchLayout from './DispatchLayout';

interface Alert {
  id: string;
  full_name: string;
  status: string;
  triggered_at: string;
  barangay: string;
  is_suspicious: boolean;
  trust_score: number;
  phone?: string;
  assigned_officer?: string;
  location?: { lat: number; lng: number };
  location_history?: Array<{ lat: number; lng: number; timestamp: string }>;
}

type SortOption = 'newest' | 'oldest' | 'trust_asc' | 'trust_desc';

export default function AlertQueue() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    fetchAlerts(true);
    const interval = setInterval(() => fetchAlerts(false), 4000);
    return () => clearInterval(interval);
  }, []);

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

  const handleAlertUpdate = (updatedAlert: Alert) => {
    setAlerts((prev) => prev.map((a) => (a.id === updatedAlert.id ? updatedAlert : a)));
    setSelectedAlert(updatedAlert);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; border: string }> = {
      ACTIVE:      { bg: 'rgba(248,81,73,0.12)',  color: '#ff7675', border: '#f85149' },
      ACKNOWLEDGED:{ bg: 'rgba(255,193,7,0.12)',  color: '#ffc107', border: '#ffc107' },
      RESOLVED:    { bg: 'rgba(33,150,243,0.12)', color: '#42a5f5', border: '#2196f3' },
      FALSE_ALARM: { bg: 'rgba(156,156,156,0.12)',color: '#a0a0a0', border: '#9e9e9e' },
      CANCELLED:   { bg: 'rgba(100,100,100,0.12)',color: '#888',    border: '#666' },
    };
    return map[status] || map['CANCELLED'];
  };

  const getTrustColor = (score: number) => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#8bc34a';
    if (score >= 40) return '#ff9800';
    return '#f44336';
  };

  const formatTriggered = (ts: string) => {
    const n = Number(ts);
    const date = new Date(!isNaN(n) ? (n < 10000000000 ? n * 1000 : n) : ts);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-PH', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  // Filter + sort
  const filtered = alerts
    .filter((a) => statusFilter === 'ALL' || a.status === statusFilter)
    .sort((a, b) => {
      if (sortBy === 'newest') return Number(b.triggered_at) - Number(a.triggered_at);
      if (sortBy === 'oldest') return Number(a.triggered_at) - Number(b.triggered_at);
      if (sortBy === 'trust_asc') return (a.trust_score || 0) - (b.trust_score || 0);
      if (sortBy === 'trust_desc') return (b.trust_score || 0) - (a.trust_score || 0);
      return 0;
    });

  return (
    <DispatchLayout>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--dispatch-bg, #0d1117)',
          color: '#e6edf3',
          minHeight: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--dispatch-border, #30363d)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600, color: 'var(--ph-gold, #ffc107)' }}>
              Alert Queue
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>
              {filtered.length} alert{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '7px 10px',
                fontSize: '12px',
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: '#e6edf3',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
              <option value="FALSE_ALARM">False Alarm</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{
                padding: '7px 10px',
                fontSize: '12px',
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: '#e6edf3',
                cursor: 'pointer',
              }}
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="trust_desc">Trust: High → Low</option>
              <option value="trust_asc">Trust: Low → High</option>
            </select>

            <button
              onClick={() => fetchAlerts(true)}
              disabled={loading}
              style={{
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#0d1117',
                backgroundColor: 'var(--ph-gold, #ffc107)',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '12px 16px',
              backgroundColor: 'rgba(248,81,73,0.1)',
              border: '1px solid #f85149',
              borderRadius: '6px',
              color: '#f85149',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 120px 100px 120px 80px 90px',
              gap: '0',
              padding: '10px 24px',
              borderBottom: '1px solid #30363d',
              fontSize: '11px',
              fontWeight: 700,
              color: '#8b949e',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              position: 'sticky',
              top: 0,
              backgroundColor: '#0d1117',
              zIndex: 1,
            }}
          >
            <div>Citizen</div>
            <div>Barangay</div>
            <div>Triggered</div>
            <div>Elapsed</div>
            <div>Status</div>
            <div>Trust</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#8b949e' }}>
              Loading alerts...
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#8b949e' }}>
              <p style={{ fontSize: '28px', margin: '0 0 10px' }}>📭</p>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>No alerts found</p>
              <p style={{ fontSize: '12px', margin: 0 }}>
                {statusFilter === 'ALL' ? 'No alerts in the system' : `No ${statusFilter.toLowerCase()} alerts`}
              </p>
            </div>
          )}

          {/* Rows */}
          {!loading &&
            filtered.map((alert) => {
              const badge = getStatusBadge(alert.status);
              const trustColor = getTrustColor(alert.trust_score);
              const elapsed = formatElapsed(Date.now() - Number(alert.triggered_at));
              return (
                <div
                  key={alert.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 120px 100px 120px 80px 90px',
                    gap: '0',
                    padding: '12px 24px',
                    borderBottom: '1px solid #21262d',
                    alignItems: 'center',
                    fontSize: '13px',
                    transition: 'background 0.15s',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* Citizen */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: alert.status === 'ACTIVE' ? '#e63946' : '#ffc107',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(alert.full_name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {alert.full_name}
                      </p>
                      {alert.is_suspicious && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            background: 'rgba(248,81,73,0.15)',
                            color: '#f85149',
                            padding: '1px 5px',
                            borderRadius: 3,
                            textTransform: 'uppercase',
                          }}
                        >
                          Suspicious
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barangay */}
                  <div style={{ color: '#8b949e', fontSize: 12 }}>{alert.barangay}</div>

                  {/* Triggered */}
                  <div style={{ color: '#8b949e', fontSize: 11 }}>{formatTriggered(alert.triggered_at)}</div>

                  {/* Elapsed */}
                  <div style={{ color: '#c9d1d9', fontFamily: 'monospace', fontSize: 12 }}>{elapsed}</div>

                  {/* Status badge */}
                  <div>
                    <span
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {alert.status}
                    </span>
                  </div>

                  {/* Trust */}
                  <div style={{ color: trustColor, fontWeight: 700, fontSize: 12 }}>
                    {alert.trust_score}%
                  </div>

                  {/* View button */}
                  <div style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => setSelectedAlert(alert)}
                      style={{
                        padding: '5px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#e6edf3',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid #30363d',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
                        e.currentTarget.style.color = 'var(--ph-gold, #ffc107)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#30363d';
                        e.currentTarget.style.color = '#e6edf3';
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Modal */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onUpdate={handleAlertUpdate}
        />
      )}
    </DispatchLayout>
  );
}
