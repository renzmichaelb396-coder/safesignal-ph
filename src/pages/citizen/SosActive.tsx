import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useCitizenAuth } from '../../hooks/useCitizenAuth';
import { citizenApi } from '../../lib/api';

declare global {
  interface Window {
    L?: any;
  }
}

export default function SosActive() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useCitizenAuth();
  const [sosStatus, setSosStatus] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gpsAvailable, setGpsAvailable] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const officerMarkerRef = useRef<any>(null);
  const sosIdRef = useRef<string | null>(null);

  const sosId = sosIdRef.current || localStorage.getItem('active_sos_id');

  useEffect(() => {
    if (sosId) sosIdRef.current = sosId;
  }, [sosId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/home');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data: any = await citizenApi.getActiveAlert();
        if (!data || !data.alert) {
          navigate('/home');
          return;
        }
        setSosStatus(data.alert);
        if (data.alert.id) {
          sosIdRef.current = String(data.alert.id);
          localStorage.setItem('active_sos_id', String(data.alert.id));
        }
      } catch (err) {
        setError('Failed to fetch status');
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sosStatus) return;
    const startTime = parseInt(sosStatus.triggered_at, 10);
    const timer = setInterval(() => {
      const now = new Date().getTime();
      setElapsedTime(Math.floor((now - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [sosStatus]);

  useEffect(() => {
    if (!sosId) return;
    const updateLocation = async () => {
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async position => {
              setGpsAvailable(true);
              try {
                await citizenApi.updateLocation(
                  position.coords.latitude,
                  position.coords.longitude,
                );
                if (mapInstance.current && markerRef.current) {
                  markerRef.current.setLatLng([position.coords.latitude, position.coords.longitude]);
                  mapInstance.current.setView([position.coords.latitude, position.coords.longitude], 15);
                }
              } catch (err) {
                console.error('Failed to update location', err);
              }
            },
            () => {
              setGpsAvailable(false);
            }
          );
        } else {
          setGpsAvailable(false);
        }
      } catch (err) {
        console.error('Location update error:', err);
      }
    };
    updateLocation();
    const interval = setInterval(updateLocation, 10000);
    return () => clearInterval(interval);
  }, [sosId]);

  // Show officer live location on citizen map (EN_ROUTE / ON_SCENE)
  useEffect(() => {
    if (!mapInstance.current) return;
    const officerLat = sosStatus?.officer_lat;
    const officerLng = sosStatus?.officer_lng;
    if (!officerLat || !officerLng) {
      if (officerMarkerRef.current) { officerMarkerRef.current.remove(); officerMarkerRef.current = null; }
      return;
    }
    if (officerMarkerRef.current) {
      officerMarkerRef.current.setLatLng([officerLat, officerLng]);
    } else {
      const icon = window.L.divIcon({
        className: '',
        html: `<div style="position:relative;width:32px;height:32px;"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:50%;background:rgba(59,130,246,0.2);animation:officerPulse 2s ease-out infinite;"></div><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:20px;height:20px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 2px 8px rgba(59,130,246,0.8);"></div></div><style>@keyframes officerPulse{0%{transform:translate(-50%,-50%) scale(0.5);opacity:1;}100%{transform:translate(-50%,-50%) scale(2);opacity:0;}}</style>`,
        iconSize: [32, 32], iconAnchor: [16, 16],
      });
      officerMarkerRef.current = window.L.marker([officerLat, officerLng], { icon }).addTo(mapInstance.current).bindPopup('\ud83d\udc6e Officer Location');
    }
  }, [sosStatus?.officer_lat, sosStatus?.officer_lng, sosStatus]);

  useEffect(() => {
    if (!mapRef.current || !sosStatus || mapInstance.current) return;
    const loadMap = () => {
      if (!window.L) {
        setTimeout(loadMap, 100);
        return;
      }
      // API returns lat/lng (normalized by normalizeAlert) — NOT latitude/longitude
      const lat = sosStatus?.lat || 14.5794;
      const lng = sosStatus?.lng || 120.9749;
      const map = window.L.map(mapRef.current).setView([lat, lng], 15);

      // CARTO Voyager tiles — warm, professional look matching Manus reference
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Pulsing RED location pin — citizen dot (matches dispatch view RED color)
      const pulseIcon = window.L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:44px;height:44px;">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:rgba(230,57,70,0.15);animation:sosPulse 1.6s ease-out infinite;"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:rgba(230,57,70,0.28);animation:sosPulse 1.6s ease-out infinite 0.4s;"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#E63946;border:3px solid #fff;box-shadow:0 2px 10px rgba(230,57,70,0.7);"></div>
          </div>
          <style>
            @keyframes sosPulse {
              0% { transform: translate(-50%,-50%) scale(0.4); opacity: 1; }
              100% { transform: translate(-50%,-50%) scale(2); opacity: 0; }
            }
          </style>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = window.L.marker([lat, lng], { icon: pulseIcon }).addTo(map);

      mapInstance.current = map;
      markerRef.current = marker;
    };
    loadMap();
  }, [sosStatus, user]);

  const handleCancel = async () => {
    if (!cancelReason) {
      setError('Please select a reason');
      return;
    }
    setLoading(true);
    try {
      await citizenApi.cancelSos(cancelReason);
      localStorage.removeItem('active_sos_id');
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Failed to cancel SOS');
      setLoading(false);
    }
  };

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m  ${secs}s`;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ACTIVE': return '#ff6b6b';
      case 'ACKNOWLEDGED': return '#4ade80';
      case 'EN_ROUTE': return '#60a5fa';
      case 'ON_SCENE': return '#f97316';
      case 'CANCELLED': return '#888';
      default: return '#888';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'ACTIVE': return 'Waiting for Response';
      case 'ACKNOWLEDGED': return 'Officer Assigned';
      case 'EN_ROUTE': return 'Officer En Route';
      case 'ON_SCENE': return 'Officer On Scene';
      case 'CANCELLED': return 'Cancelled';
      default: return status || 'PENDING';
    }
  };

  const getStatusMessage = (status?: string, officerName?: string) => {
    const name = officerName || 'An officer';
    switch (status) {
      case 'ACTIVE': return 'Your alert has been received. Dispatch is reviewing.';
      case 'ACKNOWLEDGED': return `${name} has been assigned and is responding.`;
      case 'EN_ROUTE': return `${name} is on the way to your location.`;
      case 'ON_SCENE': return `${name} has arrived at your location.`;
      default: return 'Stay calm and stay where you are.';
    }
  };

  return (
    <div style={{ background: 'var(--citizen-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: 88 }}>
      {/* "HELP IS ON THE WAY" Header */}
      <div style={{
        background: 'linear-gradient(180deg, #2d0a0a 0%, #1a1a2e 100%)',
        padding: '20px 20px 16px',
        textAlign: 'center',
        borderBottom: '1px solid rgba(255,100,100,0.2)',
      }}>
        <span style={{ fontSize: 28 }}>🚨</span>
        <h1 style={{
          color: '#fff', fontSize: 18, fontWeight: 900, margin: '6px 0 0 0',
          letterSpacing: 1.5, textTransform: 'uppercase',
        }}>
          HELP IS ON THE WAY
        </h1>
      </div>

      {/* Elapsed Time + Status */}
      <div style={{
        padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <p style={{ color: '#888', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>ELAPSED TIME</p>
          <p style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {formatElapsed(elapsedTime)}
          </p>
        </div>
        <div style={{
          background: `${getStatusColor(sosStatus?.status)}22`,
          border: `1px solid ${getStatusColor(sosStatus?.status)}66`,
          borderRadius: 8, padding: '4px 12px',
        }}>
          <p style={{ color: getStatusColor(sosStatus?.status), fontSize: 12, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>
            {getStatusLabel(sosStatus?.status)}
          </p>
        </div>
      </div>

      {/* Officer Assignment Card — visible once officer is assigned */}
      {sosStatus?.officer_name && (
        <div style={{
          margin: '12px 20px 0', padding: '14px 16px',
          background: `${getStatusColor(sosStatus.status)}11`,
          border: `1px solid ${getStatusColor(sosStatus.status)}44`,
          borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: getStatusColor(sosStatus.status),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            {sosStatus.status === 'ON_SCENE' ? '🚔' : '👮'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>{sosStatus.officer_name}</p>
            {sosStatus.officer_badge && (
              <p style={{ color: '#aaa', fontSize: 11, margin: '2px 0 4px' }}>Badge: {sosStatus.officer_badge}</p>
            )}
            <p style={{ color: getStatusColor(sosStatus.status), fontSize: 12, fontWeight: 600, margin: 0 }}>
              {getStatusMessage(sosStatus.status, sosStatus.officer_name)}
            </p>
          </div>
        </div>
      )}

      {/* GPS Warning */}
      {!gpsAvailable && (
        <div style={{ padding: '8px 20px', background: 'rgba(250,193,21,0.1)', borderBottom: '1px solid rgba(250,193,21,0.2)' }}>
          <p style={{ color: '#facc15', fontSize: 12, margin: 0, fontWeight: 600 }}>
            ⚠️ GPS Unavailable
          </p>
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 20px', background: 'rgba(230,57,70,0.15)' }}>
          <p style={{ color: '#ff6b6b', fontSize: 12, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} style={{
        flex: 1, minHeight: 240,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }} />



      {/* Map legend */}
      {(sosStatus?.status === 'EN_ROUTE' || sosStatus?.status === 'ON_SCENE') && (
        <div style={{ padding: '8px 20px', background: 'rgba(59,130,246,0.08)', borderBottom: '1px solid rgba(59,130,246,0.2)', display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 11, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#e63946' }} /> Your location</span>
          <span style={{ fontSize: 11, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} /> Officer location</span>
        </div>
      )}

      {/* Location + Accuracy */}
      {sosStatus?.lat && (
        <div style={{
          padding: '12px 20px', display: 'flex', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <p style={{ color: '#888', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>YOUR LOCATION</p>
            <p style={{ color: '#ccc', fontSize: 13, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
              {Number(sosStatus.lat).toFixed(4)}, {Number(sosStatus.lng).toFixed(4)}
            </p>
          </div>
          {sosStatus.location_accuracy && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#888', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>ACCURACY</p>
              <p style={{ color: '#ccc', fontSize: 13, margin: 0 }}>±{Math.round(sosStatus.location_accuracy)}m</p>
            </div>
          )}
        </div>
      )}

      {/* Safety Tips — context-aware */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(sosStatus?.status === 'ON_SCENE'
          ? ['Officer is at your location — approach them safely', 'Keep your phone visible and accessible', 'Follow officer instructions']
          : sosStatus?.status === 'EN_ROUTE'
          ? ['Stay where you are — officer is coming to you', 'Keep your phone on and charged', 'Answer any incoming calls from police']
          : ['Stay calm and stay where you are', 'Keep your phone on and charged', 'Answer calls from police officers']
        ).map((tip, i) => (
          <p key={i} style={{ color: '#aaa', fontSize: 13, margin: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#4ade80', flexShrink: 0 }}>✓</span> {tip}
          </p>
        ))}
      </div>

      {/* Strike Warning */}
      {sosStatus?.citizen_strikes >= 2 && (
        <div style={{ padding: '10px 20px', background: 'rgba(230,57,70,0.15)', borderBottom: '1px solid rgba(230,57,70,0.25)' }}>
          <p style={{ color: '#ff6b6b', fontSize: 12, margin: 0, fontWeight: 600 }}>
            ⚠️ Strike {sosStatus.citizen_strikes}/3 — One more false alarm will suspend your account
          </p>
        </div>
      )}

      {/* I'm Safe Now — fixed to bottom, always visible, never requires scrolling */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 20px 28px',
        background: 'linear-gradient(to top, rgba(13,13,20,0.98) 80%, transparent)',
        zIndex: 40,
      }}>
        <button
          onClick={() => setShowCancelModal(true)}
          disabled={loading || sosStatus?.status === 'CANCELLED'}
          style={{
            width: '100%', padding: '16px', borderRadius: 14,
            background: sosStatus?.status === 'CANCELLED'
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(74,222,128,0.12)',
            border: '1.5px solid ' + (sosStatus?.status === 'CANCELLED' ? 'rgba(255,255,255,0.1)' : 'rgba(74,222,128,0.4)'),
            color: sosStatus?.status === 'CANCELLED' ? '#555' : '#4ade80',
            fontSize: 16, fontWeight: 700,
            cursor: loading || sosStatus?.status === 'CANCELLED' ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            letterSpacing: 0.5,
          }}
        >
          {sosStatus?.status === 'CANCELLED' ? 'SOS Cancelled' : '✅  I\'m Safe Now'}
        </button>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 50
        }}
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6"
            style={{
              background: 'var(--citizen-bg)',
              border: '1px solid rgba(255,255,255,0.1)',
              maxHeight: '70vh', overflow: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 8px 0' }}>Why are you cancelling?</h2>
            <p style={{ color: '#888', fontSize: 12, margin: '0 0 16px 0' }}>False alarms result in strikes on your account.</p>
            <div className="flex flex-col gap-3 mb-6">
              {['Accidental', 'Already Resolved', 'False Alarm', 'Other'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setCancelReason(reason)}
                  style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: cancelReason === reason ? 'var(--sos-red)' : 'rgba(255,255,255,0.07)',
                    border: '1px solid ' + (cancelReason === reason ? 'var(--sos-red)' : 'rgba(255,255,255,0.15)'),
                    color: '#fff', fontSize: 14, cursor: 'pointer',
                    fontWeight: cancelReason === reason ? 600 : 400,
                    transition: 'all 0.2s',
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={handleCancel}
              disabled={!cancelReason || loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                background: cancelReason && !loading ? 'var(--sos-red)' : '#555',
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: !cancelReason || loading ? 'not-allowed' : 'pointer',
                marginBottom: 8,
              }}
            >
              {loading ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
            <button
              onClick={() => setShowCancelModal(false)}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Keep SOS Active
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
