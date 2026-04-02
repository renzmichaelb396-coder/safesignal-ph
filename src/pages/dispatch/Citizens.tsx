import React, { useState, useEffect } from 'react';
import { dispatchApi, getInitials } from '../../lib/api';

interface Citizen {
  id: string;
  full_name: string;
  phone: string;
  barangay: string;
  is_suspended: boolean;
  strike_count: number;
  trust: {
    score: number;
    last_updated: string;
  };
}

export default function Citizens() {
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [filteredCitizens, setFilteredCitizens] = useState<Citizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchCitizens();
  }, []);

  useEffect(() => {
    filterCitizens();
  }, [citizens, search]);

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
    if (!search.trim()) {
      setFilteredCitizens(citizens);
    } else {
      const query = search.toLowerCase();
      setFilteredCitizens(
        citizens.filter(
          (citizen) =>
            citizen.full_name.toLowerCase().includes(query) ||
            citizen.phone.includes(query) ||
            citizen.barangay.toLowerCase().includes(query)
        )
      );
    }
  };

  const handleSuspend = async (citizenId: string) => {
    setActionLoading(citizenId);
    setActionError('');
    try {
      await dispatchApi.suspendCitizen(citizenId);
      setCitizens(
        citizens.map((c) => (c.id === citizenId ? { ...c, is_suspended: true } : c))
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to suspend citizen');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async (citizenId: string) => {
    setActionLoading(citizenId);
    setActionError('');
    try {
      await dispatchApi.unsuspendCitizen(citizenId);
      setCitizens(
        citizens.map((c) => (c.id === citizenId ? { ...c, is_suspended: false } : c))
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to unsuspend citizen');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetStrikes = async (citizenId: string) => {
    setActionLoading(citizenId);
    setActionError('');
    try {
      await dispatchApi.resetStrikes(citizenId);
      setCitizens(
        citizens.map((c) => (c.id === citizenId ? { ...c, strike_count: 0 } : c))
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reset strikes');
    } finally {
      setActionLoading(null);
    }
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

  return (
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
        }}
      >
        <h1 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: 600, color: 'var(--ph-gold, #ffc107)' }}>
          Citizens
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--dispatch-border, #8b949e)' }}>
          {filteredCitizens.length} result{filteredCitizens.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--dispatch-border, #30363d)',
          display: 'flex',
          gap: '12px',
        }}
      >
        <div style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Search by name, phone, or barangay..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '13px',
              backgroundColor: 'var(--dispatch-border, #161b22)',
              border: '1px solid var(--dispatch-border, #30363d)',
              borderRadius: '6px',
              color: '#e6edf3',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
            }}
          />
        </div>
        <button
          onClick={fetchCitizens}
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

        {actionError && (
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
            {actionError}
          </div>
        )}

        {filteredCitizens.length === 0 && !loading && (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--dispatch-border, #8b949e)',
            }}
          >
            <p style={{ fontSize: '32px', margin: '0 0 12px 0' }}>ð</p>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0' }}>No citizens found</p>
            <p style={{ fontSize: '12px', margin: 0 }}>
              {search ? 'Try adjusting your search' : 'No citizens in the system'}
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
            <p style={{ fontSize: '14px' }}>Loading citizens...</p>
          </div>
        )}

        {!loading && filteredCitizens.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredCitizens.map((citizen) => {
              const trustColor = getTrustColor((citizen.trust?.score ?? 0));
              const trustBg = getTrustBg((citizen.trust?.score ?? 0));

              return (
                <div
                  key={citizen.id}
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
                      {getInitials(citizen.full_name)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                          {citizen.full_name}
                        </p>
                        {citizen.is_suspended && (
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
                            Suspended
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
                        {citizen.phone} â¢ {citizen.barangay}
                      </p>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                        <div
                          style={{
                            padding: '6px 10px',
                            backgroundColor: trustBg,
                            color: trustColor,
                            borderRadius: '4px',
                            fontWeight: 700,
                          }}
                        >
                          Trust: {(citizen.trust?.score ?? 0)}%
                        </div>
                        <div
                          style={{
                            padding: '6px 10px',
                            backgroundColor: 'rgba(255, 193, 7, 0.1)',
                            color: 'var(--ph-gold, #ffc107)',
                            borderRadius: '4px',
                            fontWeight: 700,
                          }}
                        >
                          Strikes: {citizen.strike_count}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Section - Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
                    {citizen.strike_count > 0 && (
                      <button
                        onClick={() => handleResetStrikes(citizen.id)}
                        disabled={actionLoading === citizen.id}
                        style={{
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--ph-gold, #ffc107)',
                          backgroundColor: 'rgba(255, 193, 7, 0.1)',
                          border: '1px solid var(--ph-gold, #ffc107)',
                          borderRadius: '4px',
                          cursor: actionLoading === citizen.id ? 'not-allowed' : 'pointer',
                          opacity: actionLoading === citizen.id ? 0.6 : 1,
                          transition: 'all 0.2s',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                          if (actionLoading !== citizen.id) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.1)';
                        }}
                      >
                        {actionLoading === citizen.id ? '...' : 'Reset Strikes'}
                      </button>
                    )}

                    {citizen.is_suspended ? (
                      <button
                        onClick={() => handleUnsuspend(citizen.id)}
                        disabled={actionLoading === citizen.id}
                        style={{
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#4caf50',
                          backgroundColor: 'rgba(76, 175, 80, 0.1)',
                          border: '1px solid #4caf50',
                          borderRadius: '4px',
                          cursor: actionLoading === citizen.id ? 'not-allowed' : 'pointer',
                          opacity: actionLoading === citizen.id ? 0.6 : 1,
                          transition: 'all 0.2s',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                          if (actionLoading !== citizen.id) {
                            e.currentTarget.style.backgroundColor = 'rgba(76, 175, 80, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
                        }}
                      >
                        {actionLoading === citizen.id ? '...' : 'Unsuspend'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSuspend(citizen.id)}
                        disabled={actionLoading === citizen.id}
                        style={{
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--sos-red, #f85149)',
                          backgroundColor: 'rgba(248, 81, 73, 0.1)',
                          border: '1px solid var(--sos-red, #f85149)',
                          borderRadius: '4px',
                          cursor: actionLoading === citizen.id ? 'not-allowed' : 'pointer',
                          opacity: actionLoading === citizen.id ? 0.6 : 1,
                          transition: 'all 0.2s',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                          if (actionLoading !== citizen.id) {
                            e.currentTarget.style.backgroundColor = 'rgba(248, 81, 73, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(248, 81, 73, 0.1)';
                        }}
                      >
                        {actionLoading === citizen.id ? '...' : 'Suspend'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
