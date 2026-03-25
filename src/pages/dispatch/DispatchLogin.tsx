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
      navigate('/dispatch');
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

  useEffect(() => {
    fillDemoCredentials();
  }, []);

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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--dispatch-bg, #0d1117)',
        padding: '16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--dispatch-border, #161b22)',
          border: '1px solid var(--dispatch-border, #30363d)',
          borderRadius: '8px',
          padding: '40px 32px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              fontSize: '48px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            🛡️
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--ph-gold, #ffc107)',
              margin: '0 0 8px 0',
            }}
          >
            SAFESIGNAL PH
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--dispatch-border, #8b949e)',
              margin: 0,
            }}
          >
            Police Dispatch Portal
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email Field */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--dispatch-border, #c9d1d9)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dispatcher@pasay.safesignal.ph"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                backgroundColor: 'var(--dispatch-bg, #0d1117)',
                border: '1px solid var(--dispatch-border, #30363d)',
                borderRadius: '6px',
                color: 'var(--dispatch-border, #e6edf3)',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
              }}
            />
          </div>

          {/* Badge Number Field */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--dispatch-border, #c9d1d9)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Badge Number
            </label>
            <input
              type="text"
              value={badgeNumber}
              onChange={(e) => setBadgeNumber(e.target.value)}
              placeholder="PNP-001"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                backgroundColor: 'var(--dispatch-bg, #0d1117)',
                border: '1px solid var(--dispatch-border, #30363d)',
                borderRadius: '6px',
                color: 'var(--dispatch-border, #e6edf3)',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
              }}
            />
          </div>

          {/* Password Field */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--dispatch-border, #c9d1d9)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ã¢ÂÂ¢Ã¢ÂÂ¢Ã¢ÂÂ¢Ã¢ÂÂ¢Ã¢ÂÂ¢Ã¢ÂÂ¢Ã¢ÂÂ¢Ã¢ÂÂ¢"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                backgroundColor: 'var(--dispatch-bg, #0d1117)',
                border: '1px solid var(--dispatch-border, #30363d)',
                borderRadius: '6px',
                color: 'var(--dispatch-border, #e6edf3)',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
              }}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: 'rgba(248, 81, 73, 0.1)',
                border: '1px solid var(--sos-red, #f85149)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--sos-red, #f85149)',
              }}
            >
              {error}
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#0d1117',
              backgroundColor: 'var(--ph-gold, #ffc107)',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'background-color 0.2s',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#ffb300';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--ph-gold, #ffc107)';
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Credentials Section */}
        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--dispatch-border, #30363d)' }}>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--dispatch-border, #8b949e)',
              margin: '0 0 12px 0',
              textTransform: 'uppercase',
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
          >
            Demo Credentials
          </p>
          <button
            type="button"
            onClick={fillDemoCredentials}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--ph-gold, #ffc107)',
              backgroundColor: 'transparent',
              border: '1px solid var(--dispatch-border, #30363d)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Fill Demo Credentials
          </button>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--dispatch-border, #8b949e)',
              margin: '12px 0 0 0',
              fontStyle: 'italic',
            }}
          >
            dispatcher@pasay.safesignal.ph / password123 / PNP-001
          </p>
        </div>
      </div>
    </div>
  );
}
