import React, { useState, useRef } from 'react';
import { Link, useLocation } from 'wouter';

type Step = 'phone' | 'otp' | 'newpin' | 'done';

export default function ForgotPin() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [citizenId, setCitizenId] = useState<number | null>(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const inputStyle = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12,
    color: '#fff',
    padding: '12px 16px',
    width: '100%',
    fontSize: 14,
    outline: 'none',
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^09\d{9}$/.test(phone)) { setError('Phone must be 11 digits starting with 09'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/citizen/forgot-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send OTP'); return; }
      setCitizenId(data.citizen_id);
      setStep('otp');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d)) setStep('newpin');
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(newPin)) { setError('PIN must be exactly 4 digits'); return; }
    if (newPin !== confirmPin) { setError('PINs do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/citizen/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citizen_id: citizenId, otp: otp.join(''), new_pin: newPin }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to reset PIN'); return; }
      setStep('done');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="citizen-container px-5 py-6 flex flex-col min-h-screen" style={{ background: 'var(--citizen-bg)' }}>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/login">
          <button style={{ color: '#aaa', background: 'none', border: 'none', fontSize: 20 }}>←</button>
        </Link>
        <div>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Reset PIN</h1>
          <p style={{ color: '#888', fontSize: 12, margin: 0 }}>
            {step === 'phone' ? 'Enter your registered phone number'
              : step === 'otp' ? 'Enter the 6-digit code sent to your phone'
              : step === 'newpin' ? 'Set your new 4-digit PIN'
              : 'PIN reset complete'}
          </p>
        </div>
      </div>

      {step === 'phone' && (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
          <div>
            <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>Phone Number</label>
            <input style={inputStyle} placeholder="09171234567" value={phone} maxLength={11}
              inputMode="numeric" pattern="[0-9]*"
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} required />
          </div>
          {error && <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(230,57,70,0.2)', color: '#ff6b6b' }}>{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg"
            style={{ background: loading ? '#555' : 'var(--sos-red)' }}>
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <div className="flex flex-col gap-6">
          <p style={{ color: '#888', fontSize: 13, textAlign: 'center' }}>
            OTP sent to <strong style={{ color: '#fff' }}>{phone}</strong>
          </p>
          <div className="flex gap-2 justify-center">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                autoFocus={i === 0}
                style={{
                  width: 48, height: 56, fontSize: 24, fontWeight: 'bold',
                  textAlign: 'center',
                  border: '2px solid rgba(255,255,255,0.2)', borderRadius: 12,
                  background: 'rgba(255,255,255,0.07)', color: '#fff', outline: 'none',
                }}
              />
            ))}
          </div>
          {error && <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(230,57,70,0.2)', color: '#ff6b6b' }}>{error}</div>}
        </div>
      )}

      {step === 'newpin' && (
        <form onSubmit={handleResetPin} className="flex flex-col gap-4">
          <div>
            <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>New 4-Digit PIN</label>
            <input style={inputStyle} type="password" placeholder="••••" maxLength={4} value={newPin}
              inputMode="numeric"
              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} required />
          </div>
          <div>
            <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>Confirm New PIN</label>
            <input style={inputStyle} type="password" placeholder="••••" maxLength={4} value={confirmPin}
              inputMode="numeric"
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} required />
          </div>
          {error && <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(230,57,70,0.2)', color: '#ff6b6b' }}>{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg"
            style={{ background: loading ? '#555' : 'var(--sos-red)' }}>
            {loading ? 'Resetting...' : 'Reset PIN'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center gap-6 mt-8">
          <div style={{ fontSize: 64 }}>✅</div>
          <h2 style={{ color: '#4ade80', fontSize: 22, fontWeight: 700, textAlign: 'center', margin: 0 }}>PIN Reset Successful</h2>
          <p style={{ color: '#888', fontSize: 14, textAlign: 'center' }}>You can now log in with your new PIN.</p>
          <button onClick={() => navigate('/login')}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg"
            style={{ background: 'var(--sos-red)' }}>
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
}
