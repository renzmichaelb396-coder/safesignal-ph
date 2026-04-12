import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useCitizenAuth } from '../../hooks/useCitizenAuth';

export default function Login() {
  const [, navigate] = useLocation();
  const { login, user, loading: authLoading } = useCitizenAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
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

    } catch (err) {
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
    padding: '14px 16px',
    width: '100%',
    fontSize: 15,
    outline: 'none',
  };


  useEffect(() => {
    if (!authLoading && user) {
      navigate('/home');
    }
  }, [user, authLoading, navigate]);

  return (
    <div className="citizen-container flex flex-col items-center justify-between min-h-screen"
      style={{ background: 'var(--citizen-bg)', padding: '48px 20px 24px' }}>
      <div className="flex flex-col items-center w-full">
        <img
          src="/pasay-police-badge.svg"
          alt="Pasay City Police"
          style={{ width: 90, height: 90, objectFit: 'contain', marginBottom: 16 }}
        />
        <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0, textAlign: 'center', lineHeight: 1.2 }}>
          Pasay City Emergency Response
        </h1>
        <p style={{ color: '#999', fontSize: 13, margin: '4px 0 32px', textAlign: 'center' }}>
          Pasay City Police Station
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
          <div>
            <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 6 }}>Phone Number</label>
            <input
              style={inputStyle}
              placeholder="09172345678"
              value={phone}
              maxLength={11}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
              required
              disabled={loading}
            />
          </div>
          <div>
            <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 6 }}>4-Digit PIN</label>
            <input
              type="password"
              style={inputStyle}
              placeholder="\u2022\u2022\u2022\u2022"
              value={pin}
              maxLength={4}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              required
              disabled={loading}
            />
          </div>
          {error && (
            <div className="p-3 rounded-xl text-sm"
              style={{ background: 'rgba(230,57,70,0.2)', color: '#ff6b6b' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg mt-2"
            style={{
              background: loading ? '#555' : '#1a3de0',
              boxShadow: '0 4px 20px rgba(26,61,224,0.4)',
              cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none'
            }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <p className="text-center text-sm" style={{ color: '#888' }}>
            No account?{' '}
            <Link href="/register"><span style={{ color: 'var(--ph-gold)', fontWeight: 600 }}>Register here</span></Link>
          </p>
        </form>
      </div>
      <p style={{ color: '#555', fontSize: 11, textAlign: 'center', margin: 0 }}>
        Pasay City Police Station — Authorized Citizens Only
      </p>
    </div>
  );
}
