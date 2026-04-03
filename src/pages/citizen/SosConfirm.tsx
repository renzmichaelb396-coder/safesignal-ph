import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useCitizenAuth } from '../../hooks/useCitizenAuth';
import { citizenApi } from '../../lib/api';

export default function SosConfirm() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useCitizenAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [showCountdown, setShowCountdown] = useState(false);
  const [geoError, setGeoError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

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
        error => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleNumpadClick = (digit: string) => {
    if (pin.length < 4) setPin(pin + digit);
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

    const sendSos = async (lat: number, lng: number, accuracy: number) => {
      const data = await citizenApi.sendSos({ pin, lat, lng, accuracy });
      localStorage.setItem('active_sos_id', String((data as any).alert?.id || (data as any).sos_id || ''));
      setShowCountdown(true);
    };

    try {
      const location = await getLocation();
      await sendSos(location.lat, location.lng, location.accuracy);
    } catch (err: any) {
      if (err.code === 1 || err.code === 3) {
        const msg = err.code === 1 ? 'Location permission denied.' : 'Location request timed out.';
        setGeoError(msg + ' Using fallback coordinates.');
        try {
          await sendSos(14.5794, 120.9749, 5000);
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

  if (showCountdown) {
    return (
      <div
        className="citizen-container flex flex-col items-center justify-center min-h-screen"
        style={{ background: '#3d0a0a' }}
      >
        <div className="flex flex-col items-center gap-6 px-6">
          <div style={{ fontSize: 48 }}>🚨</div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0, textAlign: 'center' }}>
            SOS Sent
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', margin: 0 }}>
            Police are on their way. Stay on the line.
          </p>
          <div style={{ position: 'relative', width: 140, height: 140 }}>
            <svg style={{ position: 'absolute', inset: 0, width: 140, height: 140, transform: 'rotate(-90deg)' }}>
              <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
              <circle
                cx="70" cy="70" r="60"
                fill="none"
                stroke="#ff6b6b"
                strokeWidth="8"
                strokeDasharray={`${(1 - countdown / 5) * 376.99} 376.99`}
                style={{ transition: 'stroke-dasharray 1s linear' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#ffc107', fontSize: 48, fontWeight: 800, margin: 0 }}>{countdown}</p>
            </div>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' }}>
            Redirecting in {countdown}s...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="citizen-container flex flex-col items-center justify-between min-h-screen"
      style={{ background: '#3d0a0a', padding: '40px 24px 32px' }}
    >
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-3 w-full">
        <span style={{ fontSize: 40 }}>⚠️</span>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: 1, textTransform: 'uppercase' }}>
          ARE YOU IN DANGER?
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0 }}>
          Enter your PIN to confirm emergency
        </p>

        {geoError && (
          <div className="w-full p-3 rounded-xl text-sm mt-2" style={{ background: 'rgba(250,193,21,0.2)', color: '#facc15' }}>
            {geoError}
          </div>
        )}
        {error && (
          <div className="w-full p-3 rounded-xl text-sm mt-2" style={{ background: 'rgba(255,107,107,0.2)', color: '#ff6b6b' }}>
            {error}
          </div>
        )}

        {/* PIN Dots */}
        <div className="flex gap-4 justify-center mt-4">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.5)',
                background: pin[i] ? 'rgba(255,255,255,0.9)' : 'transparent',
                transition: 'background 0.15s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Numpad */}
      <div className="w-full" style={{ maxWidth: 320 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          {['1','2','3','4','5','6','7','8','9'].map(digit => (
            <button
              key={digit}
              onClick={() => handleNumpadClick(digit)}
              disabled={loading || pin.length >= 4}
              style={{
                padding: '18px 0',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#fff',
                fontSize: 20,
                fontWeight: 700,
                cursor: loading || pin.length >= 4 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {digit}
            </button>
          ))}
          {/* Bottom row: blank, 0, backspace */}
          <div />
          <button
            onClick={() => handleNumpadClick('0')}
            disabled={loading || pin.length >= 4}
            style={{
              padding: '18px 0',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff',
              fontSize: 20,
              fontWeight: 700,
              cursor: loading || pin.length >= 4 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            style={{
              padding: '18px 0',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff',
              fontSize: 18,
              cursor: loading || pin.length === 0 ? 'not-allowed' : 'pointer',
              opacity: pin.length === 0 ? 0.4 : 1,
              transition: 'all 0.15s',
            }}
          >
            ⌫
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || pin.length !== 4}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 12,
            background: pin.length === 4 && !loading ? 'rgba(200,30,30,0.9)' : 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: loading || pin.length !== 4 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            marginTop: 4,
          }}
        >
          {loading ? 'Sending SOS...' : 'Confirm PIN'}
        </button>
      </div>

      {/* Cancel link */}
      <button
        onClick={() => navigate('/home')}
        disabled={loading}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.55)',
          fontSize: 13,
          cursor: 'pointer',
          padding: '8px 0',
        }}
      >
        Cancel — I'm Safe
      </button>
    </div>
  );
}
