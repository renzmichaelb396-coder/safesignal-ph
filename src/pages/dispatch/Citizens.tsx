import React, { useState, useEffect } from 'react';
import { dispatchApi, getInitials } from '../../lib/api';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';
import DispatchLayout from './DispatchLayout';

interface Citizen {
  id: string;
  full_name: string;
  phone: string;
  address?: string;
  barangay: string;
  is_suspended: boolean | number;
  strike_count: number;
  trust_score?: number;
  verified?: boolean | number;
  photo_url?: string;
  gov_id_type?: string;
  gov_id_number?: string;
  gov_id_photo?: string;
  registered_at?: number;
}

export default function Citizens() {
  const { officer } = useDispatchAuth();
  const isAdmin = officer?.role === 'STATION_ADMIN';

  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [filteredCitizens, setFilteredCitizens] = useState<Citizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchCitizens(); }, []);

  useEffect(() => { filterCitizens(); }, [citizens, search, filter]);

  const fetchCitizens = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await dispatchApi.getCitizens({});
      setCitizens(response.citizens || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load citizens');
      setCitizens([]);
    } finally {
      setLoading(false);
    }
  };

  const filterCitizens = () => {
    let list = citizens;
    if (filter === 'suspended') list = list.filter(c => !!c.is_suspended);
    else if (filter === 'active') list = list.filter(c => !c.is_suspended);
    else if (filter === 'unverified') list = list.filter(c => !c.verified);
    else if (filter === 'verified') list = list.filter(c => !!c.verified);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.barangay.toLowerCase().includes(q)
      );
    }
    setFilteredCitizens(list);
  };

  const handleSuspend = async (citizenId: string) => {
    setActionLoading(citizenId); setActionError('');
    try {
      await dispatchApi.suspendCitizen(citizenId);
      setCitizens(citizens.map(c => c.id === citizenId ? { ...c, is_suspended: true } : c));
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Failed to suspend citizen'); }
    finally { setActionLoading(null); }
  };

  const handleUnsuspend = async (citizenId: string) => {
    setActionLoading(citizenId); setActionError('');
    try {
      await dispatchApi.unsuspendCitizen(citizenId);
      setCitizens(citizens.map(c => c.id === citizenId ? { ...c, is_suspended: false } : c));
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Failed to unsuspend citizen'); }
    finally { setActionLoading(null); }
  };

  const handleResetStrikes = async (citizenId: string) => {
    setActionLoading(citizenId); setActionError('');
    try {
      await dispatchApi.resetStrikes(citizenId);
      setCitizens(citizens.map(c => c.id === citizenId ? { ...c, strike_count: 0 } : c));
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Failed to reset strikes'); }
    finally { setActionLoading(null); }
  };

  const handleVerify = async (citizenId: string, verified: boolean) => {
    setActionLoading(citizenId); setActionError('');
    try {
      await dispatchApi.verifyCitizen(citizenId, verified);
      setCitizens(citizens.map(c => c.id === citizenId ? { ...c, verified } : c));
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Failed to update verification'); }
    finally { setActionLoading(null); }
  };

  const getTrustColor = (score: number) => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#8bc34a';
    if (score >= 40) return '#ff9800';
    return '#f44336';
  };

  const getTrustBg = (score: number) => {
    if (score >= 80) return 'rgba(76, 175, 80, 0.1)';
    if (score >= 60) return 'rgba(139, 195, 74, 0.1)';
    if (score >= 40) return 'rgba(255, 152, 0, 0.1)';
    return 'rgba(244, 67, 54, 0.1)';
  };

  const unverifiedCount = citizens.filter(c => !c.verified).length;

  return (
    <DispatchLayout>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0d1117', color: '#e6edf3' }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #30363d' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 600, color: '#ffc107' }}>
                Citizens
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>
                {filteredCitizens.length} result{filteredCitizens.length !== 1 ? 's' : ''}
                {unverifiedCount > 0 && filter !== 'verified' && (
                  <span style={{ marginLeft: 10, color: '#ff9800', fontWeight: 600 }}>
                    • {unverifiedCount} awaiting ID verification
                  </span>
                )}
              </p>
            </div>
            {isAdmin && unverifiedCount > 0 && (
              <button
                onClick={() => setFilter(filter === 'unverified' ? '' : 'unverified')}
                style={{
                  padding: '6px 14px', fontSize: '12px', fontWeight: 700,
                  background: filter === 'unverified' ? '#ff9800' : 'rgba(255,152,0,0.12)',
                  color: filter === 'unverified' ? '#000' : '#ff9800',
                  border: '1px solid #ff9800', borderRadius: 6, cursor: 'pointer',
                }}
              >
                {filter === 'unverified' ? '✓ Showing Unverified' : `Review ${unverifiedCount} Unverified`}
              </button>
            )}
          </div>
        </div>

        {/* Search + Filter */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #30363d', display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Search by name, phone, or barangay..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, padding: '9px 12px', fontSize: '13px',
              backgroundColor: '#161b22', border: '1px solid #30363d',
              borderRadius: '6px', color: '#e6edf3',
            }}
          />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              padding: '9px 12px', fontSize: '13px', backgroundColor: '#161b22',
              border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', cursor: 'pointer',
            }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="verified">ID Verified</option>
            <option value="unverified">Awaiting Verification</option>
          </select>
          <button
            onClick={fetchCitizens}
            disabled={loading}
            style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600,
              color: '#0d1117', backgroundColor: '#ffc107', border: 'none',
              borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {error && (
            <div style={{ margin: '24px', padding: '16px', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '6px', color: '#f85149', fontSize: '13px' }}>
              {error}
            </div>
          )}
          {actionError && (
            <div style={{ margin: '16px 24px 0', padding: '12px 16px', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '6px', color: '#f85149', fontSize: '13px' }}>
              {actionError}
            </div>
          )}

          {!loading && filteredCitizens.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8b949e' }}>
              <p style={{ fontSize: '32px', margin: '0 0 12px 0' }}>👤</p>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0' }}>No citizens found</p>
              <p style={{ fontSize: '12px', margin: 0 }}>
                {search || filter ? 'Try adjusting your search or filter' : 'No citizens in the system'}
              </p>
            </div>
          )}

          {loading && (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8b949e' }}>
              <p style={{ fontSize: '14px' }}>Loading citizens...</p>
            </div>
          )}

          {!loading && filteredCitizens.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredCitizens.map(citizen => {
                const isVerified = !!citizen.verified;
                const isSuspended = !!citizen.is_suspended;
                const trustScore = citizen.trust_score ?? 0;
                const isExpanded = expandedId === citizen.id;
                const hasGovId = !!(citizen.gov_id_type || citizen.gov_id_number || citizen.gov_id_photo);

                return (
                  <div key={citizen.id} style={{ borderBottom: '1px solid #30363d' }}>
                    {/* Row */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : citizen.id)}
                      style={{
                        padding: '14px 24px', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', cursor: 'pointer',
                        backgroundColor: isExpanded ? '#161b22' : 'transparent',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      {/* Left */}
                      <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        {/* Avatar / selfie */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          {citizen.photo_url ? (
                            <img src={citizen.photo_url} alt={citizen.full_name}
                              style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover',
                                border: isVerified ? '2px solid #4caf50' : '2px solid #30363d' }} />
                          ) : (
                            <div style={{
                              width: 42, height: 42, borderRadius: '50%', backgroundColor: '#ffc107',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '14px', fontWeight: 700, color: '#0d1117',
                              border: isVerified ? '2px solid #4caf50' : '2px solid transparent',
                            }}>
                              {getInitials(citizen.full_name)}
                            </div>
                          )}
                          {isVerified && (
                            <div style={{
                              position: 'absolute', bottom: -2, right: -2,
                              width: 16, height: 16, borderRadius: '50%',
                              background: '#4caf50', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700,
                              border: '2px solid #0d1117',
                            }}>✓</div>
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{citizen.full_name}</p>
                            {isVerified && (
                              <span style={{ padding: '2px 7px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(76,175,80,0.15)', color: '#4caf50', borderRadius: '3px' }}>
                                ID VERIFIED
                              </span>
                            )}
                            {!isVerified && hasGovId && (
                              <span style={{ padding: '2px 7px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(255,152,0,0.15)', color: '#ff9800', borderRadius: '3px' }}>
                                PENDING REVIEW
                              </span>
                            )}
                            {!isVerified && !hasGovId && (
                              <span style={{ padding: '2px 7px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(139,148,158,0.15)', color: '#8b949e', borderRadius: '3px' }}>
                                NO ID
                              </span>
                            )}
                            {isSuspended && (
                              <span style={{ padding: '2px 7px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(248,81,73,0.15)', color: '#f85149', borderRadius: '3px' }}>
                                SUSPENDED
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#8b949e' }}>
                            {citizen.phone} • {citizen.barangay}
                          </p>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                            <span style={{ padding: '4px 8px', backgroundColor: getTrustBg(trustScore), color: getTrustColor(trustScore), borderRadius: '4px', fontWeight: 700 }}>
                              Trust: {trustScore}%
                            </span>
                            <span style={{ padding: '4px 8px', backgroundColor: 'rgba(255,193,7,0.1)', color: '#ffc107', borderRadius: '4px', fontWeight: 700 }}>
                              Strikes: {citizen.strike_count}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Expand indicator */}
                      <div style={{ color: '#8b949e', fontSize: 12, marginLeft: 8, flexShrink: 0 }}>
                        {isExpanded ? '▲' : '▼'}
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div style={{ background: '#0d1117', borderTop: '1px solid #21262d', padding: '16px 24px' }}>

                        {/* Photos row */}
                        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                          {/* Selfie */}
                          <div style={{ flex: '0 0 auto' }}>
                            <p style={{ color: '#8b949e', fontSize: 11, fontWeight: 700, margin: '0 0 6px 0', textTransform: 'uppercase' }}>Selfie</p>
                            {citizen.photo_url ? (
                              <img src={citizen.photo_url} alt="Selfie"
                                style={{ width: 90, height: 90, borderRadius: 8, objectFit: 'cover', border: '1px solid #30363d' }} />
                            ) : (
                              <div style={{ width: 90, height: 90, borderRadius: 8, background: '#161b22', border: '1px dashed #30363d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e', fontSize: 11 }}>
                                No Photo
                              </div>
                            )}
                          </div>

                          {/* Gov ID Info + Photo */}
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <p style={{ color: '#8b949e', fontSize: 11, fontWeight: 700, margin: '0 0 6px 0', textTransform: 'uppercase' }}>Government ID</p>
                            {hasGovId ? (
                              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#e6edf3' }}>
                                    <span style={{ color: '#8b949e' }}>Type: </span>
                                    <strong>{citizen.gov_id_type || '—'}</strong>
                                  </p>
                                  <p style={{ margin: 0, fontSize: 12, color: '#e6edf3' }}>
                                    <span style={{ color: '#8b949e' }}>Number: </span>
                                    <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                                      {citizen.gov_id_number || '—'}
                                    </strong>
                                  </p>
                                </div>
                                {citizen.gov_id_photo ? (
                                  <div>
                                    <img src={citizen.gov_id_photo} alt="Gov ID"
                                      style={{ width: 160, maxHeight: 110, borderRadius: 6, objectFit: 'contain', border: '1px solid #30363d', background: '#161b22' }} />
                                    <p style={{ margin: '4px 0 0 0', fontSize: 10, color: '#8b949e', textAlign: 'center' }}>ID Photo</p>
                                  </div>
                                ) : (
                                  <div style={{ width: 120, height: 80, borderRadius: 6, background: '#161b22', border: '1px dashed #30363d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e', fontSize: 10, textAlign: 'center', padding: '0 8px' }}>
                                    No ID photo uploaded
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p style={{ fontSize: 12, color: '#8b949e', margin: 0 }}>No government ID submitted</p>
                            )}
                          </div>
                        </div>

                        {/* Actions row */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #21262d', paddingTop: 14 }}>

                          {/* Verify / Unverify — Admin only */}
                          {isAdmin && hasGovId && (
                            isVerified ? (
                              <button
                                onClick={() => handleVerify(citizen.id, false)}
                                disabled={actionLoading === citizen.id}
                                style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: '#8b949e', backgroundColor: 'rgba(139,148,158,0.1)', border: '1px solid #8b949e', borderRadius: '5px', cursor: 'pointer', opacity: actionLoading === citizen.id ? 0.5 : 1 }}
                              >
                                {actionLoading === citizen.id ? '...' : 'Remove Verification'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleVerify(citizen.id, true)}
                                disabled={actionLoading === citizen.id}
                                style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: '#4caf50', backgroundColor: 'rgba(76,175,80,0.12)', border: '1px solid #4caf50', borderRadius: '5px', cursor: 'pointer', opacity: actionLoading === citizen.id ? 0.5 : 1 }}
                              >
                                {actionLoading === citizen.id ? '...' : '✓ Mark ID Verified'}
                              </button>
                            )
                          )}

                          {/* Reset Strikes */}
                          {citizen.strike_count > 0 && (
                            <button
                              onClick={() => handleResetStrikes(citizen.id)}
                              disabled={actionLoading === citizen.id}
                              style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: '#ffc107', backgroundColor: 'rgba(255,193,7,0.1)', border: '1px solid #ffc107', borderRadius: '5px', cursor: 'pointer', opacity: actionLoading === citizen.id ? 0.5 : 1 }}
                            >
                              {actionLoading === citizen.id ? '...' : 'Reset Strikes'}
                            </button>
                          )}

                          {/* Suspend / Unsuspend */}
                          {isSuspended ? (
                            <button
                              onClick={() => handleUnsuspend(citizen.id)}
                              disabled={actionLoading === citizen.id}
                              style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: '#4caf50', backgroundColor: 'rgba(76,175,80,0.1)', border: '1px solid #4caf50', borderRadius: '5px', cursor: 'pointer', opacity: actionLoading === citizen.id ? 0.5 : 1 }}
                            >
                              {actionLoading === citizen.id ? '...' : 'Unsuspend'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSuspend(citizen.id)}
                              disabled={actionLoading === citizen.id}
                              style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: '#f85149', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '5px', cursor: 'pointer', opacity: actionLoading === citizen.id ? 0.5 : 1 }}
                            >
                              {actionLoading === citizen.id ? '...' : 'Suspend'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
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
