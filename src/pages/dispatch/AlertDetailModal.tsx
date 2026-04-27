import React, { useState, useEffect, useRef } from 'react';
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
  strikes?: number;
  accuracy?: number;
  assigned_officer_id?: string;
  assigned_officer_name?: string;
}

interface AlertDetailModalProps {
  alert: Alert;
  onClose: () => void;
  onUpdate: (alert: Alert) => void;
}

// Pasay City Police Station coordinates
const STATION_LAT = 14.5378;
const STATION_LNG = 121.0014;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export default function AlertDetailModal({ alert, onClose, onUpdate }: AlertDetailModalProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notes, setNotes] = useState('');
  const [suspiciousReason, setSuspiciousReason] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [showSuspiciousForm, setShowSuspiciousForm] = useState(false);
  const [officers, setOfficers] = useState<any[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [reverseGeoAddress, setReverseGeoAddress] = useState('');
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [officerSearch, setOfficerSearch] = useState('');
  const [showOfficerList, setShowOfficerList] = useState(false);
  const officerSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dispatchApi.getOfficers().then((data: any) => {
      const list = data.officers || [];
      // Sort by distance from alert location — nearest duty officer first
      if (alert.location) {
        list.sort((a: any, b: any) => {
          const aDist = a.officer_lat != null ? haversineKm(alert.location!.lat, alert.location!.lng, a.officer_lat, a.officer_lng) : Infinity;
          const bDist = b.officer_lat != null ? haversineKm(alert.location!.lat, alert.location!.lng, b.officer_lat, b.officer_lng) : Infinity;
          return aDist - bDist;
        });
        // Auto-select the nearest officer who has GPS
        const nearest = list.find((o: any) => o.officer_lat != null && o.is_active && o.role === 'OFFICER');
        if (nearest && !selectedOfficerId) setSelectedOfficerId(String(nearest.id));
      }
      setOfficers(list);
    }).catch(() => {});
  }, []);

  // Reverse geocode location
  useEffect(() => {
    if (alert.location) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${alert.location.lat}&lon=${alert.location.lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'en' }
      })
        .then(r => r.json())
        .then(data => {
          if (data.display_name) {
            const parts = data.display_name.split(',').slice(0, 3).map((s: string) => s.trim());
            setReverseGeoAddress(parts.join(', '));
          }
        })
        .catch(() => {});
    }
  }, [alert.location?.lat, alert.location?.lng]);

  // Close officer dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (officerSearchRef.current && !officerSearchRef.current.contains(e.target as Node)) {
        setShowOfficerList(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOfficer = officers.find((o: any) => String(o.id) === selectedOfficerId) || null;
  const filteredOfficers = officerSearch.trim() === ''
    ? officers
    : officers.filter((o: any) =>
        o.full_name.toLowerCase().includes(officerSearch.toLowerCase()) ||
        o.badge_number.toLowerCase().includes(officerSearch.toLowerCase())
      );

  const handleAssignOfficer = async () => {
    if (!selectedOfficerId) return;
    setActionLoading(true);
    setActionError('');
    try {
      const result = await dispatchApi.assignOfficer(alert.id, selectedOfficerId);
      onUpdate(result.alert || result);
      setSelectedOfficerId('');
      setAssignSuccess(true);
      setTimeout(() => setAssignSuccess(false), 2500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to assign officer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      const result = await dispatchApi.acknowledge(alert.id);
      onUpdate((result as any)?.alert || result);
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
      const result = await dispatchApi.resolve(alert.id, notes);
      onUpdate((result as any)?.alert || result);
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
      const result = await dispatchApi.falseAlarm(alert.id, notes);
      onUpdate((result as any)?.alert || result);
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
      const result = await dispatchApi.markSuspicious(alert.id, suspiciousReason);
      onUpdate((result as any)?.alert || result);
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
      case 'ACTIVE':       return { bg: 'rgba(248, 81, 73, 0.15)',  border: '#f85149', text: '#ff7675' };
      case 'ACKNOWLEDGED': return { bg: 'rgba(255, 193, 7, 0.15)',  border: '#ffc107', text: '#ffc107' };
      case 'EN_ROUTE':     return { bg: 'rgba(14, 165, 233, 0.15)', border: '#0ea5e9', text: '#38bdf8' };
      case 'ON_SCENE':     return { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316', text: '#fb923c' };
      case 'RESOLVED':     return { bg: 'rgba(33, 150, 243, 0.15)', border: '#2196f3', text: '#42a5f5' };
      case 'FALSE_ALARM':  return { bg: 'rgba(156, 156, 156, 0.15)',border: '#9e9e9e', text: '#a0a0a0' };
      case 'CANCELLED':    return { bg: 'rgba(100, 100, 100, 0.12)',border: '#666',    text: '#888' };
      default:             return { bg: 'rgba(200, 200, 200, 0.1)', border: '#c0c0c0', text: '#c0c0c0' };
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
    return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const statusColor = getStatusColor(alert.status);
  const trustColor = getTrustColor(alert.trust_score);
  const tNum = Number(alert.triggered_at);
  const triggeredMs = !isNaN(tNum) ? (tNum < 10000000000 ? tNum * 1000 : tNum) : new Date(String(alert.triggered_at)).getTime();
  const elapsed = formatElapsed(Date.now() - triggeredMs);
  const distKm = alert.location ? haversineKm(alert.location.lat, alert.location.lng, STATION_LAT, STATION_LNG) : null;
  const strikes = (alert as any).strikes ?? 0;
  const accuracy = (alert as any).accuracy ?? null;

  // SVG Trust Gauge
  const gaugeRadius = 40;
  const gaugeStroke = 8;
  const gaugeCircumference = Math.PI * gaugeRadius;
  const gaugeFill = (alert.trust_score / 100) * gaugeCircumference;

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px', animation: 'fadeIn 0.2s ease-out' }}
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '12px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header with Avatar */}
        <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {(alert as any).photo_url ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <img
                  src={(alert as any).photo_url}
                  alt={alert.full_name}
                  onError={(e) => { const t = e.target as HTMLImageElement; t.parentElement!.style.display = 'none'; }}
                  style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '3px solid #ffc107', boxShadow: '0 0 12px rgba(255,193,7,0.5)' }}
                />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#ffc107', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CITIZEN</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#ffc107', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: '#0d1117', flexShrink: 0, border: '3px solid #ffc107' }}>
                  {getInitials(alert.full_name)}
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#ffc107', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CITIZEN</span>
              </div>
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#e6edf3' }}>{alert.full_name}</h2>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#8b949e' }}>{alert.phone && alert.phone !== '0' ? alert.phone : ''}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: '22px', backgroundColor: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}>&times;</button>
        </div>

        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Status / Elapsed / Trust Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            {/* Status Card */}
            <div style={{ padding: '16px 12px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #30363d', textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</p>
              <span style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 700, backgroundColor: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}`, borderRadius: '4px', textTransform: 'uppercase', display: 'inline-block' }}>
                {alert.status === 'ACTIVE' ? '\u25CF ' : ''}{alert.status}
              </span>
            </div>

            {/* Elapsed Card */}
            <div style={{ padding: '16px 12px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #30363d', textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Elapsed</p>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: alert.status === 'ACTIVE' ? '#ff7675' : '#e6edf3', fontFamily: 'monospace' }}>{elapsed}</p>
            </div>

            {/* Trust Gauge Card */}
            <div style={{ padding: '12px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #30363d', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg width="90" height="55" viewBox="0 0 100 60">
                {/* Background arc */}
                <path d={`M 10 55 A ${gaugeRadius} ${gaugeRadius} 0 0 1 90 55`} fill="none" stroke="#30363d" strokeWidth={gaugeStroke} strokeLinecap="round" />
                {/* Filled arc */}
                <path d={`M 10 55 A ${gaugeRadius} ${gaugeRadius} 0 0 1 90 55`} fill="none" stroke={trustColor} strokeWidth={gaugeStroke} strokeLinecap="round" strokeDasharray={`${gaugeFill} ${gaugeCircumference}`} />
                <text x="50" y="48" textAnchor="middle" fill={trustColor} fontSize="20" fontWeight="700">{alert.trust_score}</text>
              </svg>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 600, color: trustColor, textTransform: 'uppercase' }}>Trust</p>
            </div>
          </div>

          {/* Assigned Officer Card — shown whenever an officer is linked to this alert */}
          {(alert as any).officer_name && (
            <div style={{ padding: '14px 16px', backgroundColor: 'rgba(14,165,233,0.08)', borderRadius: '8px', border: '1px solid rgba(14,165,233,0.3)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', border: '3px solid #38bdf8', boxShadow: '0 0 10px rgba(14,165,233,0.5)' }}>
                  {getInitials((alert as any).officer_name)}
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OFFICER</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>🚔 Assigned Officer</p>
                <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: '#e6edf3' }}>{(alert as any).officer_name}</p>
                {(alert as any).officer_badge && (
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: '#8b949e' }}>Badge: {(alert as any).officer_badge}</p>
                )}
                {(alert as any).officer_phone && (
                  <a href={`tel:${(alert as any).officer_phone}`} style={{ display: 'inline-block', marginTop: 4, fontSize: 13, fontWeight: 700, color: '#4ade80', textDecoration: 'none' }}>
                    📞 {(alert as any).officer_phone}
                  </a>
                )}
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(14,165,233,0.15)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.3)', whiteSpace: 'nowrap' }}>
                {alert.status}
              </span>
            </div>
          )}

          {/* Error Message */}
          {actionError && (
            <div style={{ padding: '12px', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '6px', color: '#f85149', fontSize: '13px' }}>
              {actionError}
            </div>
          )}

          {/* Location Info Card */}
          <div style={{ padding: '16px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Barangay</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#e6edf3' }}>{alert.barangay}</p>
              </div>
              {reverseGeoAddress && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#4fc3f7' }}>{reverseGeoAddress}</p>
                </div>
              )}
            </div>

            {alert.location && distKm !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                <span style={{ color: '#ffc107', fontSize: '14px' }}>{'\u2605'}</span>
                <span style={{ fontSize: '13px', color: '#ffc107', fontWeight: 600 }}>{distKm.toFixed(2)} km from station</span>
              </div>
            )}

            {alert.location && (
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#8b949e', fontFamily: 'monospace' }}>
                {alert.location.lat.toFixed(6)},&nbsp;&nbsp;{alert.location.lng.toFixed(6)}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #30363d' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Triggered</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#e6edf3' }}>{formatDate(alert.triggered_at)}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Strikes</p>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: i < strikes ? '#f85149' : '#30363d', display: 'inline-block' }} />
                  ))}
                </div>
              </div>
            </div>

            {accuracy !== null && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #30363d' }}>
                <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Accuracy</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#e6edf3' }}>{'\u00B1'}{accuracy}m</p>
              </div>
            )}
          </div>

          {/* Incident Photo from Citizen */}
          {(alert as any).incident_photo && (
            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #30363d' }}>
              <p style={{ margin: 0, padding: '8px 12px', fontSize: '10px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', background: '#0d1117', letterSpacing: '0.5px' }}>📷 Incident Photo</p>
              <img
                src={(alert as any).incident_photo}
                alt="Incident"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }}
              />
            </div>
          )}

          {/* Responder Disposition Notes */}
          {(alert as any).notes && (
            <div style={{ padding: '14px 16px', backgroundColor: 'rgba(63,185,80,0.06)', borderRadius: '8px', border: '1px solid rgba(63,185,80,0.3)' }}>
              <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 600, color: '#3fb950', textTransform: 'uppercase', letterSpacing: '0.5px' }}>✅ Responder Disposition / Action Taken</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#e6edf3', lineHeight: 1.6 }}>{(alert as any).notes}</p>
            </div>
          )}

          {/* Embedded Map */}
          {alert.location && (
            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #30363d', height: '180px' }}>
              <iframe
                title="Alert Location"
                width="100%"
                height="180"
                frameBorder="0"
                scrolling="no"
                style={{ border: 0, display: 'block' }}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${alert.location.lng - 0.005},${alert.location.lat - 0.003},${alert.location.lng + 0.005},${alert.location.lat + 0.003}&layer=mapnik&marker=${alert.location.lat},${alert.location.lng}`}
              />
            </div>
          )}

          {/* ASSIGN OFFICER */}
          {(alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED') && (
            <div style={{ padding: '16px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
              {/* Nearest Officer Recommendation */}
              {(() => {
                const nearest = officers.find((o: any) => o.officer_lat != null && o.is_active && o.role === 'OFFICER');
                if (!nearest || !alert.location) return null;
                const dist = haversineKm(alert.location.lat, alert.location.lng, nearest.officer_lat, nearest.officer_lng);
                return (
                  <div style={{ padding: '10px 12px', marginBottom: 12, backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>📍</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#58a6ff' }}>NEAREST ON-DUTY OFFICER</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#e6edf3', fontWeight: 600 }}>{nearest.full_name} · {nearest.badge_number}</p>
                      <p style={{ margin: '1px 0 0', fontSize: 11, color: '#8b949e' }}>{dist.toFixed(2)} km from SOS location</p>
                    </div>
                  </div>
                );
              })()}
              <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assign Officer</p>
              {/* Searchable Officer Combobox */}
              <div ref={officerSearchRef} style={{ position: 'relative' }}>
                {/* Selected officer chip */}
                {selectedOfficer && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', backgroundColor: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.4)', borderRadius: 6 }}>
                    <span style={{ fontSize: 16, color: '#ffc107' }}>&#10003;</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{selectedOfficer.full_name}</span>
                      <span style={{ fontSize: 11, color: '#8b949e', marginLeft: 6 }}>{selectedOfficer.badge_number}</span>
                      {alert.location && selectedOfficer.officer_lat != null && (
                        <span style={{ fontSize: 11, color: '#58a6ff', marginLeft: 6 }}>
                          {haversineKm(alert.location.lat, alert.location.lng, selectedOfficer.officer_lat, selectedOfficer.officer_lng).toFixed(2)} km
                        </span>
                      )}
                    </div>
                    <button onClick={() => { setSelectedOfficerId(''); setOfficerSearch(''); }} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>&#215;</button>
                  </div>
                )}
                {/* Search input + Assign button row */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8b949e', pointerEvents: 'none' }}>&#128269;</span>
                    <input
                      type="text"
                      value={officerSearch}
                      onChange={e => { setOfficerSearch(e.target.value); setShowOfficerList(true); }}
                      onFocus={() => setShowOfficerList(true)}
                      placeholder={selectedOfficer ? 'Change officer...' : 'Search by name or badge...'}
                      style={{ width: '100%', padding: '10px 12px 10px 32px', fontSize: 13, backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>
                  <button
                    onClick={handleAssignOfficer}
                    disabled={!selectedOfficerId || actionLoading}
                    style={{ padding: '10px 20px', fontSize: 12, fontWeight: 600, color: '#161b22', backgroundColor: '#ffc107', border: 'none', borderRadius: 6, cursor: !selectedOfficerId || actionLoading ? 'not-allowed' : 'pointer', opacity: !selectedOfficerId || actionLoading ? 0.5 : 1, whiteSpace: 'nowrap' }}
                  >Assign</button>
                </div>
                {/* Dropdown list */}
                {showOfficerList && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 8, zIndex: 999, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                    {filteredOfficers.length === 0 ? (
                      <div style={{ padding: '14px 16px', color: '#8b949e', fontSize: 13, textAlign: 'center' }}>No officers found</div>
                    ) : filteredOfficers.map((o: any, i: number) => {
                      const dist = alert.location && o.officer_lat != null
                        ? haversineKm(alert.location.lat, alert.location.lng, o.officer_lat, o.officer_lng)
                        : null;
                      const isNearest = i === 0 && dist != null;
                      const isSelected = String(o.id) === selectedOfficerId;
                      const isOnDuty = o.is_active && o.role === 'OFFICER';
                      return (
                        <div
                          key={o.id}
                          onClick={() => { setSelectedOfficerId(String(o.id)); setOfficerSearch(''); setShowOfficerList(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', backgroundColor: isSelected ? 'rgba(255,193,7,0.1)' : 'transparent', borderBottom: i < filteredOfficers.length - 1 ? '1px solid #21262d' : 'none' }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = isSelected ? 'rgba(255,193,7,0.1)' : 'transparent'; }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: isOnDuty ? '#2196f3' : '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {o.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>{o.full_name}</span>
                              {isNearest && <span style={{ fontSize: 10, padding: '1px 5px', backgroundColor: 'rgba(59,130,246,0.2)', color: '#58a6ff', borderRadius: 4, fontWeight: 700 }}>NEAREST</span>}
                              {isSelected && <span style={{ fontSize: 11, color: '#ffc107' }}>&#10003;</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: '#8b949e' }}>{o.badge_number}</span>
                              <span style={{ fontSize: 11, color: isOnDuty ? '#3fb950' : '#8b949e' }}>&#9679; {isOnDuty ? 'On duty' : 'Off duty'}</span>
                              {dist != null && <span style={{ fontSize: 11, color: '#58a6ff' }}>{dist.toFixed(2)} km away</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {assignSuccess && (
                <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: 'rgba(63,185,80,0.12)', border: '1px solid #3fb950', borderRadius: '6px', color: '#3fb950', fontSize: '12px', fontWeight: 600 }}>
                  ✓ Officer assigned successfully
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {(alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED') && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8b949e', marginBottom: '8px' }}>Notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes about this alert..." style={{ width: '100%', padding: '10px 12px', fontSize: '13px', backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', resize: 'vertical', minHeight: '60px', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
          )}

          {/* Resolve Form (Acknowledged) */}
          {alert.status === 'ACKNOWLEDGED' && (
            <div>
              {!showResolveForm ? (
                <button onClick={() => setShowResolveForm(true)} style={{ width: '100%', padding: '14px', fontSize: '14px', fontWeight: 700, color: '#fff', backgroundColor: '#2196f3', border: 'none', borderRadius: '8px', cursor: 'pointer', textTransform: 'uppercase' }}>
                  Resolve Alert
                </button>
              ) : (
                <div style={{ padding: '16px', backgroundColor: '#0d1117', borderRadius: '6px', border: '1px solid #30363d' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8b949e', marginBottom: '8px', textTransform: 'uppercase' }}>Resolution Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter resolution notes..." style={{ width: '100%', padding: '10px 12px', fontSize: '13px', backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', resize: 'vertical', minHeight: '80px', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={handleResolve} disabled={actionLoading} style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 600, color: '#fff', backgroundColor: '#2196f3', border: 'none', borderRadius: '6px', cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.6 : 1, textTransform: 'uppercase' }}>{actionLoading ? 'Resolving...' : 'Confirm'}</button>
                    <button onClick={() => { setShowResolveForm(false); setNotes(''); }} disabled={actionLoading} style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 600, color: '#e6edf3', backgroundColor: '#30363d', border: 'none', borderRadius: '6px', cursor: 'pointer', textTransform: 'uppercase' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Acknowledge (Active) */}
          {alert.status === 'ACTIVE' && (
            <button onClick={handleAcknowledge} disabled={actionLoading} style={{ width: '100%', padding: '14px', fontSize: '14px', fontWeight: 700, color: '#fff', backgroundColor: '#2563eb', border: 'none', borderRadius: '8px', cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.6 : 1 }}>
              {actionLoading ? 'Acknowledging...' : '\uD83D\uDE93 Acknowledge'}
            </button>
          )}

          {/* Suspicious + False Alarm */}
          {alert.status !== 'FALSE_ALARM' && alert.status !== 'RESOLVED' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {!showSuspiciousForm ? (
                <button onClick={() => setShowSuspiciousForm(true)} style={{ padding: '14px', fontSize: '13px', fontWeight: 700, color: '#f85149', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '8px', cursor: 'pointer' }}>
                  {'\u26A0\uFE0F'} Suspicious
                </button>
              ) : (
                <div style={{ gridColumn: '1 / -1', padding: '16px', backgroundColor: '#0d1117', borderRadius: '6px', border: '1px solid #30363d' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8b949e', marginBottom: '8px', textTransform: 'uppercase' }}>Reason</label>
                  <textarea value={suspiciousReason} onChange={(e) => setSuspiciousReason(e.target.value)} placeholder="Describe why this alert is suspicious..." style={{ width: '100%', padding: '10px 12px', fontSize: '13px', backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', resize: 'vertical', minHeight: '80px', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={handleMarkSuspicious} disabled={actionLoading || !suspiciousReason.trim()} style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 600, color: '#fff', backgroundColor: '#f85149', border: 'none', borderRadius: '6px', cursor: actionLoading || !suspiciousReason.trim() ? 'not-allowed' : 'pointer', opacity: actionLoading || !suspiciousReason.trim() ? 0.6 : 1, textTransform: 'uppercase' }}>{actionLoading ? 'Marking...' : 'Confirm'}</button>
                    <button onClick={() => { setShowSuspiciousForm(false); setSuspiciousReason(''); }} disabled={actionLoading} style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 600, color: '#e6edf3', backgroundColor: '#30363d', border: 'none', borderRadius: '6px', cursor: 'pointer', textTransform: 'uppercase' }}>Cancel</button>
                  </div>
                </div>
              )}
              {!showSuspiciousForm && (
                <button onClick={handleFalseAlarm} disabled={actionLoading} style={{ padding: '14px', fontSize: '13px', fontWeight: 700, color: '#f85149', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '8px', cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.6 : 1 }}>
                  {'\u2716'} False Alarm
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
