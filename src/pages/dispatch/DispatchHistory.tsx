import React, { useState, useEffect } from 'react';
import { dispatchApi, formatElapsed, getInitials } from '../../lib/api';
import DispatchLayout from './DispatchLayout';

interface Alert {
  id: string;
  full_name: string;
  status: string;
  triggered_at: string;
  resolved_at?: string;
  barangay: string;
  is_suspicious: boolean;
  trust_score: number;
  resolution_notes?: string;
  resolved_by?: string;
  phone?: string;
}

export default function DispatchHistory() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'RESOLVED' | 'FALSE_ALARM'>('RESOLVED');
  const [dateFilter, setDateFilter] = useState({
    start: getDefaultStartDate(),
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchHistory();
  }, [statusFilter, dateFilter]);

  function getDefaultStartDate() {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await dispatchApi.getAlerts(statusFilter);
      let alerts = response.alerts || [];

      // Filter by date range
      alerts = alerts.filter((alert) => {
        const _ts1 = Number(alert.triggered_at); const alertDate = new Date(!isNaN(_ts1) ? (_ts1 < 10000000000 ? _ts1 * 1000 : _ts1) : alert.triggered_at).toISOString().split('T')[0];
        return alertDate >= dateFilter.start && alertDate <= dateFilter.end;
      });

      setAlerts(alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
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

  const formatDate = (dateString: string) => {
    const _n = Number(dateString); const date = new Date(!isNaN(_n) ? (_n < 10000000000 ? _n * 1000 : _n) : dateString);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateResolutionTime = (triggered: string, resolved?: string) => {
    if (!resolved) return '—';
    const _ts2 = Number(triggered); const start = new Date(!isNaN(_ts2) ? (_ts2 < 10000000000 ? _ts2 * 1000 : _ts2) : triggered).getTime();
    const _ts3 = Number(resolved); const end = !resolved ? Date.now() : new Date(!isNaN(_ts3) ? (_ts3 < 10000000000 ? _ts3 * 1000 : _ts3) : resolved).getTime();
    const minutes = Math.floor((end - start) / 60000);

    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${Math.floor(minutes / 1440)}d`;
  };

  return (
    <DispatchLayout>
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
        }}
      >
        <h1 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: 600, color: 'var(--ph-gold, #ffc107)' }}>
          Alert History
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--dispatch-border, #8b949e)' }}>
          {alerts.length} result{alerts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--dispatch-border, #30363d)',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        {/* Status Filter */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--dispatch-border, #c9d1d9)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'RESOLVED' | 'FALSE_ALARM')}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              backgroundColor: 'var(--dispatch-border, #161b22)',
              border: '1px solid var(--dispatch-border, #30363d)',
              borderRadius: '6px',
              color: 'var(--dispatch-border, #e6edf3)',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
            }}
          >
            <option value="RESOLVED">Resolved</option>
            <option value="FALSE_ALARM">False Alarm</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--dispatch-border, #c9d1d9)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            From
          </label>
          <input
            type="date"
            value={dateFilter.start}
            onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              backgroundColor: 'var(--dispatch-border, #161b22)',
              border: '1px solid var(--dispatch-border, #30363d)',
              borderRadius: '6px',
              color: 'var(--dispatch-border, #e6edf3)',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* End Date */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--dispatch-border, #c9d1d9)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            To
          </label>
          <input
            type="date"
            value={dateFilter.end}
            onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              backgroundColor: 'var(--dispatch-border, #161b22)',
              border: '1px solid var(--dispatch-border, #30363d)',
              borderRadius: '6px',
              color: 'var(--dispatch-border, #e6edf3)',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchHistory}
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
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error && (
          <div
            style={{
              margin: '24px',
              padding: '16px',
              backgroundColor: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid var(--sos-red, #f85149)',
              borderRadius: '6px',
              color: 'var(--sos-red, #f85149)',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {alerts.length === 0 && !loading && (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--dispatch-border, #8b949e)',
            }}
          >
            <p style={{ fontSize: '32px', margin: '0 0 12px 0' }}>📋</p>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0' }}>No alerts found</p>
            <p style={{ fontSize: '12px', margin: 0 }}>Try adjusting your filters</p>
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
            <p style={{ fontSize: '14px' }}>Loading history...</p>
          </div>
        )}

        {!loading && alerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 150px 120px 120px 200px',
                gap: '12px',
                padding: '12px 24px',
                borderBottom: '1px solid var(--dispatch-border, #30363d)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--dispatch-border, #8b949e)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--dispatch-bg, #0d1117)',
              }}
            >
              <div>Person</div>
              <div>Barangay</div>
              <div>Status</div>
              <div>Triggered</div>
              <div>Resolution</div>
              <div>Notes</div>
            </div>

            {/* Table Rows */}
            {alerts.map((alert) => {
              const statusColor = getStatusColor(alert.status);
              const trustColor = getTrustColor(alert.trust_score);
              const resolutionTime = calculateResolutionTime(alert.triggered_at, alert.resolved_at);

              return (
                <div
                  key={alert.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 150px 120px 120px 200px',
                    gap: '12px',
                    padding: '12px 24px',
                    borderBottom: '1px solid var(--dispatch-border, #30363d)',
                    alignItems: 'center',
                    fontSize: '13px',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--dispatch-border, #161b22)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
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
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#0d1117',
                    }}
                  >
                    {getInitials(alert.full_name)}
                  </div>

                  {/* Name */}
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>{alert.full_name}</p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '11px',
                        color: 'var(--dispatch-border, #8b949e)',
                      }}
                    >
                      Trust: <span style={{ color: trustColor, fontWeight: 700 }}>{alert.trust_score}%</span>
                    </p>
                  </div>

                  {/* Barangay */}
                  <div style={{ color: 'var(--dispatch-border, #8b949e)' }}>{alert.barangay}</div>

                  {/* Status */}
                  <div>
                    <span
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: statusColor.bg,
                        color: statusColor.text,
                        border: `1px solid ${statusColor.border}`,
                        borderRadius: '3px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {alert.status}
                    </span>
                  </div>

                  {/* Triggered Time */}
                  <div style={{ fontSize: '12px', color: 'var(--dispatch-border, #8b949e)' }}>
                    {formatDate(alert.triggered_at)}
                  </div>

                  {/* Resolution Time */}
                  <div style={{ fontSize: '12px', color: 'var(--dispatch-border, #8b949e)' }}>
                    {resolutionTime}
                  </div>

                  {/* Notes */}
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--dispatch-border, #8b949e)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={alert.resolution_notes}
                  >
                    {alert.resolution_notes || '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </DispatchLayout>
  );
}
