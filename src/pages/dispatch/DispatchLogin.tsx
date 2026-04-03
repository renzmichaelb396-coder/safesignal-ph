import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';

export default function DispatchLogin() {
  const [email, setEmail] = useState('dispatcher@pasay.safesignal.ph');
  const [password, setPassword] = useState('password123');
  const [badgeNumber, setBadgeNumber] = useState('PNP-001');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { login } = useDispatchAuth();

  const routeByRole = (role: string) => {
    if (role === 'OFFICER') {
      navigate('/officer');
    } else if (role === 'STATION_ADMIN') {
      navigate('/dispatch/metrics');
    } else {
      navigate('/dispatch');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, badgeNumber);
      const storedUser = localStorage.getItem('dispatch_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      routeByRole(user?.role || 'DISPATCHER');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDispatcherCredentials = () => {
    setEmail('dispatcher@pasay.safesignal.ph');
    setPassword('password123');
    setBadgeNumber('PNP-001');
  };

  const fillOfficerCredentials = () => {
    setEmail('officer@pasay.safesignal.ph');
    setPassword('password123');
    setBadgeNumber('PNP-002');
  };

  const fillAdminCredentials = () => {
    setEmail('admin@pasay.safesignal.ph');
    setPassword('password123');
    setBadgeNumber('PNP-ADM');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '40px 32px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <img
              src="/pasay-police-badge.svg"
              alt="Pasay City Police"
              style={{ width: '96px', height: 'auto', filter: 'drop-shadow(0 4px 12px rgba(245,158,11,0.4))' }}
            />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#ffc107', margin: '0 0 8px 0' }}>RespondPH</h1>
          <p style={{ fontSize: '14px', color: '#8b949e', margin: 0 }}>Police Dispatch Console</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c9d1d9', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="dispatcher@pasay.safesignal.ph"
              required
              style={{ width: '100%', padding: '10px 12px', fontSize: '14px', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#ffc107'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#30363d'; }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c9d1d9', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Badge Number
            </label>
            <input
              type="text"
              value={badgeNumber}
              onChange={e => setBadgeNumber(e.target.value)}
              placeholder="PNP-001"
              required
              style={{ width: '100%', padding: '10px 12px', fontSize: '14px', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#ffc107'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#30363d'; }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c9d1d9', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
              required
              style={{ width: '100%', padding: '10px 12px', fontSize: '14px', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#ffc107'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#30363d'; }}
            />
          </div>

          {error && (
            <div style={{ padding: '12px', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '6px', fontSize: '13px', color: '#f85149' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ padding: '12px', fontSize: '14px', fontWeight: 600, color: '#0d1117', backgroundColor: '#ffc107', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #30363d' }}>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 10px 0', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
            Demo Credentials
          </p>
          <button
            type="button"
            onClick={fillDispatcherCredentials}
            style={{ width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#ffc107', backgroundColor: 'transparent', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px' }}
          >
            Dispatcher (Maria Lopez / PNP-001)
          </button>
          <button
            type="button"
            onClick={fillOfficerCredentials}
            style={{ width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#3fb950', backgroundColor: 'transparent', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px' }}
          >
            Officer (Carlos Mendoza / PNP-002)
          </button>
          <button
            type="button"
            onClick={fillAdminCredentials}
            style={{ width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#58a6ff', backgroundColor: 'transparent', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer' }}
          >
            Admin (Chief Antonio Reyes / PNP-ADM)
          </button>
        </div>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: '#8b949e' }}>
          RespondPH v1.0 \u2014 Authorized Personnel Only
        </p>
      </div>
    </div>
  );
}
