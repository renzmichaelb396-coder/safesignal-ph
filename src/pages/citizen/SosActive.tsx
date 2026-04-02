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
  const { user } = useCitizenAuth();
  const [sosStatus, setSosStatus] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const sosIdRef = useRef<string | null>(null);

  const sosId = sosIdRef.current || localStorage.getItem('active_sos_id');

  useEffect(() => {
    if (sosId) {
      sosIdRef.current = sosId;
    }
  }, [sosId]);

  useEffect(() => {
    if (!user) {
      navigate('/home');
    }
  }, [user, navigate]);

  // Fetch SOS status via getActiveAlert
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

  // Timer
  useEffect(() => {
    if (!sosStatus) return;

    const startTime = new Date(sosStatus.created_at).getTime();
    const timer = setInterval(() => {
      const now = new Date().getTime();
      setElapsedTime(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [sosStatus]);

  // Update location every 30 seconds
  useEffect(() => {
    if (!sosId) return;

    const updateLocation = async () => {
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async position => {
              try {
                await citizenApi.updateLocation(
                  position.coords.latitude,
                  position.coords.longitude,
                );

                if (mapInstance.current && markerRef.current) {
                  markerRef.current.setLatLng([
                    position.coords.latitude,
                    position.coords.longitude,
                  ]);
                  mapInstance.current.setView(
                    [position.coords.latitude, position.coords.longitude],
                    15
                  );
                }
              } catch (err) {
                console.error('Failed to update location', err);
              }
            },
            error => {
              console.error('Geolocation error:', error);
            }
          );
        }
      } catch (err) {
        console.error('Location update error:', err);
      }
    };

    updateLocation();
    const interval = setInterval(updateLocation, 30000);
    return () => clearInterval(interval);
  }, [sosId]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !sosStatus || mapInstance.current) return;

    const loadMap = () => {
      if (!window.L) {
        setTimeout(loadMap, 100);
        return;
      }

      const map = window.L.map(mapRef.current).setView(
        [sosStatus.latitude, sosStatus.longitude],
        15
      );

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Â© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = window.L.marker([sosStatus.latitude, sosStatus.longitude], {
        icon: window.L.icon({
          iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red" width="32" height="32"><circle cx="12" cy="12" r="8"/></svg>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      }).addTo(map);

      marker.bindPopup(`<strong>${user?.full_name}</strong><br/>SOS Active`);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return '#ff6b6b';
      case 'ACKNOWLEDGED':
        return '#4ade80';
      case 'ARRIVED':
        return '#60a5fa';
      case 'CANCELLED':
        return '#888';
      default:
        return '#888';
    }
  };

  return (
    <div className="citizen-container px-5 py-6 flex flex-col h-screen" style={{ background: 'var(--citizen-bg)' }}>
      {/* Status Bar */}
      <div className="mb-4 p-4 rounded-xl" style={{ background: `${getStatusColor(sosStatus?.status)}22`, border: `1px solid ${getStatusColor(sosStatus?.status)}44` }}>
        <div className="flex justify-between items-center mb-2">
          <p style={{ color: getStatusColor(sosStatus?.status), fontSize: 12, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>
            {sosStatus?.status || 'PENDING'}
          </p>
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: 0 }}>
            {formatTime(elapsedTime)}
          </p>
        </div>
        <p style={{ color: '#ccc', fontSize: 12, margin: 0 }}>
          {sosStatus?.status === 'ACTIVE' ? 'Waiting for police response...' : ''}
          {sosStatus?.status === 'ACKNOWLEDGED' ? 'Police acknowledged your call' : ''}
          {sosStatus?.status === 'ARRIVED' ? 'Officers have arrived' : ''}
        </p>
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        style={{
          flex: 1,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)',
          marginBottom: 16,
        }}
      />

      {/* Strike Warning */}
      {sosStatus?.citizen_strikes >= 2 && (
        <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(230,57,70,0.2)', border: '1px solid rgba(230,57,70,0.4)' }}>
          <p style={{ color: '#ff6b6b', fontSize: 12, margin: 0, fontWeight: 600 }}>
            â ï¸ Strike {sosStatus.citizen_strikes}/3 - One more false alarm will suspend your account
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(230,57,70,0.2)', color: '#ff6b6b', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Cancel Button */}
      <button
        onClick={() => setShowCancelModal(true)}
        disabled={loading || sosStatus?.status === 'CANCELLED'}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#ff6b6b',
          fontSize: 14,
          fontWeight: 600,
          cursor: loading || sosStatus?.status === 'CANCELLED' ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.5 : 1,
        }}
      >
        {sosStatus?.status === 'CANCELLED' ? 'SOS Cancelled' : 'Cancel SOS'}
      </button>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 50,
          }}
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6"
            style={{
              background: 'var(--citizen-bg)',
              border: '1px solid rgba(255,255,255,0.1)',
              maxHeight: '70vh',
              overflow: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 12px 0' }}>
              Why are you cancelling?
            </h2>
            <p style={{ color: '#888', fontSize: 12, margin: '0 0 16px 0' }}>
              False alarms result in strikes on your account.
            </p>

            <div className="flex flex-col gap-3 mb-6">
              {['Accidental', 'Already Resolved', 'False Alarm', 'Other'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setCancelReason(reason)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: cancelReason === reason ? 'var(--sos-red)' : 'rgba(255,255,255,0.07)',
                    border: '1px solid ' + (cancelReason === reason ? 'var(--sos-red)' : 'rgba(255,255,255,0.15)'),
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer',
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
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                background: cancelReason && !loading ? 'var(--sos-red)' : '#555',
                border: 'none',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
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
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
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
