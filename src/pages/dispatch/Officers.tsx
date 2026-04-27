import React, { useState, useEffect, useMemo } from 'react';
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

const DRILLDOWN_PAGE = 100;

const baseInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: '13px',
  backgroundColor: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: '6px',
  color: '#e6edf3',
  boxSizing: 'border-box',
  outline: 'none',
};

const focusGold = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = '#ffc107';
};
const blurGray = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = '#30363d';
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

  // Board drilldown
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [stationSearch, setStationSearch] = useState('');
  const [drilldownPage, setDrilldownPage] = useState(1);

  // List filters
  const [listSearch, setListSearch] = useState('');
  const [listStationFilter, setListStationFilter] = useState('');
  const [listRoleFilter, setListRoleFilter] = useState('');
  const [listStatusFilter, setListStatusFilter] = useState('');

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
        dispatchApi.getSubstations().catch(() => ({ substations: [] })),
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

  const handleAddOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('add');
    setActionError('');
    try {
      const newOfficer = await dispatchApi.addOfficer(formData);
      setOfficers([...officers, newOfficer]);
      setFormData({ full_name: '', badge_number: '', email: '', password: '', role: 'DISPATCHER' });
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
      setOfficers(officers.map((o) => o.id === officerId ? { ...o, is_active: !currentStatus } : o));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update officer');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleColor = (role: string) => {
    if (role === 'STATION_ADMIN') return { bg: 'rgba(255,193,7,0.1)', text: '#ffc107' };
    if (role === 'OFFICER') return { bg: 'rgba(76,175,80,0.1)', text: '#66bb6a' };
    return { bg: 'rgba(33,150,243,0.1)', text: '#42a5f5' };
  };

  const getRoleLabel = (role: string) => {
    if (role === 'STATION_ADMIN') return 'Admin';
    if (role === 'OFFICER') return 'Officer';
    return 'Dispatcher';
  };

  // Drilldown: sort on-duty first → active → A-Z
  const drilldownData = useMemo(() => {
    if (selectedStation === null) return { all: [], filtered: [], shown: [] };
    const all = [...officers]
      .filter((o) => (o.sub_station || 'MAIN') === selectedStation)
      .sort((a, b) => {
        const da = a.duty_status === 'ON_DUTY' ? 0 : 1;
        const db = b.duty_status === 'ON_DUTY' ? 0 : 1;
        if (da !== db) return da - db;
        const aa = a.is_active ? 0 : 1;
        const ab = b.is_active ? 0 : 1;
        if (aa !== ab) return aa - ab;
        return a.full_name.localeCompare(b.full_name);
      });
    const q = stationSearch.trim().toLowerCase();
    const filtered = q
      ? all.filter((o) =>
          o.full_name.toLowerCase().includes(q) ||
          o.badge_number.toLowerCase().includes(q) ||
          (o.email || '').toLowerCase().includes(q) ||
          (o.rank_title || '').toLowerCase().includes(q)
        )
      : all;
    return { all, filtered, shown: filtered.slice(0, drilldownPage * DRILLDOWN_PAGE) };
  }, [officers, selectedStation, stationSearch, drilldownPage]);

  // List view filters
  const filteredListOfficers = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return officers.filter((o) => {
      if (q && !(
        o.full_name.toLowerCase().includes(q) ||
        o.badge_number.toLowerCase().includes(q) ||
        (o.email || '').toLowerCase().includes(q) ||
        (o.rank_title || '').toLowerCase().includes(q)
      )) return false;
      if (listStationFilter && (o.sub_station || 'MAIN') !== listStationFilter) return false;
      if (listRoleFilter && o.role !== listRoleFilter) return false;
      if (listStatusFilter === 'active' && !o.is_active) return false;
      if (listStatusFilter === 'inactive' && o.is_active) return false;
      if (listStatusFilter === 'on_duty' && o.duty_status !== 'ON_DUTY') return false;
      if (listStatusFilter === 'off_duty' && o.duty_status === 'ON_DUTY') return false;
      return true;
    });
  }, [officers, listSearch, listStationFilter, listRoleFilter, listStatusFilter]);

  const sortedSubstations = useMemo(() => [...substations].sort((a, b) => {
    if (a.sub_station === 'MAIN') return -1;
    if (b.sub_station === 'MAIN') return 1;
    return parseInt(a.sub_station, 10) - parseInt(b.sub_station, 10);
  }), [substations]);

  const totalOnDuty = substations.reduce((s, x) => s + parseInt(x.on_duty, 10), 0);
  const hasFilters = !!(listSearch || listStationFilter || listRoleFilter || listStatusFilter);

  return (
    <DispatchLayout>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0d1117', color: '#e6edf3' }}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 700, color: '#ffc107' }}>Officers</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>
              {loading
                ? 'Loading…'
                : <>{officers.length.toLocaleString()} officers{substations.length > 0 ? ` · ${totalOnDuty.toLocaleString()} on duty` : ''}</>
              }
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* View toggle */}
            <div style={{ display: 'flex', border: '1px solid #30363d', borderRadius: '6px', overflow: 'hidden' }}>
              {(['board', 'list'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 600, background: view === v ? '#ffc107' : 'transparent', color: view === v ? '#0d1117' : '#8b949e', border: 'none', cursor: 'pointer', textTransform: 'uppercase' as const }}>
                  {v === 'board' ? '⊞ Board' : '≡ List'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#0d1117', backgroundColor: '#ffc107', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' as const }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffb300'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffc107'; }}
            >
              {showAddForm ? '✕ Cancel' : '+ Add Officer'}
            </button>
          </div>
        </div>

        {/* ── Add Officer Form ── */}
        {showAddForm && (
          <form onSubmit={handleAddOfficer} style={{ padding: '20px 24px', borderBottom: '1px solid #30363d', backgroundColor: '#161b22', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {actionError && (
              <div style={{ padding: '10px 14px', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '6px', fontSize: '13px', color: '#f85149' }}>
                {actionError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Full Name', key: 'full_name', type: 'text', placeholder: 'Juan dela Cruz' },
                { label: 'Badge Number', key: 'badge_number', type: 'text', placeholder: 'PNP-001' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'officer@safesignal.ph' },
                { label: 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#8b949e', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{label}</label>
                  <input
                    type={type}
                    value={(formData as Record<string, string>)[key]}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    placeholder={placeholder}
                    required
                    style={{ ...baseInput, padding: '8px 10px' }}
                    onFocus={focusGold}
                    onBlur={blurGray}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#8b949e', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'DISPATCHER' | 'STATION_ADMIN' })}
                  style={{ ...baseInput, padding: '8px 10px', cursor: 'pointer' }}
                  onFocus={focusGold}
                  onBlur={blurGray}
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
              style={{ padding: '9px 20px', fontSize: '13px', fontWeight: 600, color: '#0d1117', backgroundColor: '#ffc107', border: 'none', borderRadius: '6px', cursor: actionLoading === 'add' ? 'not-allowed' : 'pointer', opacity: actionLoading === 'add' ? 0.6 : 1, alignSelf: 'flex-start' }}
            >
              {actionLoading === 'add' ? 'Adding…' : 'Add Officer'}
            </button>
          </form>
        )}

        {/* ══════════════════════════════════════════
            BOARD VIEW
        ══════════════════════════════════════════ */}
        {view === 'board' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
            {loading && <p style={{ color: '#8b949e', textAlign: 'center', marginTop: '48px' }}>Loading station board…</p>}
            {error && <div style={{ padding: '14px', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '8px', color: '#f85149', fontSize: '13px', marginBottom: '20px' }}>{error}</div>}
            {!loading && substations.length === 0 && !error && (
              <p style={{ color: '#8b949e', textAlign: 'center', marginTop: '48px' }}>No sub-station data available.</p>
            )}

            {!loading && substations.length > 0 && (
              <>
                <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#8b949e' }}>
                  Click a station card to view its officers — sorted by duty status
                </p>

                {/* Station cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px' }}>
                  {sortedSubstations.map((ss) => {
                    const total = parseInt(ss.total, 10);
                    const onDuty = parseInt(ss.on_duty, 10);
                    const offDuty = parseInt(ss.off_duty, 10);
                    const dutyPct = total > 0 ? Math.round((onDuty / total) * 100) : 0;
                    const label = SS_LABELS[ss.sub_station] || `Sub-station ${ss.sub_station}`;
                    const isSelected = selectedStation === ss.sub_station;
                    return (
                      <div
                        key={ss.sub_station}
                        onClick={() => {
                          setSelectedStation(isSelected ? null : ss.sub_station);
                          setStationSearch('');
                          setDrilldownPage(1);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.border = '1px solid #ffc107';
                          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255,193,7,0.12)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.border = isSelected ? '1px solid #ffc107' : '1px solid #30363d';
                          e.currentTarget.style.boxShadow = isSelected ? '0 0 0 2px rgba(255,193,7,0.12)' : 'none';
                        }}
                        style={{
                          background: isSelected ? 'rgba(255,193,7,0.04)' : '#161b22',
                          border: isSelected ? '1px solid #ffc107' : '1px solid #30363d',
                          boxShadow: isSelected ? '0 0 0 2px rgba(255,193,7,0.12)' : 'none',
                          borderRadius: '10px',
                          padding: '18px',
                          display: 'flex',
                          flexDirection: 'column' as const,
                          gap: '10px',
                          cursor: 'pointer',
                          transition: 'border 0.15s, box-shadow 0.15s, background 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 700, color: '#ffc107', textTransform: 'uppercase' as const, letterSpacing: '0.6px' }}>{label}</p>
                            <p style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: '#e6edf3', lineHeight: 1 }}>{total.toLocaleString()}</p>
                            <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#8b949e' }}>Total officers</p>
                          </div>
                          <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                            <p style={{ margin: '0 0 1px 0', fontSize: '16px', fontWeight: 700, color: '#4ade80' }}>{onDuty.toLocaleString()}</p>
                            <p style={{ margin: '0 0 8px 0', fontSize: '10px', color: '#8b949e' }}>On duty</p>
                            <p style={{ margin: '0 0 1px 0', fontSize: '16px', fontWeight: 700, color: '#6b7280' }}>{offDuty.toLocaleString()}</p>
                            <p style={{ margin: 0, fontSize: '10px', color: '#8b949e' }}>Off duty</p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div style={{ height: '3px', background: '#30363d', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${dutyPct}%`, background: onDuty > 0 ? '#4ade80' : '#30363d', borderRadius: '2px', transition: 'width 0.5s ease' }} />
                        </div>
                        <p style={{ margin: 0, fontSize: '10px', color: '#8b949e' }}>
                          {dutyPct}% on duty{isSelected ? ' · ▼ open' : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* ── Drilldown Panel ── */}
                {selectedStation !== null && (
                  <div style={{ marginTop: '24px', background: '#161b22', border: '1px solid #ffc107', borderRadius: '10px', overflow: 'hidden' }}>

                    {/* Panel header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #30363d', background: 'rgba(255,193,7,0.04)', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#ffc107', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                          {SS_LABELS[selectedStation] || `Sub-station ${selectedStation}`}
                        </p>
                        <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#8b949e' }}>
                          {drilldownData.all.length.toLocaleString()} officers assigned
                          {' · '}
                          <span style={{ color: '#4ade80' }}>{drilldownData.all.filter(o => o.duty_status === 'ON_DUTY').length}</span> on duty
                          {' · '}
                          <span style={{ color: '#f85149' }}>{drilldownData.all.filter(o => !o.is_active).length} inactive accounts</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedStation(null)}
                        style={{ background: 'none', border: '1px solid #30363d', borderRadius: '6px', color: '#8b949e', fontSize: '16px', lineHeight: 1, cursor: 'pointer', padding: '5px 11px' }}
                        title="Close panel"
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f85149'; e.currentTarget.style.color = '#f85149'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#8b949e'; }}
                      >✕</button>
                    </div>

                    {/* Search bar */}
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e', fontSize: '13px', pointerEvents: 'none' }}>🔍</span>
                        <input
                          type="text"
                          placeholder="Search by name, badge, email, or rank…"
                          value={stationSearch}
                          onChange={(e) => { setStationSearch(e.target.value); setDrilldownPage(1); }}
                          style={{ ...baseInput, paddingLeft: '32px' }}
                          onFocus={focusGold}
                          onBlur={blurGray}
                          autoFocus
                        />
                      </div>
                      {stationSearch && (
                        <button
                          onClick={() => { setStationSearch(''); setDrilldownPage(1); }}
                          style={{ padding: '7px 12px', fontSize: '12px', background: '#30363d', border: 'none', borderRadius: '6px', color: '#8b949e', cursor: 'pointer', whiteSpace: 'nowrap' as const }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Search result count */}
                    {stationSearch && (
                      <div style={{ padding: '7px 20px', borderBottom: '1px solid #21262d', fontSize: '12px', color: '#8b949e', background: '#0d1117' }}>
                        {drilldownData.filtered.length === 0
                          ? `No results for "${stationSearch}"`
                          : `${drilldownData.filtered.length.toLocaleString()} result${drilldownData.filtered.length !== 1 ? 's' : ''} for "${stationSearch}"`
                        }
                      </div>
                    )}

                    {/* Officer rows */}
                    {drilldownData.filtered.length === 0 ? (
                      <div style={{ padding: '48px 20px', textAlign: 'center', color: '#8b949e', fontSize: '13px' }}>
                        {stationSearch ? `No officers match "${stationSearch}"` : 'No officers assigned to this station.'}
                      </div>
                    ) : (
                      <div>
                        {drilldownData.shown.map((officer) => {
                          const rc = getRoleColor(officer.role);
                          const isOnDuty = officer.duty_status === 'ON_DUTY';
                          return (
                            <div
                              key={officer.id}
                              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', borderBottom: '1px solid #21262d', transition: 'background 0.1s' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#0d1117'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              {/* Avatar */}
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#ffc107', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#0d1117', flexShrink: 0 }}>
                                {getInitials(officer.full_name)}
                              </div>
                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: 600, color: '#e6edf3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {officer.rank_title && <span style={{ fontSize: '11px', color: '#8b949e', marginRight: '4px' }}>{officer.rank_title}</span>}
                                  {officer.full_name}
                                </p>
                                <p style={{ margin: 0, fontSize: '11px', color: '#8b949e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {officer.badge_number}{officer.email ? ` · ${officer.email}` : ''}
                                </p>
                              </div>
                              {/* Role badge */}
                              <span style={{ padding: '3px 7px', fontSize: '10px', fontWeight: 700, backgroundColor: rc.bg, color: rc.text, borderRadius: '3px', textTransform: 'uppercase' as const, flexShrink: 0 }}>
                                {getRoleLabel(officer.role)}
                              </span>
                              {/* Duty status */}
                              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnDuty ? '#4ade80' : '#6b7280', display: 'inline-block' }} />
                                <span style={{ fontSize: '9px', color: isOnDuty ? '#4ade80' : '#6b7280', fontWeight: 700, textTransform: 'uppercase' as const }}>
                                  {isOnDuty ? 'Duty' : 'Off'}
                                </span>
                              </div>
                              {/* Account inactive warning */}
                              {!officer.is_active && (
                                <span style={{ fontSize: '9px', color: '#f85149', fontWeight: 700, textTransform: 'uppercase' as const, flexShrink: 0, border: '1px solid rgba(248,81,73,0.3)', borderRadius: '3px', padding: '2px 5px' }}>
                                  Inactive
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {/* Load more */}
                        {drilldownData.shown.length < drilldownData.filtered.length && (
                          <div style={{ padding: '16px 20px', textAlign: 'center', borderTop: '1px solid #21262d' }}>
                            <button
                              onClick={() => setDrilldownPage(p => p + 1)}
                              style={{ padding: '8px 22px', fontSize: '12px', fontWeight: 600, background: '#30363d', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', cursor: 'pointer' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ffc107'; e.currentTarget.style.color = '#ffc107'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#e6edf3'; }}
                            >
                              Show more ({(drilldownData.filtered.length - drilldownData.shown.length).toLocaleString()} remaining)
                            </button>
                          </div>
                        )}

                        {/* Footer count */}
                        <div style={{ padding: '10px 20px', borderTop: '1px solid #21262d', fontSize: '11px', color: '#8b949e', textAlign: 'center' }}>
                          Showing {drilldownData.shown.length.toLocaleString()} of {drilldownData.filtered.length.toLocaleString()} officers
                          {!stationSearch && ' · on duty first, then A–Z'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            LIST VIEW
        ══════════════════════════════════════════ */}
        {view === 'list' && (
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* Filter bar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #30363d', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: '#161b22', position: 'sticky', top: 0, zIndex: 10 }}>
              {/* Search */}
              <div style={{ flex: '1 1 220px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e', fontSize: '13px', pointerEvents: 'none' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search name, badge, email, rank…"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  style={{ ...baseInput, paddingLeft: '32px', fontSize: '12px' }}
                  onFocus={focusGold}
                  onBlur={blurGray}
                />
              </div>
              {/* Station filter */}
              {sortedSubstations.length > 0 && (
                <select
                  value={listStationFilter}
                  onChange={(e) => setListStationFilter(e.target.value)}
                  style={{ ...baseInput, flex: '0 1 160px', width: 'auto', padding: '7px 10px', fontSize: '12px', cursor: 'pointer' }}
                  onFocus={focusGold}
                  onBlur={blurGray}
                >
                  <option value="">All Stations</option>
                  {sortedSubstations.map((s) => (
                    <option key={s.sub_station} value={s.sub_station}>{SS_LABELS[s.sub_station] || `Sub-station ${s.sub_station}`}</option>
                  ))}
                </select>
              )}
              {/* Role filter */}
              <select
                value={listRoleFilter}
                onChange={(e) => setListRoleFilter(e.target.value)}
                style={{ ...baseInput, flex: '0 1 140px', width: 'auto', padding: '7px 10px', fontSize: '12px', cursor: 'pointer' }}
                onFocus={focusGold}
                onBlur={blurGray}
              >
                <option value="">All Roles</option>
                <option value="OFFICER">Officer</option>
                <option value="DISPATCHER">Dispatcher</option>
                <option value="STATION_ADMIN">Admin</option>
              </select>
              {/* Status filter */}
              <select
                value={listStatusFilter}
                onChange={(e) => setListStatusFilter(e.target.value)}
                style={{ ...baseInput, flex: '0 1 150px', width: 'auto', padding: '7px 10px', fontSize: '12px', cursor: 'pointer' }}
                onFocus={focusGold}
                onBlur={blurGray}
              >
                <option value="">All Status</option>
                <option value="on_duty">On Duty</option>
                <option value="off_duty">Off Duty</option>
                <option value="active">Account Active</option>
                <option value="inactive">Account Inactive</option>
              </select>
              {/* Clear filters */}
              {hasFilters && (
                <button
                  onClick={() => { setListSearch(''); setListStationFilter(''); setListRoleFilter(''); setListStatusFilter(''); }}
                  style={{ padding: '7px 12px', fontSize: '11px', background: 'none', border: '1px solid #30363d', borderRadius: '6px', color: '#8b949e', cursor: 'pointer', whiteSpace: 'nowrap' as const }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f85149'; e.currentTarget.style.color = '#f85149'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#8b949e'; }}
                >
                  ✕ Clear
                </button>
              )}
              {/* Count */}
              <span style={{ fontSize: '12px', color: '#8b949e', whiteSpace: 'nowrap' as const, marginLeft: 'auto' }}>
                {filteredListOfficers.length.toLocaleString()} / {officers.length.toLocaleString()}
              </span>
            </div>

            {error && (
              <div style={{ margin: '20px 24px 0', padding: '12px 16px', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '6px', color: '#f85149', fontSize: '13px' }}>
                {error}
              </div>
            )}

            {loading && (
              <p style={{ color: '#8b949e', textAlign: 'center', marginTop: '48px', fontSize: '14px' }}>Loading officers…</p>
            )}

            {!loading && filteredListOfficers.length === 0 && (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: '#8b949e' }}>
                <p style={{ fontSize: '30px', margin: '0 0 12px 0' }}>👮</p>
                <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0', color: '#e6edf3' }}>
                  {officers.length === 0 ? 'No officers yet' : 'No results'}
                </p>
                <p style={{ fontSize: '12px', margin: 0 }}>
                  {officers.length === 0 ? 'Add your first officer to get started' : 'Try adjusting your search or filters'}
                </p>
              </div>
            )}

            {!loading && filteredListOfficers.length > 0 && (
              <div style={{ flex: 1 }}>
                {filteredListOfficers.map((officer) => {
                  const roleColor = getRoleColor(officer.role);
                  const isOnDuty = officer.duty_status === 'ON_DUTY';
                  const stationLabel = SS_LABELS[officer.sub_station || 'MAIN'] || officer.sub_station || 'Main';
                  return (
                    <div
                      key={officer.id}
                      style={{ padding: '14px 24px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', transition: 'background 0.15s', flexWrap: 'wrap' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#161b22'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {/* Left — avatar + info */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: '1 1 260px', minWidth: 0 }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#ffc107', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#0d1117', flexShrink: 0 }}>
                          {getInitials(officer.full_name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: '0 0 3px 0', fontWeight: 600, fontSize: '14px', color: '#e6edf3' }}>
                            {officer.rank_title && <span style={{ fontSize: '12px', color: '#8b949e', marginRight: '5px' }}>{officer.rank_title}</span>}
                            {officer.full_name}
                          </p>
                          <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#8b949e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {officer.badge_number}{officer.email ? ` · ${officer.email}` : ''}
                          </p>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ padding: '3px 8px', fontSize: '10px', fontWeight: 700, backgroundColor: roleColor.bg, color: roleColor.text, borderRadius: '3px', textTransform: 'uppercase' as const }}>
                              {getRoleLabel(officer.role)}
                            </span>
                            <span style={{ padding: '3px 8px', fontSize: '10px', fontWeight: 600, backgroundColor: '#0d1117', color: '#8b949e', borderRadius: '3px', border: '1px solid #30363d' }}>
                              {stationLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right — status pills + toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                        {/* Duty status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: isOnDuty ? 'rgba(74,222,128,0.08)' : 'rgba(107,114,128,0.08)', borderRadius: '4px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block', backgroundColor: isOnDuty ? '#4ade80' : '#6b7280' }} />
                          <span style={{ fontSize: '11px', fontWeight: 700, color: isOnDuty ? '#4ade80' : '#6b7280', textTransform: 'uppercase' as const }}>
                            {isOnDuty ? 'On Duty' : 'Off Duty'}
                          </span>
                        </div>
                        {/* Account active */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: officer.is_active ? 'rgba(76,175,80,0.08)' : 'rgba(156,156,156,0.08)', borderRadius: '4px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block', backgroundColor: officer.is_active ? '#4caf50' : '#9e9e9e' }} />
                          <span style={{ fontSize: '11px', fontWeight: 700, color: officer.is_active ? '#4caf50' : '#9e9e9e', textTransform: 'uppercase' as const }}>
                            {officer.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {/* Toggle button */}
                        <button
                          onClick={() => handleToggleActive(officer.id, officer.is_active)}
                          disabled={actionLoading === officer.id}
                          style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#e6edf3', backgroundColor: '#30363d', border: '1px solid #30363d', borderRadius: '4px', cursor: actionLoading === officer.id ? 'not-allowed' : 'pointer', opacity: actionLoading === officer.id ? 0.6 : 1, textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }}
                          onMouseEnter={(e) => { if (actionLoading !== officer.id) { e.currentTarget.style.borderColor = '#ffc107'; e.currentTarget.style.color = '#ffc107'; } }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#e6edf3'; }}
                        >
                          {actionLoading === officer.id ? '…' : officer.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </DispatchLayout>
  );
}
