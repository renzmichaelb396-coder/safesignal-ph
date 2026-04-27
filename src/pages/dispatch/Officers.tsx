import React, { useState, useEffect } from 'react';
import { dispatchApi, getInitials } from '../../lib/api';
import DispatchLayout from './DispatchLayout';

interface Officer {
  id: string;
  full_name: string;
  badge_number: string;
  email: string;
  role: 'DISPATCHER' | 'STATION_ADMIN' | 'OFFICER';
  is_active: boolean;
  duty_status?: string;
  sub_station?: string;
  rank_title?: string;
}

interface Substation {
  sub_station: string;
  total: string;
  on_duty: string;
  off_duty: string;
}

const SS_LABELS: Record<string, string> = {
  MAIN: 'Main Station',
  '1': 'Sub-station 1',
  '2': 'Sub-station 2',
  '3': 'Sub-station 3',
  '4': 'Sub-station 4',
  '5': 'Sub-station 5',
  '6': 'Sub-station 6',
  '7': 'Sub-station 7',
  '8': 'Sub-station 8',
  '9': 'Sub-station 9',
  '10': 'Sub-station 10',
};

export default function Officers() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const [formData, setFormData] = useState({
    full_name: '',
    badge_number: '',
    email: '',
    password: '',
    role: 'DISPATCHER' as 'DISPATCHER' | 'STATION_ADMIN',
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [officersRes, substationsRes] = await Promise.all([
        dispatchApi.getOfficers(),
        (dispatchApi as any).getSubstations().catch(() => ({ substations: [] })),
      ]);
      setOfficers(officersRes.officers || []);
      setSubstations(substationsRes.substations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load officers');
      setOfficers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficers = fetchAll;

  const handleAddOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('add');
    setActionError('');

    try {
      const newOfficer = await dispatchApi.addOfficer(formData);
      setOfficers([...officers, newOfficer]);
      setFormData({
        full_name: '',
        badge_number: '',
        email: '',
        password: '',
        role: 'DISPATCHER',
      });
      setShowAddForm(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add officer');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (officerId: string, currentStatus: boolean) => {
    setActionLoading(officerId);
    setActionError('');

    try {
      await dispatchApi.toggleOfficerActive(officerId, !currentStatus);
      setOfficers(
        officers.map((o) =>
          o.id === officerId ? { ...o, is_active: !currentStatus } : o
        )
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update officer');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleColor = (role: string) => {
  if (role === 'STATION_ADMIN') return { bg: 'rgba(255, 193, 7, 0.1)', text: 'var(--ph-gold, #ffc107)' };
  if (role === 'OFFICER') return { bg: 'rgba(76, 175, 80, 0.1)', text: '#66bb6a' };
  return { bg: 'rgba(33, 150, 243, 0.1)', text: '#42a5f5' };
  };

  return (
    <DispatchLayout>
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--dispatch-bg, #0d1117)',
        color: '#e6edf3',
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
          gap: '12px',
          flexWrap: 'wrap' as const,
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 600, color: 'var(--ph-gold, #ffc107)' }}>
            Officers
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--dispatch-border, #8b949e)' }}>
            {officers.length.toLocaleString()} total
            {substations.length > 0 && (
              <> &bull; {substations.reduce((s, x) => s + parseInt(x.on_duty, 10), 0)} on duty</>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const }}>
          <div style={{ display: 'flex', border: '1px solid var(--dispatch-border, #30363d)', borderRadius: '6px', overflow: 'hidden' }}>
            <button onClick={() => setView('board')} style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 600, background: view === 'board' ? 'var(--ph-gold, #ffc107)' : 'transparent', color: view === 'board' ? '#0d1117' : '#8b949e', border: 'none', cursor: 'pointer', textTransform: 'uppercase' as const }}>
              Board
            </button>
            <button onClick={() => setView('list')} style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 600, background: view === 'list' ? 'var(--ph-gold, #ffc107)' : 'transparent', color: view === 'list' ? '#0d1117' : '#8b949e', border: 'none', cursor: 'pointer', textTransform: 'uppercase' as const }}>
              List
            </button>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, color: '#0d1117', backgroundColor: 'var(--ph-gold, #ffc107)', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffb300'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--ph-gold, #ffc107)'; }}
          >
            {showAddForm ? 'Cancel' : 'Add Officer'}
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddOfficer}
          style={{
            padding: '24px',
            borderBottom: '1px solid var(--dispatch-border, #30363d)',
            backgroundColor: 'var(--dispatch-border, #161b22)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {actionError && (
            <div
              style={{
                padding: '12px',
                backgroundColor: 'rgba(248, 81, 73, 0.1)',
                border: '1px solid var(--sos-red, #f85149)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--sos-red, #f85149)',
              }}
            >
              {actionError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--dispatch-border, #c9d1d9)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  backgroundColor: 'var(--dispatch-bg, #0d1117)',
                  border: '1px solid var(--dispatch-border, #30363d)',
                  borderRadius: '6px',
                  color: '#e6edf3',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--dispatch-border, #c9d1d9)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Badge Number
              </label>
              <input
                type="text"
                value={formData.badge_number}
                onChange={(e) => setFormData({ ...formData, badge_number: e.target.value })}
                placeholder="PNP-002"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  backgroundColor: 'var(--dispatch-bg, #0d1117)',
                  border: '1px solid var(--dispatch-border, #30363d)',
                  borderRadius: '6px',
                  color: '#e6edf3',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--dispatch-border, #c9d1d9)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="officer@safesignal.ph"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  backgroundColor: 'var(--dispatch-bg, #0d1117)',
                  border: '1px solid var(--dispatch-border, #30363d)',
                  borderRadius: '6px',
                  color: '#e6edf3',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--dispatch-border, #c9d1d9)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  backgroundColor: 'var(--dispatch-bg, #0d1117)',
                  border: '1px solid var(--dispatch-border, #30363d)',
                  borderRadius: '6px',
                  color: '#e6edf3',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--dispatch-border, #c9d1d9)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as 'DISPATCHER' | 'STATION_ADMIN' })
                }
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  backgroundColor: 'var(--dispatch-bg, #0d1117)',
                  border: '1px solid var(--dispatch-border, #30363d)',
                  borderRadius: '6px',
                  color: '#e6edf3',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
                }}
              >
                <option value="DISPATCHER">Dispatcher</option>
                <option value="OFFICER">Officer</option>
                  <option value="STATION_ADMIN">Station Admin</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={actionLoading === 'add'}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#0d1117',
              backgroundColor: 'var(--ph-gold, #ffc107)',
              border: 'none',
              borderRadius: '6px',
              cursor: actionLoading === 'add' ? 'not-allowed' : 'pointer',
              opacity: actionLoading === 'add' ? 0.6 : 1,
              transition: 'all 0.2s',
              alignSelf: 'flex-start',
            }}
            onMouseEnter={(e) => {
              if (actionLoading !== 'add') {
                e.currentTarget.style.backgroundColor = '#ffb300';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--ph-gold, #ffc107)';
            }}
          >
            {actionLoading === 'add' ? 'Adding...' : 'Add Officer'}
          </button>
        </form>
      )}

      {/* Sub-station Board View */}
      {view === 'board' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {loading && <p style={{ color: '#8b949e', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>Loading station board...</p>}
          {error && <div style={{ padding: '16px', background: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '6px', color: '#f85149', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
          {!loading && substations.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {[...substations].sort((a, b) => { if (a.sub_station === 'MAIN') return -1; if (b.sub_station === 'MAIN') return 1; return parseInt(a.sub_station, 10) - parseInt(b.sub_station, 10); }).map((ss) => {
                const total = parseInt(ss.total, 10);
                const onDuty = parseInt(ss.on_duty, 10);
                const offDuty = parseInt(ss.off_duty, 10);
                const dutyPct = total > 0 ? Math.round((onDuty / total) * 100) : 0;
                const label = SS_LABELS[ss.sub_station] || 'Sub-station ' + ss.sub_station;
                return (
                  <div key={ss.sub_station} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#ffc107', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{label}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: 700, color: '#e6edf3' }}>{total.toLocaleString()}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#8b949e' }}>Total officers</p>
                      </div>
                      <div style={{ textAlign: 'right' as const }}>
                        <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#4ade80' }}>{onDuty}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#8b949e' }}>On duty</p>
                        <p style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: 700, color: '#6b7280' }}>{offDuty}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#8b949e' }}>Off duty</p>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: '#30363d', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: dutyPct + '%', background: onDuty > 0 ? '#4ade80' : '#30363d', borderRadius: '2px', transition: 'width 0.5s ease' }} />
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#8b949e' }}>{dutyPct}% on duty</p>
                  </div>
                );
              })}
            </div>
          )}
          {!loading && substations.length === 0 && !error && <p style={{ color: '#8b949e', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>No sub-station data available.</p>}
        </div>
      )}

      {/* List Content */}
      {view === 'list' && <div style={{ flex: 1, overflow: 'auto' }}>
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

        {officers.length === 0 && !loading && (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--dispatch-border, #8b949e)',
            }}
          >
            <p style={{ fontSize: '32px', margin: '0 0 12px 0' }}>👮</p>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0' }}>No officers found</p>
            <p style={{ fontSize: '12px', margin: 0 }}>Add your first dispatcher to get started</p>
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
            <p style={{ fontSize: '14px' }}>Loading officers...</p>
          </div>
        )}

        {!loading && officers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {officers.map((officer) => {
              const roleColor = getRoleColor(officer.role);

              return (
                <div
                  key={officer.id}
                  style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--dispatch-border, #30363d)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--dispatch-border, #161b22)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* Left Section */}
                  <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center' }}>
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
                      {getInitials(officer.full_name)}
                    </div>

                    {/* Info */}
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '14px' }}>
                        {officer.full_name}
                      </p>
                      <p
                        style={{
                          margin: '0 0 4px 0',
                          fontSize: '12px',
                          color: 'var(--dispatch-border, #8b949e)',
                        }}
                      >
                        {officer.badge_number} • {officer.email}
                      </p>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: roleColor.bg,
                          color: roleColor.text,
                          borderRadius: '3px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {officer.role === 'STATION_ADMIN' ? 'Station Admin' : officer.role === 'OFFICER' ? 'Officer' : 'Dispatcher'}
                      </span>
                    </div>
                  </div>

                  {/* Right Section - Status Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        backgroundColor: !!officer.is_active ? 'rgba(76, 175, 80, 0.1)' : 'rgba(156, 156, 156, 0.1)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: !!officer.is_active ? '#4caf50' : '#9e9e9e',
                        textTransform: 'uppercase',
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', backgroundColor: !!officer.is_active ? '#4caf50' : '#9e9e9e' }}></span>
                      {!!officer.is_active ? 'Active' : 'Inactive'}
                    </div>

                    <button
                      onClick={() => handleToggleActive(officer.id, officer.is_active)}
                      disabled={actionLoading === officer.id}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#e6edf3',
                        backgroundColor: 'var(--dispatch-border, #30363d)',
                        border: '1px solid var(--dispatch-border, #30363d)',
                        borderRadius: '4px',
                        cursor: actionLoading === officer.id ? 'not-allowed' : 'pointer',
                        opacity: actionLoading === officer.id ? 0.6 : 1,
                        transition: 'all 0.2s',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        if (actionLoading !== officer.id) {
                          e.currentTarget.style.backgroundColor = 'var(--dispatch-border, #30363d)';
                          e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--dispatch-border, #30363d)';
                        e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
                      }}
                    >
                      {actionLoading === officer.id ? '...' : !!officer.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>}
    </div>
    </DispatchLayout>
  );
}
