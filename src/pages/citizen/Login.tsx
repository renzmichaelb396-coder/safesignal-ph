import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useCitizenAuth } from '../../hooks/useCitizenAuth';

export default function Login() {
  const [, navigate] = useLocation();
  const { login } = useCitizenAuth();
  const [phone, setPhone] = useState('09171234567');
  const [pin, setPin] = useState('1234');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^09\d{9}$/.test(phone)) {
      setError('Phone must be 11 digits starting with 09');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);
    try {
      await login(phone, pin);
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12,
    color: '#fff',
    padding: '12px 16px',
    width: '100%',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  // Auto-login with demo credentials for instant demo access
  useEffect(() => {
    if (phone && pin && phone.length === 11 && pin.length === 4) {
      const timer = setTimeout(() => {
        handleSubmit({ preventDefault: () => {} } as React.FormEvent);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="citizen-container px-5 py-6 flex flex-col items-center justify-between min-h-screen" style={{ background: 'var(--citizen-bg)' }}>
      <div className="w-full">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <button style={{ color: '#aaa', background: 'none', border: 'none', fontSize: 20 }}>←</button>
          </Link>
          <div>
            <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Welcome Back</h1>
            <p style={{ color: '#888', fontSize: 12, margin: 0 }}>Login to your SafeSignal account</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-4 rounded-xl mb-8" style={{ background: 'rgba(0,56,168,0.2)', border: '1px solid rgba(0,56,168,0.4)' }}>
          <p style={{ color: '#4da6ff', fontSize: 12, margin: '0 0 8px 0', fontWeight: 600 }}>Demo Mode</p>
          <p style={{ color: '#ccc', fontSize: 11, margin: '0 0 4px 0' }}>Phone: <strong>09171234567</strong></p>
          <p style={{ color: '#ccc', fontSize: 11, margin: 0 }}>PIN: <strong>1234</strong></p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>
              Phone Number *
            </label>
            <input
              style={inputStyle}
              placeholder="09171234567"
              value={phone}
              maxLength={11}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>
              4-Digit PIN *
            </label>
            <input
              type="password"
              style={inputStyle}
              placeholder="••••"
              value={pin}
              maxLength={4}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(230,57,70,0.2)', color: '#ff6b6b' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg mt-2"
            style={{ background: loading ? '#555' : 'var(--sos-red)', boxShadow: '0 4px 20px rgba(230,57,70,0.3)', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <p className="text-center text-sm" style={{ color: '#888' }}>
            Don't have an account?{' '}
            <Link href="/register"><span style={{ color: 'var(--ph-gold)' }}>Register</span></Link>
          </p>
        </form>
      </div>

      <p style={{ color: '#666', fontSize: 11, textAlign: 'center' }}>
        Your account is secured with PIN verification
      </p>
    </div>
  );
}
