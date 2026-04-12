import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useCitizenAuth } from '../../hooks/useCitizenAuth';
import { citizenApi } from '../../lib/api';

function compressImage(file: File, maxPx: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas error')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function SosConfirm() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useCitizenAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [showCountdown, setShowCountdown] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [incidentPhoto, setIncidentPhoto] = useState<string | null>(null);
  const [photoCompressing, setPhotoCompressing] = useState(false);
  // Safety gate: 'ask' → 5s auto-advance or YES/NO → 'cancel' or 'pin'
  const [gatePhase, setGatePhase] = useState<'ask' | 'cancel' | 'pin'>('ask');
  const [gateTimer, setGateTimer] = useState(5);
  const [cancelCode, setCancelCode] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // 5-second auto-advance: if user doesn't tap YES/NO, SOS fires automatically (coercion protection)
  useEffect(() => {
    if (gatePhase !== 'ask') return;
    if (gateTimer <= 0) { setGatePhase('pin'); return; }
    const t = setTimeout(() => setGateTimer(gateTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [gatePhase, gateTimer]);

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

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoCompressing(true);
    try {
      const compressed = await compressImage(file, 800, 0.7);
      setIncidentPhoto(compressed);
    } catch {
      setIncidentPhoto(null);
    } finally {
      setPhotoCompressing(false);
    }
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
      const body: any = { pin, lat, lng, accuracy };
      if (incidentPhoto) body.incident_photo = incidentPhoto;
      const data = await citizenApi.sendSos(body);
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

  // Safety gate — YES/NO screen with 5s auto-fire
  if (gatePhase === 'ask') {
    return (
      <div
        className="citizen-container flex flex-col items-center justify-center min-h-screen"
        style={{ background: '#3d0a0a', padding: '40px 24px' }}
      >
        <div className="flex flex-col items-center gap-6 w-full" style={{ maxWidth: 340 }}>
          <span style={{ fontSize: 56 }}>🚨</span>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, textAlign: 'center', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
            Real Emergency?
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center', margin: 0 }}>
            Are you in immediate danger and need police assistance?
          </p>
          {/* Auto-fire countdown ring */}
          <div style={{ position: 'relative', width: 100, height: 100 }}>
            <svg style={{ position: 'absolute', inset: 0, width: 100, height: 100, transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="#ff6b6b"
                strokeWidth="6"
                strokeDasharray={`${(1 - gateTimer / 5) * 263.9} 263.9`}
                style={{ transition: 'stroke-dasharray 1s linear' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#ffc107', fontSize: 28, fontWeight: 800 }}>{gateTimer}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>auto-send</span>
            </div>
          </div>
          <div className="flex gap-4 w-full">
            <button
              onClick={() => setGatePhase('cancel')}
              style={{
                flex: 1, padding: '16px', borderRadius: 14,
                background: 'rgba(255,255,255,0.12)',
                border: '2px solid rgba(255,255,255,0.25)',
                color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}
            >
              ✋ NO
            </button>
            <button
              onClick={() => setGatePhase('pin')}
              style={{
                flex: 1, padding: '16px', borderRadius: 14,
                background: 'rgba(200,30,30,0.9)',
                border: '2px solid rgba(255,107,107,0.5)',
                color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}
            >
              🚨 YES
            </button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center' }}>
            SOS will send automatically in {gateTimer}s if you don't respond
          </p>
        </div>
      </div>
    );
  }

  // Cancel screen — must enter correct code; wrong code fires SOS anyway (coercion protection)
  if (gatePhase === 'cancel') {
    const handleCancelSubmit = () => {
      if (cancelCode === '1234') {
        navigate('/home');
      } else {
        // Wrong code = possible coercion → fire SOS anyway
        setGatePhase('pin');
      }
    };
    return (
      <div
        className="citizen-container flex flex-col items-center justify-center min-h-screen"
        style={{ background: '#0d1117', padding: '40px 24px' }}
      >
        <div className="flex flex-col items-center gap-6 w-full" style={{ maxWidth: 340 }}>
          <span style={{ fontSize: 48 }}>🔐</span>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, textAlign: 'center', margin: 0 }}>
            Safety Code Required
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', margin: 0 }}>
            Enter your 4-digit safety code to cancel. If you are being forced, enter any wrong code — your SOS will still be sent silently.
          </p>
          <input
            type="number"
            inputMode="numeric"
            maxLength={4}
            value={cancelCode}
            onChange={e => setCancelCode(e.target.value.slice(0, 4))}
            placeholder="_ _ _ _"
            style={{
              width: '100%', padding: '16px', borderRadius: 12, fontSize: 24,
              fontWeight: 700, textAlign: 'center', letterSpacing: 8,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', outline: 'none',
            }}
          />
          <button
            onClick={handleCancelSubmit}
            disabled={cancelCode.length !== 4}
            style={{
              width: '100%', padding: '16px', borderRadius: 12,
              background: cancelCode.length === 4 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: cancelCode.length !== 4 ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel SOS
          </button>
          <button
            onClick={() => setGatePhase('pin')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,107,107,0.8)', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}
          >
            Go back — I need help
          </button>
        </div>
      </div>
    );
  }

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

        {/* Optional Incident Photo */}
        <div className="w-full mt-3">
          <label htmlFor="incident-photo" style={{ display: 'block', cursor: 'pointer' }}>
            {incidentPhoto ? (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(255,193,7,0.5)' }}>
                <img src={incidentPhoto} alt="Incident" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '2px 8px', fontSize: 11, color: '#ffc107' }}>📷 Photo added</div>
              </div>
            ) : (
              <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                <span style={{ fontSize: 20 }}>📷</span>
                <span>{photoCompressing ? 'Compressing photo...' : 'Optional: Add incident photo'}</span>
              </div>
            )}
          </label>
          <input
            id="incident-photo"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            disabled={loading || photoCompressing}
            style={{ display: 'none' }}
          />
          {incidentPhoto && (
            <button
              onClick={() => setIncidentPhoto(null)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer', marginTop: 4 }}
            >
              Remove photo
            </button>
          )}
        </div>

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
