import React from 'react';
import { Link, useLocation } from 'wouter';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';
import { getInitials } from '../../lib/api';

interface DispatchLayoutProps {
    children: React.ReactNode;
}

export default function DispatchLayout({ children }: DispatchLayoutProps) {
    const [location] = useLocation();
    const { officer, logout } = useDispatchAuth();

  const officerName = officer
      ? (officer.full_name || (officer as any).name || 'Unknown')
        : '';
    const officerRole = officer
      ? ((officer as any).role || 'DISPATCHER').toUpperCase()
          : 'DISPATCHER';

  const navLinks = [
    { path: '/dispatch', label: 'Live Map', roles: ['DISPATCHER', 'STATION_ADMIN', 'OFFICER'] },
    { path: '/dispatch/queue', label: 'Alert Queue', roles: ['DISPATCHER', 'STATION_ADMIN'] },
    { path: '/dispatch/officer-dashboard', label: 'My Dashboard', roles: ['OFFICER'] },
    { path: '/dispatch/history', label: 'History', roles: ['DISPATCHER', 'STATION_ADMIN'] },
    { path: '/dispatch/citizens', label: 'Citizens', roles: ['DISPATCHER', 'STATION_ADMIN'] },
    { path: '/dispatch/officers', label: 'Officers', roles: ['DISPATCHER', 'STATION_ADMIN'] },
    { path: '/dispatch/settings', label: 'Settings', roles: ['DISPATCHER', 'STATION_ADMIN'] },
    { path: '/dispatch/metrics', label: 'Metrics', roles: ['DISPATCHER', 'STATION_ADMIN'] },
      ];

  const filteredNav = navLinks.filter(
        (link) => !link.roles || link.roles.includes(officerRole)
      );

  const isActive = (path: string) => {
        if (path === '/dispatch') return location === '/dispatch';
        return location.startsWith(path);
  };

  return (
        <div
                style={{
                          display: 'flex',
                          height: '100vh',
                          backgroundColor: 'var(--dispatch-bg, #0d1117)',
                          color: 'var(--dispatch-text, #e6edf3)',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
              <div className="dispatch-sidebar" style={{ width: 260, backgroundColor: 'var(--dispatch-border, #161b22)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
                      <div className="p-4" style={{ borderBottom: '1px solid var(--dispatch-border, #30363d)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                            <img
                                                            src="/pasay-police-badge.svg"
                                                            alt="Pasay City Police Badge"
                                                            style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
                                                          />
                                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ph-gold, #ffc107)', letterSpacing: '0.02em' }}>
                                                          RespondPH
                                            </span>span>
                                </div>div>
                                <p style={{ margin: 0, fontSize: 10, color: 'var(--dispatch-text-secondary, #8b949e)', paddingLeft: 36, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            Pasay City Police Station
                                </p>p>
                      </div>div>
              
                {officer && (
                          <div className="p-4" style={{ borderBottom: '1px solid var(--dispatch-border, #30363d)' }}>
                                      <div className="flex items-center gap-3">
                                                    <div
                                                                      className="flex items-center justify-center rounded-full flex-shrink-0"
                                                                      style={{ width: 36, height: 36, background: '#1d4ed8', fontSize: 13, fontWeight: 700, color: '#fff' }}
                                                                    >
                                                      {getInitials(officerName)}
                                                    </div>div>
                                                    <div style={{ minWidth: 0 }}>
                                                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--dispatch-text, #e6edf3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                      {officerName}
                                                                    </p>p>
                                                                    <p style={{ margin: 0, fontSize: 11, color: 'var(--dispatch-text-secondary, #8b949e)' }}>
                                                                      {officer.badge_number} &middot; {officerRole}
                                                                    </p>p>
                                                    </div>div>
                                      </div>div>
                          </div>div>
                      )}
              
                      <nav className="flex" style={{ flex: 1, overflow: 'auto', padding: '12px 8px', flexDirection: 'column', gap: 2 }}>
                        {filteredNav.map((link) => {
                            const active = isActive(link.path);
                            return (
                                            <Link
                                                              key={link.path}
                                                              href={link.path}
                                                              style={{
                                                                                  display: 'flex',
                                                                                  alignItems: 'center',
                                                                                  gap: 10,
                                                                                  padding: '10px 12px',
                                                                                  borderRadius: 6,
                                                                                  fontSize: 13,
                                                                                  fontWeight: active ? 600 : 500,
                                                                                  color: active ? 'var(--ph-gold, #ffc107)' : 'var(--dispatch-text-secondary, #8b949e)',
                                                                                  background: active ? 'rgba(255,193,7,0.08)' : 'transparent',
                                                                                  borderLeft: active ? '3px solid #ffc107' : '3px solid transparent',
                                                                                  borderTop: '1px solid transparent',
                                                                                  borderRight: '1px solid transparent',
                                                                                  borderBottom: '1px solid transparent',
                                                                                  textDecoration: 'none',
                                                                                  transition: 'all 0.15s',
                                                              }}
                                                              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,148,158,0.08)'; }}
                                                              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                                                            >
                                                            <span>{link.label}</span>span>
                                            </Link>Link>
                                          );
              })}
                      </nav>nav>
              
                      <div className="p-4" style={{ borderTop: '1px solid var(--dispatch-border, #30363d)' }}>
                                <button
                                              onClick={logout}
                                              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgba(230,57,70,0.12)', color: '#fca5a5', border: '1px solid rgba(230,57,70,0.25)', transition: 'all 0.2s' }}
                                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(230,57,70,0.22)'; }}
                                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(230,57,70,0.12)'; }}
                                            >
                                            Logout
                                </button>button>
                      </div>div>
              </div>div>
        
              <div className="dispatch-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {children}
              </div>div>
        </div>div>
      );
}</div>
