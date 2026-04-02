import React, { useState } from 'react';
import { dispatchApi, formatElapsed } from '../../lib/api';

interface Alert {
  id: string;
  full_name: string;
  phone?: string;
  barangay: string;
  status: string;
  triggered_at: string;
  location?: { lat: number; lng: number };
  location_history?: Array<{ lat: number; lng: number; timestamp: string }>;
  trust_score: number;
  is_suspicious: boolean;
}

interface AlertDetailModalProps {
  alert: Alert;
  onClose: () => void;
  onUpdate: (alert: Alert) => void;
}

export default function AlertDetailModal({ alert, onClose, onUpdate }: AlertDetailModalProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notes, setNotes] = useState('');
  const [suspiciousReason, setSuspiciousReason] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [showSuspiciousForm, setShowSuspiciousForm] = useState(false);

  const handleAcknowledge = async () => {
    setActionLoading(true);
    setActionError('');

    try {
      const updatedAlert = await dispatchApi.acknowledge(alert.id);
      onUpdate(updatedAlert);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to acknowledge alert');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    setActionLoading(true);
    setActionError('');

    try {
      const updatedAlert = await dispatchApi.resolve(alert.id, notes);
      onUpdate(updatedAlert);
      setNotes('');
      setShowResolveForm(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to resolve alert');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFalseAlarm = async () => {
    setActionLoading(true);
    setActionError('');

    try {
      const updatedAlert = await dispatchApi.falseAlarm(alert.id, notes);
      onUpdate(updatedAlert);
      setNotes('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark as false alarm');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkSuspicious = async () => {
    setActionLoading(true);
    setActionError('');

    try {
      const updatedAlert = await dispatchApi.markSuspicious(alert.id, suspiciousReason);
      onUpdate(updatedAlert);
      setSuspiciousReason('');
      setShowSuspiciousForm(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark as suspicious');
    } finally {
      setActionLoading(false);
    }
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

  const formatDate = (dateString: string | number) => {
    const num = Number(dateString);
    const ts = !isNaN(num) ? (num < 10000000000 ? num * 1000 : num) : NaN;
    const date = new Date(ts);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColor = getStatusColor(alert.status);
  const trustColor = getTrustColor(alert.trust_score);
  const tNum = Number(alert.triggered_at);
  const triggeredMs = !isNaN(tNum) ? (tNum < 10000000000 ? tNum * 1000 : tNum) : new Date(String(alert.triggered_at)).getTime();
  const elapsed = formatElapsed(Date.now() - triggeredMs);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          @keyframes slideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}
      </style>

      {/* Modal Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--dispatch-border, #161b22)',
          border: '1px solid var(--dispatch-border, #30363d)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          animation: 'slideUp 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid var(--dispatch-border, #30363d)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600 }}>
              {alert.full_name}
            </h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
                }}
              >
                {alert.status}
              </span>
              {alert.is_suspicious && (
                <span
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(248, 81, 73, 0.15)',
                    color: 'var(--sos-red, #f85149)',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  Suspicious
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              fontSize: '20px',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--dispatch-border, #8b949e)',
              cursor: 'pointer',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--dispatch-border, #30363d)';
              e.currentTarget.style.color = 'var(--dispatch-border, #e6edf3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--dispatch-border, #8b949e)';
            }}
          >
            
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Error Message */}
          {actionError && (
            <div
              style={{
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

          {/* Basic Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <p
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--dispatch-border, #8b949e)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                Phone
              </p>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--dispatch-border, #e6edf3)' }}>
                {alert.phone || '—'}
              </p>
            </div>
            <div>
              <p
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--dispatch-border, #8b949e)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                Barangay
              </p>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--dispatch-border, #e6edf3)' }}>
                {alert.barangay}
              </p>
            </div>
            <div>
              <p
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--dispatch-border, #8b949e)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                Triggered
              </p>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--dispatch-border, #e6edf3)' }}>
                {formatDate(alert.triggered_at)}
              </p>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--dispatch-border, #8b949e)' }}>
                {elapsed} ago
              </p>
            </div>
            <div>
              <p
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--dispatch-border, #8b949e)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                Trust Score
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 700,
                  color: trustColor,
                }}
              >
                {alert.trust_score}%
              </p>
            </div>
          </div>

          {/* Location */}
          {alert.location && (
            <div>
              <p
                style={{
                  margin: '0 0 12px 0',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--dispatch-border, #8b949e)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                Location
              </p>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--dispatch-bg, #0d1117)',
                  borderRadius: '6px',
                  border: '1px solid var(--dispatch-border, #30363d)',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: 'var(--ph-gold, #ffc107)',
                }}
              >
                {alert.location.lat.toFixed(6)}, {alert.location.lng.toFixed(6)}
              </div>
              {alert.location_history && alert.location_history.length > 0 && (
                <p
                  style={{
                    margin: '12px 0 0 0',
                    fontSize: '11px',
                    color: 'var(--dispatch-border, #8b949e)',
                  }}
                >
                  {alert.location_history.length} location update{alert.location_history.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Action Forms */}
          {alert.status === 'ACKNOWLEDGED' && (
            <div>
              {!showResolveForm ? (
                <button
                  onClick={() => setShowResolveForm(true)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0d1117',
                    backgroundColor: '#2196f3',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1976d2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#2196f3';
                  }}
                >
                  Resolve Alert
                </button>
              ) : (
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--dispatch-bg, #0d1117)',
                    borderRadius: '6px',
                    border: '1px solid var(--dispatch-border, #30363d)',
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--dispatch-border, #8b949e)',
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Resolution Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter resolution notes..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      backgroundColor: 'var(--dispatch-border, #161b22)',
                      border: '1px solid var(--dispatch-border, #30363d)',
                      borderRadius: '6px',
                      color: 'var(--dispatch-border, #e6edf3)',
                      resize: 'vertical',
                      minHeight: '80px',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      onClick={handleResolve}
                      disabled={actionLoading}
                      style={{
                        flex: 1,
                        padding: '10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#0d1117',
                        backgroundColor: '#2196f3',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        opacity: actionLoading ? 0.6 : 1,
                        textTransform: 'uppercase',
                      }}
                    >
                      {actionLoading ? 'Resolving...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => {
                        setShowResolveForm(false);
                        setNotes('');
                      }}
                      disabled={actionLoading}
                      style={{
                        flex: 1,
                        padding: '10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--dispatch-border, #e6edf3)',
                        backgroundColor: 'var(--dispatch-border, #30363d)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {alert.status === 'ACTIVE' && (
            <button
              onClick={handleAcknowledge}
              disabled={actionLoading}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0d1117',
                backgroundColor: 'var(--ph-gold, #ffc107)',
                border: 'none',
                borderRadius: '6px',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                opacity: actionLoading ? 0.6 : 1,
                transition: 'all 0.2s',
                textTransform: 'uppercase',
              }}
              onMouseEnter={(e) => {
                if (!actionLoading) e.currentTarget.style.backgroundColor = '#ffb300';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--ph-gold, #ffc107)';
              }}
            >
              {actionLoading ? 'Acknowledging...' : 'Acknowledge Alert'}
            </button>
          )}

          {/* Mark as Suspicious */}
          {alert.status !== 'FALSE_ALARM' && alert.status !== 'RESOLVED' && (
            <div>
              {!showSuspiciousForm ? (
                <button
                  onClick={() => setShowSuspiciousForm(true)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--sos-red, #f85149)',
                    backgroundColor: 'rgba(248, 81, 73, 0.1)',
                    border: '1px solid var(--sos-red, #f85149)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(248, 81, 73, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(248, 81, 73, 0.1)';
                  }}
                >
                  Mark as Suspicious
                </button>
              ) : (
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--dispatch-bg, #0d1117)',
                    borderRadius: '6px',
                    border: '1px solid var(--dispatch-border, #30363d)',
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--dispatch-border, #8b949e)',
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Reason
                  </label>
                  <textarea
                    value={suspiciousReason}
                    onChange={(e) => setSuspiciousReason(e.target.value)}
                    placeholder="Describe why this alert is suspicious..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      backgroundColor: 'var(--dispatch-border, #161b22)',
                      border: '1px solid var(--dispatch-border, #30363d)',
                      borderRadius: '6px',
                      color: 'var(--dispatch-border, #e6edf3)',
                      resize: 'vertical',
                      minHeight: '80px',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      onClick={handleMarkSuspicious}
                      disabled={actionLoading || !suspiciousReason.trim()}
                      style={{
                        flex: 1,
                        padding: '10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#0d1117',
                        backgroundColor: 'var(--sos-red, #f85149)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: actionLoading || !suspiciousReason.trim() ? 'not-allowed' : 'pointer',
                        opacity: actionLoading || !suspiciousReason.trim() ? 0.6 : 1,
                        textTransform: 'uppercase',
                      }}
                    >
                      {actionLoading ? 'Marking...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => {
                        setShowSuspiciousForm(false);
                        setSuspiciousReason('');
                      }}
                      disabled={actionLoading}
                      style={{
                        flex: 1,
                        padding: '10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--dispatch-border, #e6edf3)',
                        backgroundColor: 'var(--dispatch-border, #30363d)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mark as False Alarm */}
          {alert.status !== 'FALSE_ALARM' && alert.status !== 'RESOLVED' && (
            <button
              onClick={handleFalseAlarm}
              disabled={actionLoading}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--dispatch-border, #e6edf3)',
                backgroundColor: 'var(--dispatch-border, #30363d)',
                border: '1px solid var(--dispatch-border, #30363d)',
                borderRadius: '6px',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                opacity: actionLoading ? 0.6 : 1,
                transition: 'all 0.2s',
                textTransform: 'uppercase',
              }}
              onMouseEnter={(e) => {
                if (!actionLoading) {
                  e.currentTarget.style.borderColor = 'var(--dispatch-border, #8b949e)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
              }}
            >
              {actionLoading ? 'Marking...' : 'Mark as False Alarm'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
