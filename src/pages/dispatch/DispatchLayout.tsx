import React from 'react';
import { Link, useLocation } from 'wouter';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';

interface DispatchLayoutProps {
  children: React.ReactNode;
}

export default function DispatchLayout({ children }: DispatchLayoutProps) {
  const [location] = useLocation();
  const { officer, logout } = useDispatchAuth();

  const navLinks = [
    { path: '/dispatch', label: 'Live Map', icon: '📊' },
    { path: '/dispatch/queue', label: 'Alert Queue', icon: '🚨' },
    { path: '/dispatch/history', label: 'History', icon: '📋' },
    { path: '/dispatch/citizens', label: 'Citizens', icon: '👥' },
    { path: '/dispatch/officers', label: 'Officers', icon: '👮' },
    { path: '/dispatch/settings', label: 'Settings', icon: '⚙️' },
    { path: '/dispatch/metrics', label: 'Metrics', icon: '📈' },
  ];

  const isActive = (path: string) => {
    if (path === '/dispatch') {
      return location === '/dispatch';
    }
    return location.startsWith(path);
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#0d1117',
      color: '#e6edf3',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Sidebar */}
      <div style={{
        width: '220px',
        backgroundColor: '#161b22',
        borderRight: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 16px',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{ fontSize: '24px' }}>🛡️</div>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 700,
              color: '#ffc107',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              RespondPH
            </h2>
            <p style={{
              margin: 0,
              fontSize: '10px',
              color: '#8b949e',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }}>
              Pasay City Police
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}>
          {navLinks.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                href={link.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: active ? '#ffc107' : '#c9d1d9',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  backgroundColor: active ? 'rgba(255,193,7,0.1)' : 'transparent',
                  border: `1px solid ${active ? '#30363d' : 'transparent'}`,
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'rgba(139,148,158,0.1)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#c9d1d9';
                  }
                }}
              >
                <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Officer Info & Logout */}
        <div style={{
          padding: '12px 8px',
          borderTop: '1px solid #30363d',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {officer && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: '#0d1117',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#8b949e',
            }}>
              <p style={{
                margin: '0 0 2px 0',
                fontSize: '12px',
                fontWeight: 600,
                color: '#c9d1d9',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {officer.full_name}
              </p>
              <p style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {officer.badge_number}
              </p>
            </div>
          )}
          <button
            onClick={logout}
            style={{
              padding: '10px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#0d1117',
              backgroundColor: '#ffc107',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffb300'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffc107'; }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="dispatch-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
