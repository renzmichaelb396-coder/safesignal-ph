import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useCitizenAuth } from '../../hooks/useCitizenAuth';
import { citizenApi } from '../../lib/api';

export default function SosConfirm() {
  const [, navigate] = useLocation();
  const { user } = useCitizenAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [showCountdown, setShowCountdown] = useState(false);
  const [geoError, setGeoError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (countdown === 0 && showCountdown) {
      navigate('/sos/active');
    }
  }, [countdown, showCountdown, navigate]);

  const getLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        error => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleNumpadClick = (digit: string) => {
    if (pin.length < 4) {
      setPin(pin + digit);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    setError('');
    setLoading(true);
    setGeoError('');

    try {
      const location = await getLocation();

      const data = await citizenApi.sendSos({
        pin,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      });

      localStorage.setItem('active_sos_id', String((data as any).alert?.id || (data as any).sos_id || ''));
      setShowCountdown(true);
    } catch (err: any) {
      if (err.code === 1) {
        setGeoError('Location permission denied. Using fallback coordinates.');
        try {
          const data = await citizenApi.sendSos({
            pin,
            lat: 14.5794,
            lng: 120.9749,
            accuracy: 5000,
          });
          localStorage.setItem('active_sos_id', String((data as any).alert?.id || (data as any).sos_id || ''));
          setShowCountdown(true);
        } catch (fallbackErr: any) {
          setError(fallbackErr.message || 'SOS submission failed');
        }
      } else if (err.code === 3) {
        setGeoError('Location request timed out. Using fallback coordinates.');
        try {
          const data = await citizenApi.sendSos({
            pin,
            lat: 14.5794,
            lng: 120.9749,
            accuracy: 5000,
          });
          localStorage.setItem('active_sos_id', String((data as any).alert?.id || (data as any).sos_id || ''));
          setShowCountdown(true);
        } catch (fallbackErr: any) {
          setError(fallbackErr.message || 'SOS submission failed');
        }
      } else {
        setError(err.message || 'Failed to send SOS');
      }
    } finally {
      setLoading(false);
    }
  };

  const numpadButtons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  if (showCountdown) {
    return (
      <div className="citizen-container px-5 py-6 flex flex-col items-center justify-center min-h-screen" style={{ background: 'var(--citizen-bg)' }}>
        <div className="flex flex-col items-center gap-6">
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>
            SOS Sent
          </h1>
          <p style={{ color: '#888', fontSize: 14, textAlign: 'center', margin: 0 }}>
            Police are on their way. Staying on the line...
          </p>

          <div style={{ position: 'relative', width: 140, height: 140 }}>
            <svg style={{ position: 'absolute', inset: 0, width: 140, height: 140, transform: 'rotate(-90deg)' }}>
              <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle
                cx="70"
                cy="70"
                r="60"
                fill="none"
                stroke="var(--sos-red)"
                strokeWidth="8"
                strokeDasharray={`${(1 - countdown / 5) * 376.99} 376.99`}
                style={{ transition: 'stroke-dasharray 1s linear' }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <p style={{ color: 'var(--ph-gold)', fontSize: 48, fontWeight: 800, margin: 0 }}>
                {countdown}
              </p>
            </div>
          </div>

          <p style={{ color: '#888', fontSize: 12, textAlign: 'center' }}>
            Returning to home in {countdown}s...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="citizen-container px-5 py-6 flex flex-col items-center justify-between min-h-screen" style={{ background: 'var(--citizen-bg)' }}>
      <div className="w-full">
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: 0, marginBottom: 4 }}>
          Confirm Emergency
        </h1>
        <p style={{ color: '#888', fontSize: 12, margin: 0, marginBottom: 20 }}>
          Enter your 4-digit PIN to send SOS
        </p>

        {geoError && (
          <div className="p-3 rounded-xl text-sm mb-4" style={{ background: 'rgba(250,193,21,0.2)', color: '#facc15' }}>
            {geoError}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl text-sm mb-4" style={{ background: 'rgba(230,57,70,0.2)', color: '#ff6b6b' }}>
            {error}
          </div>
        )}

        {/* PIN Display */}
        <div className="flex gap-3 justify-center mb-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                width: 48,
                height: 56,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.07)',
                border: '2px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 'bold',
                color: 'var(--sos-red)',
              }}
            >
              {pin[i] ? 'â' : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Numpad */}
      <div className="w-full mb-6">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {numpadButtons.map(btn => (
            btn !== '*' && btn !== '#' && (
              <button
                key={btn}
                onClick={() => handleNumpadClick(btn)}
                disabled={loading || pin.length >= 4}
                style={{
                  padding: '16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontSize: 18,
                  fontWeight: 600,
                  cursor: loading || pin.length >= 4 ? 'not-allowed' : 'pointer',
                  opacity: loading || pin.length >= 4 ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  if (!loading && pin.length < 4) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                }}
              >
                {btn}
              </button>
            )
          ))}
        </div>

        {/* Backspace */}
        <button
          onClick={handleBackspace}
          disabled={loading || pin.length === 0}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading || pin.length === 0 ? 'not-allowed' : 'pointer',
            opacity: loading || pin.length === 0 ? 0.5 : 1,
            transition: 'all 0.2s',
            marginBottom: 12,
          }}
          onMouseEnter={e => {
            if (!loading && pin.length > 0) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
          }}
        >
          â Backspace
        </button>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || pin.length !== 4}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 12,
            background: pin.length === 4 && !loading ? 'var(--sos-red)' : '#555',
            border: 'none',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: loading || pin.length !== 4 ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.2s',
            boxShadow: pin.length === 4 && !loading ? '0 4px 20px rgba(230,57,70,0.4)' : 'none',
          }}
        >
          {loading ? 'Sending SOS...' : 'Send Emergency Alert'}
        </button>
      </div>
    </div>
  );
}
