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
  notes?: string;
  resolution_notes?: string; // legacy alias
  resolved_by?: string;
  phone?: string;
  officer_name?: string;
  officer_badge?: string;
}

export default function DispatchHistory() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'RESOLVED' | 'FALSE_ALARM' | 'CANCELLED'>('RESOLVED');
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

  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem('dispatch_token');
      const res = await fetch('/api/dispatch/alerts/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safesignal-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export error:', err);
    }
  };

  const handlePrint = () => window.print();

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
    <style>{`
      @media print {
        body * { visibility: hidden; }
        #history-print-area, #history-print-area * { visibility: visible; }
        #history-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; background: #fff; color: #111; }
        #history-print-area .print-hide { display: none !important; }
        #history-print-area .print-show { display: block !important; }
        #history-print-area table { width: 100%; border-collapse: collapse; font-size: 11px; }
        #history-print-area th, #history-print-area td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; color: #111 !important; background: #fff !important; }
        #history-print-area th { background: #f0f0f0 !important; font-weight: 700; }
      }
      .print-show { display: none; }
    `}</style>
    <div
      id="history-print-area"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--dispatch-bg, #0d1117)',
        color: '#e6edf3',
      }}
    >
      {/* Print-only official section — hidden on screen, visible only when printing */}
      <div className="print-show" style={{ marginBottom: 16 }}>
        {/* Official letterhead */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '2px solid #1a237e', paddingBottom: 10, marginBottom: 10 }}>
          <img src="/pasay-police-badge.svg" alt="Pasay City Police" style={{ width: 60, height: 60 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#1a237e' }}>Republic of the Philippines · National Police Commission</div>
            <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', color: '#1a237e' }}>Pasay City Police Station</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>SafeSignal PH — Emergency Response System</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, color: '#555' }}>
            <div><strong>INCIDENT HISTORY REPORT</strong></div>
            <div>Generated: {new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</div>
            <div>Status: <strong>{statusFilter.replace('_', ' ')}</strong></div>
            <div>Period: {dateFilter.start} — {dateFilter.end}</div>
            <div>Total Records: <strong>{alerts.length}</strong></div>
          </div>
        </div>
        {/* Print table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
          <thead>
            <tr style={{ backgroundColor: '#c5cae9' }}>
              {['Alert #','Citizen Name','Phone','Barangay','Status','Date/Time Triggered','Date/Time Resolved','Duration','Officer Assigned','Trust %','Notes / Disposition'].map(h => (
                <th key={h} style={{ border: '1px solid #7986cb', padding: '4px 5px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: '#1a237e' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert, i) => (
              <tr key={alert.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f3f4ff' }}>
                <td style={{ border: '1px solid #bdbdbd', padding: '3px 5px', fontSize: 9 }}>{alert.id}</td>
                <td style={{ border: '1px solid #bdbdbd', padding: '3px 5px', fontSize: 9, fontWeight: 600 }}>{alert.full_name}</td>
                <td style={{ border: '1px solid #bdbdbd', padding: '3px 5px', fontSize: 9 }}>{alert.phone || '—'}</td>
                <td style={{ border: '1px solid #bdbdbd', padding: '3px 5px', fontSize: 9 }}>{alert.barangay || '—'}</td>
                <td style={{ border: '1px solid #bdbdbd', padding: '3px 5px', fontSize: 9, fontWeight: 700 }}>{alert.status.replace('_', ' ')}</td>
                <td style={{ border: '1px solid #bdbdbd', padding: '3px 5px', fontSize: 9 }}>{formatDate(alert.triggered_at)}</td>
                <td style={{ border: '1px solid #bdbdbd', padding: '3px 5px', fontSize: 9 }}>{alert.resolved_at ? formatDate(alert.resolved_at) : '—'}</td>
                <td style={{ border: '1px solid #bdbdbd', padding: '3px 5px', fontSize: 9 }}>{calculateResolutionTime(alert.triggered_at, alert.resolved_at)}</td>
                <td style={{ border: '1px solid #bdbdbd', padding: '3px 5px', fontSize: 9 }}>{alert.officer_name ? `${alert.officer_name} (${alert.officer_badge})` : '—'}</td>
                <td style={{ border: '1px solid #bdbdbd', padding: '3px 5px', fontSize: 9, textAlign: 'center' }}>{alert.trust_score ?? '—'}</td>
                <td style={{ border: '1px solid #bdbdbd', padding: '3px 5px', fontSize: 9 }}>{alert.notes || alert.resolution_notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10, fontSize: 9, color: '#555', borderTop: '1px solid #9e9e9e', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>FOR OFFICIAL USE ONLY · Computer-generated from SafeSignal PH v1.0</span>
          <span>Pasay City Police Station · Pasay City, Metro Manila</span>
        </div>
      </div>

      {/* Header */}
      <div
        className="print-hide"
        style={{
          padding: '24px',
          borderBottom: '1px solid var(--dispatch-border, #30363d)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 600, color: 'var(--ph-gold, #ffc107)' }}>
              Alert History
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>
              {alerts.length} result{alerts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleExportCSV}
              style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#e6edf3', backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={handlePrint}
              style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#0d1117', backgroundColor: 'var(--ph-gold, #ffc107)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              🖨 Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="print-hide"
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
              color: '#c9d1d9',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'RESOLVED' | 'FALSE_ALARM' | 'CANCELLED')}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              backgroundColor: '#161b22',
              border: '1px solid var(--dispatch-border, #30363d)',
              borderRadius: '6px',
              color: '#e6edf3',
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
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#c9d1d9',
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
              backgroundColor: '#161b22',
              border: '1px solid var(--dispatch-border, #30363d)',
              borderRadius: '6px',
              color: '#e6edf3',
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
              color: '#c9d1d9',
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
              backgroundColor: '#161b22',
              border: '1px solid var(--dispatch-border, #30363d)',
              borderRadius: '6px',
              color: '#e6edf3',
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
              color: '#8b949e',
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
              color: '#8b949e',
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
                gridTemplateColumns: '50px 1fr 120px 110px 100px 100px 1fr',
                gap: '12px',
                padding: '12px 24px',
                borderBottom: '1px solid var(--dispatch-border, #30363d)',
                fontSize: '11px',
                fontWeight: 700,
                color: '#8b949e',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--dispatch-bg, #0d1117)',
              }}
            >
              <div></div>
              <div>Citizen</div>
              <div>Barangay</div>
              <div>Status</div>
              <div>Triggered</div>
              <div>Duration</div>
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
                    gridTemplateColumns: '50px 1fr 120px 110px 100px 100px 1fr',
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
                        color: '#8b949e',
                      }}
                    >
                      Trust: <span style={{ color: trustColor, fontWeight: 700 }}>{alert.trust_score}%</span>
                    </p>
                  </div>

                  {/* Barangay */}
                  <div style={{ color: '#8b949e' }}>{alert.barangay}</div>

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
                  <div style={{ fontSize: '12px', color: '#8b949e' }}>
                    {formatDate(alert.triggered_at)}
                  </div>

                  {/* Resolution Time */}
                  <div style={{ fontSize: '12px', color: '#8b949e' }}>
                    {resolutionTime}
                  </div>

                  {/* Notes */}
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#8b949e',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={alert.notes || alert.resolution_notes}
                  >
                    {alert.notes || alert.resolution_notes || '—'}
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
