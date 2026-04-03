import React from 'react';
import { Link, useLocation } from 'wouter';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';

interface NavLink {
  href: string;
  label: string;
  roles?: string[];
}

const navLinks: NavLink[] = [
  { href: '/dispatch', label: 'Live Map' },
  { href: '/dispatch/queue', label: 'Alert Queue' },
  { href: '/dispatch/citizens', label: 'Citizens' },
  { href: '/dispatch/officers', label: 'Officers', roles: ['DISPATCHER', 'ADMIN'] },
  { href: '/dispatch/metrics', label: 'Metrics', roles: ['DISPATCHER', 'ADMIN'] },
  { href: '/dispatch/settings', label: 'Settings', roles: ['ADMIN'] },
  { href: '/dispatch/officer-dashboard', label: 'My Dashboard', roles: ['OFFICER'] },
];

export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { officer, logout } = useDispatchAuth();

  const officerRole = officer?.role || '';
  const officerName = officer?.full_name || 'User';

  const filteredNav = navLinks.filter(
    (link) => !link.roles || link.roles.includes(officerRole)
  );

  function handleLogout() {
    logout();
    window.location.href = '/dispatch/login';
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--dispatch-bg, #0d1117)', color: '#e6edf3', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <nav style={{ width: 220, background: 'var(--dispatch-sidebar, #161b22)', borderRight: '1px solid var(--dispatch-border, #30363d)', display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid var(--dispatch-border, #30363d)', marginBottom: 16 }}>
          <div style={{ color: 'var(--ph-gold, #ffc107)', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
            SAFESIGNAL PH
          </div>
          <div style={{ color: '#8b949e', fontSize: 11, marginTop: 2 }}>
            {officerRole || 'DISPATCHER'}
          </div>
        </div>

        <div style={{ flex: 1, padding: '0 12px' }}>
          {filteredNav.map((link) => {
            const isActive = location === link.href || location.startsWith(link.href + '/');
            return (
              <Link key={link.href} href={link.href}>
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  marginBottom: 4,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#fff' : '#8b949e',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--ph-gold, #ffc107)' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}>
                  {link.label}
                </div>
              </Link>
            );
          })}
        </div>

        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--dispatch-border, #30363d)' }}>
          <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8, paddingLeft: 12 }}>
            {officerName}
          </div>
          <button
            onClick={handleLogout}
            style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, cursor: 'pointer', fontSize: 13, textAlign: 'left' }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
