import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';

export default function DispatchLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { login } = useDispatchAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, badgeNumber);
      // Role-based redirect: read the saved user to determine where to send them
      const storedUser = localStorage.getItem('dispatch_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (user?.role === 'officer') {
        navigate('/dispatch/officer-dashboard');
      } else {
        navigate('/dispatch');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('dispatcher@pasay.safesignal.ph');
    setPassword('password123');
    setBadgeNumber('PNP-001');
  };

  useEffect(() => { fillDemoCredentials(); }, []);

  // Auto-login with demo credentials for instant demo access
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email && password && badgeNumber && !loading) {
        handleSubmit({ preventDefault: () => {} } as React.FormEvent);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [email, password, badgeNumber]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '40px 32px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>🛡️</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#ffc107', margin: '0 0 6px 0', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>RespondPH</h1>
          <p style={{ fontSize: '13px', color: '#8b949e', margin: '0 0 4px 0' }}>Police Dispatch Console</p>
          <p style={{ fontSize: '11px', color: '#30363d', margin: 0 }}>Pasay City Police Station</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c9d1d9', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dispatcher@pasay.safesignal.ph" required
              style={{ width: '100%', padding: '10px 12px', fontSize: '14px', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', boxSizing: 'border-box' as const }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#ffc107'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#30363d'; }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c9d1d9', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Badge Number</label>
            <input type="text" value={badgeNumber} onChange={(e) => setBadgeNumber(e.target.value)} placeholder="PNP-001" required
              style={{ width: '100%', padding: '10px 12px', fontSize: '14px', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', boxSizing: 'border-box' as const }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#ffc107'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#30363d'; }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c9d1d9', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
              style={{ width: '100%', padding: '10px 12px', fontSize: '14px', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', boxSizing: 'border-box' as const }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#ffc107'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#30363d'; }} />
          </div>

          {error && (
            <div style={{ padding: '12px', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '6px', fontSize: '13px', color: '#f85149' }}>{error}</div>
          )}

          <button type="submit" disabled={loading}
            style={{ padding: '12px', fontSize: '14px', fontWeight: 600, color: '#0d1117', backgroundColor: '#ffc107', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Credentials */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #30363d' }}>
          <p style={{ fontSize: '11px', color: '#8b949e', margin: '0 0 10px 0', textTransform: 'uppercase' as const, fontWeight: 600, letterSpacing: '0.5px' }}>Demo Credentials</p>
          <button type="button" onClick={fillDemoCredentials}
            style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 600, color: '#ffc107', backgroundColor: 'transparent', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer' }}>
            Fill Demo Credentials
          </button>
          <p style={{ fontSize: '11px', color: '#8b949e', margin: '10px 0 0 0', fontStyle: 'italic' }}>
            dispatcher@pasay.safesignal.ph / password123 / PNP-001
          </p>
        </div>

        <p style={{ textAlign: 'center' as const, fontSize: '11px', color: '#30363d', margin: '20px 0 0 0' }}>RespondPH v1.0 — Authorized Personnel Only</p>
      </div>
    </div>
  );
}
