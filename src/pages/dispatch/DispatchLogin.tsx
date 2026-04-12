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
  const { login, logout, officer } = useDispatchAuth();

  // Bridge ALL dispatch sessions — DispatchAuthContext only writes dispatch_* keys (BUG-007).
  // All dispatchApi calls read from safesignal_officer_token (getToken('officer')).
  // OfficerDashboard also reads safesignal_officer_* keys.
  // This bridge runs for every role (DISPATCHER, OFFICER, STATION_ADMIN) so API calls work.
  React.useEffect(() => {
    if (officer) {
      const token = localStorage.getItem('dispatch_token');
      if (token) {
        localStorage.setItem('safesignal_officer_token', token);
        localStorage.setItem('safesignal_officer_data', JSON.stringify(officer));
      }
    }
  }, [officer]);

  const bridgeKeysIfNeeded = () => {
    // Called just before any dashboard navigation — ensures safesignal_officer_token
    // is always in sync with dispatch_token so API calls don't fail with "No token".
    const token = localStorage.getItem('dispatch_token');
    const userData = localStorage.getItem('dispatch_user');
    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        localStorage.setItem('safesignal_officer_token', token);
        localStorage.setItem('safesignal_officer_data', JSON.stringify(user));
      } catch { /* ignore parse errors */ }
    }
  };

  const routeByRole = (role: string) => {
    bridgeKeysIfNeeded(); // always sync before navigating
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
      const storedToken = localStorage.getItem('dispatch_token');
      const user = storedUser ? JSON.parse(storedUser) : null;

      // OFFICER role uses OfficerDashboard which checks safesignal_officer_* keys.
      // DispatchAuthContext only writes dispatch_* keys (BUG-007), so we bridge
      // the key gap here at the routing layer — copy the session into officer keys.
      if (user?.role === 'OFFICER' && storedToken) {
        localStorage.setItem('safesignal_officer_token', storedToken);
        localStorage.setItem('safesignal_officer_data', JSON.stringify(user));
      }

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

  const roleLabel = (role: string) => {
    if (role === 'OFFICER') return 'Field Officer';
    if (role === 'STATION_ADMIN') return 'Station Admin';
    return 'Dispatcher';
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Active session banner — shown only when someone is already logged in */}
        {officer && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            backgroundColor: 'rgba(255,193,7,0.08)',
            border: '1px solid rgba(255,193,7,0.35)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#ffc107', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                Active Session
              </div>
              <div style={{ fontSize: '13px', color: '#e6edf3' }}>
                {officer.full_name} · <span style={{ color: '#8b949e' }}>{roleLabel(officer.role)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={() => routeByRole(officer.role)}
                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#0d1117', backgroundColor: '#ffc107', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => logout()}
                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#f85149', backgroundColor: 'transparent', border: '1px solid #f85149', borderRadius: '5px', cursor: 'pointer' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '40px 32px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
              <img
                src="/pasay-police-badge.svg"
                alt="Pasay City Police"
                style={{ width: '96px', height: 'auto', filter: 'drop-shadow(0 4px 12px rgba(245,158,11,0.4))' }}
              />
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#ffc107', margin: '0 0 8px 0', textAlign: 'center', lineHeight: 1.2 }}>Pasay City Emergency Response</h1>
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
                placeholder="••••••••"
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
              style={{ width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#ffc107', backgroundColor: 'transparent', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px', textAlign: 'left' }}
            >
              🟡 Dispatcher — Maria Lopez / PNP-001
            </button>
            <button
              type="button"
              onClick={fillOfficerCredentials}
              style={{ width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#3fb950', backgroundColor: 'transparent', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px', textAlign: 'left' }}
            >
              🟢 Field Officer — Carlos Mendoza / PNP-002
            </button>
            <button
              type="button"
              onClick={fillAdminCredentials}
              style={{ width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#58a6ff', backgroundColor: 'transparent', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer', textAlign: 'left' }}
            >
              🔵 Station Admin — Chief Antonio Reyes / PNP-ADM
            </button>
          </div>

          <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: '#8b949e' }}>
            Pasay City Emergency Response v1.0 — Authorized Personnel Only
          </p>
        </div>

        {/* Register link */}
        <p style={{ marginTop: '12px', textAlign: 'center', fontSize: '12px', color: '#8b949e' }}>
          New personnel?{' '}
          <a href="/dispatch/register" style={{ color: '#ffc107', textDecoration: 'none', fontWeight: 600 }}>Register here</a>
        </p>

        {/* Back to citizen app */}
        <p style={{ marginTop: '8px', textAlign: 'center', fontSize: '12px', color: '#8b949e' }}>
          <a href="/" style={{ color: '#8b949e', textDecoration: 'none' }}>← Back to Citizen App</a>
        </p>
      </div>
    </div>
  );
}
