import React, { useState } from 'react';
import { useLocation } from 'wouter';

export default function DispatchRegister() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'OFFICER' | 'DISPATCHER'>('OFFICER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/dispatch/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, badge_number: badgeNumber, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        return;
      }
      setSuccess('Account created! You can now log in.');
      setTimeout(() => navigate('/dispatch/login'), 2000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#e6edf3',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '40px 32px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <img src="/pasay-police-badge.svg" alt="Pasay City Police" style={{ width: '72px', height: 'auto', marginBottom: '12px', filter: 'drop-shadow(0 4px 12px rgba(245,158,11,0.4))' }} />
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#ffc107', margin: '0 0 6px 0', lineHeight: 1.2 }}>Pasay City Emergency Response</h1>
            <p style={{ fontSize: '13px', color: '#8b949e', margin: 0 }}>Personnel Registration</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#c9d1d9', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Juan dela Cruz" required style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#ffc107'; }} onBlur={e => { e.currentTarget.style.borderColor = '#30363d'; }} />
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#c9d1d9', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="officer@pasay.safesignal.ph" required style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#ffc107'; }} onBlur={e => { e.currentTarget.style.borderColor = '#30363d'; }} />
            </div>

            {/* Badge Number */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#c9d1d9', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Badge Number</label>
              <input type="text" value={badgeNumber} onChange={e => setBadgeNumber(e.target.value)} placeholder="PNP-XXX" required style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#ffc107'; }} onBlur={e => { e.currentTarget.style.borderColor = '#30363d'; }} />
            </div>

            {/* Role */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#c9d1d9', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value as 'OFFICER' | 'DISPATCHER')} required
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#ffc107'; }} onBlur={e => { e.currentTarget.style.borderColor = '#30363d'; }}>
                <option value="OFFICER">Field Officer</option>
                <option value="DISPATCHER">Dispatcher</option>
              </select>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#c9d1d9', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#ffc107'; }} onBlur={e => { e.currentTarget.style.borderColor = '#30363d'; }} />
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#c9d1d9', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" required style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#ffc107'; }} onBlur={e => { e.currentTarget.style.borderColor = '#30363d'; }} />
            </div>

            {error && (
              <div style={{ padding: '10px 12px', backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '6px', fontSize: '13px', color: '#f85149' }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{ padding: '10px 12px', backgroundColor: 'rgba(63,185,80,0.1)', border: '1px solid #3fb950', borderRadius: '6px', fontSize: '13px', color: '#3fb950' }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ padding: '12px', fontSize: '14px', fontWeight: 600, color: '#0d1117', backgroundColor: '#ffc107', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#8b949e' }}>
            Already have an account?{' '}
            <a href="/dispatch/login" style={{ color: '#ffc107', textDecoration: 'none', fontWeight: 600 }}>Sign in</a>
          </p>
        </div>

        <p style={{ marginTop: '12px', textAlign: 'center', fontSize: '12px', color: '#8b949e' }}>
          <a href="/" style={{ color: '#8b949e', textDecoration: 'none' }}>← Back to Citizen App</a>
        </p>
      </div>
    </div>
  );
}
