import React, { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';
import { getInitials } from '../../lib/api';

interface NavLink {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
}

const navLinks: NavLink[] = [
  { href: '/dispatch', label: 'Live Map', icon: '🗺️' },
  { href: '/dispatch/queue', label: 'Alert Queue', icon: '🚨' },
  { href: '/dispatch/history', label: 'History', icon: '📋' },
  { href: '/dispatch/citizens', label: 'Citizens', icon: '👥' },
  { href: '/dispatch/officers', label: 'Officers', icon: '👮', roles: ['DISPATCHER', 'STATION_ADMIN'] },
  { href: '/dispatch/settings', label: 'Settings', icon: '⚙️', roles: ['STATION_ADMIN'] },
  { href: '/dispatch/metrics', label: 'Metrics', icon: '📊', roles: ['DISPATCHER', 'STATION_ADMIN'] },
  { href: '/dispatch/officer-dashboard', label: 'My Dashboard', icon: '🏠', roles: ['OFFICER'] },
];

export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { officer, loading, logout } = useDispatchAuth();

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !officer) {
      window.location.href = '/dispatch/login';
    }
  }, [officer, loading]);

  if (loading || !officer) return null;

  const officerRole = officer?.role || '';
  const officerName = officer?.full_name || (officer as any)?.name || 'User';

  const filteredNav = navLinks.filter(
    (link) => !link.roles || link.roles.includes(officerRole)
  );

  const isActive = (path: string) => {
    if (path === '/dispatch') return location === '/dispatch';
    return location.startsWith(path);
  };

  function handleLogout() {
    logout();
    window.location.href = '/dispatch/login';
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--dispatch-bg, #0d1117)',
        color: '#e6edf3',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Sidebar */}
      <nav
        style={{
          width: 220,
          background: 'var(--dispatch-sidebar, #161b22)',
          borderRight: '1px solid var(--dispatch-border, #30363d)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--dispatch-border, #30363d)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <img
              src="/pasay-police-badge.svg"
              alt="SPD Logo"
              style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--ph-gold, #ffc107)',
                letterSpacing: '0.02em',
              }}
            >
              Pasay City Emergency Response
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              color: '#8b949e',
              paddingLeft: 38,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Pasay City Police Station
          </p>
        </div>

        {/* Officer card */}
        {officer && (
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--dispatch-border, #30363d)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {getInitials(officerName)}
            </div>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#e6edf3',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {officerName}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: '#8b949e' }}>
                {officer.badge_number} · {officerRole || 'DISPATCHER'}
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredNav.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--ph-gold, #ffc107)' : '#8b949e',
                  background: active ? 'rgba(255,193,7,0.1)' : 'transparent',
                  borderLeft: active ? '3px solid var(--ph-gold, #ffc107)' : '3px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,148,158,0.08)';
                    (e.currentTarget as HTMLElement).style.color = '#c9d1d9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#8b949e';
                  }
                }}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Logout */}
        <div
          style={{
            padding: '12px 8px',
            borderTop: '1px solid var(--dispatch-border, #30363d)',
          }}
        >
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: 'rgba(230,57,70,0.12)',
              color: '#fca5a5',
              border: '1px solid rgba(230,57,70,0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(230,57,70,0.22)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(230,57,70,0.12)';
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
}
