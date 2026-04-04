import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useCitizenAuth } from '../../hooks/useCitizenAuth';

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout, loading } = useCitizenAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [trustScore, setTrustScore] = useState(85);
  const [strikes, setStrikes] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => { if (!loading && !user) navigate('/login'); }, [user, loading, navigate]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user) {
      setTrustScore(user.trust?.score ?? Math.floor(Math.random() * 30) + 70);
      setStrikes(user.strike_count ?? 0);
    }
  }, [user]);

  const handleLogout = () => { logout(); navigate('/'); };
  const displayName = user?.full_name?.split(' ')[0] || 'Guest';

  return (
    <div className="citizen-container flex flex-col min-h-screen"
         style={{ background: 'var(--citizen-bg)', padding: 0 }}>

      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: '#888', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>PASAY CITY POLICE</p>
          <h1 style={{ color: '#fff', fontSize: 17, fontWeight: 800, margin: 0 }}>RespondPH</h1>
        </div>
        <button onClick={() => setShowMenu(!showMenu)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: 4 }}>☰</button>
      </div>

      {showMenu && (
        <div style={{ position: 'absolute', top: 60, right: 16, zIndex: 50, background: 'rgba(10,10,46,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, minWidth: 180, boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
          <Link href="/profile">
            <button onClick={() => setShowMenu(false)} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: '#fff', textAlign: 'left', fontSize: 14, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>👤 Profile</button>
          </Link>
          <Link href="/history">
            <button onClick={() => setShowMenu(false)} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: '#fff', textAlign: 'left', fontSize: 14, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>📋 History</button>
          </Link>
          <button onClick={() => { setShowMenu(false); handleLogout(); }} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: '#ff6b6b', textAlign: 'left', fontSize: 14, cursor: 'pointer' }}>🚪 Logout</button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center" style={{ padding: '20px 20px 0', overflowY: 'auto' }}>

        <div className="text-center mb-4 w-full">
          <p style={{ color: '#999', fontSize: 13, margin: '0 0 2px 0' }}>Hello, {displayName}</p>
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 4px 0' }}>
            {isOnline ? 'You are protected.' : 'Offline Mode'}
          </p>
          {user?.barangay && <p style={{ color: '#888', fontSize: 12, margin: 0 }}>{user.barangay}, Pasay City</p>}
        </div>

        {!isOnline && (
          <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, width: '100%' }}>
            <p style={{ color: '#ff6b6b', fontSize: 12, margin: 0 }}>You are offline. SOS will send when connection restores.</p>
          </div>
        )}

        <div style={{ position: 'relative', width: 200, height: 200, margin: '12px 0 8px' }}>
          <style>{`@keyframes sos-pulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.35); opacity: 0; } } .sos-ring { animation: sos-pulse 2s ease-out infinite; }`}</style>
          <div className="sos-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid var(--sos-red)' }}/>
          <Link href="/sos/confirm">
            <button style={{ position: 'absolute', inset: 0, borderRadius: '50%', width: '100%', height: '100%', background: 'var(--sos-red)', border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 8px 40px rgba(230,57,70,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <span style={{ fontSize: 28 }}>🚨</span>
              <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: 2 }}>SOS</span>
            </button>
          </Link>
        </div>

        <p style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>Press only in real emergencies</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', marginBottom: 16 }}>
          <Link href="/history">
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '16px 12px', textAlign: 'center', cursor: 'pointer' }}>
              <p style={{ fontSize: 22, margin: '0 0 6px 0' }}>📋</p>
              <p style={{ color: '#ccc', fontSize: 13, margin: 0, fontWeight: 600 }}>Alert History</p>
            </div>
          </Link>
          <Link href="/profile">
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '16px 12px', textAlign: 'center', cursor: 'pointer' }}>
              <p style={{ fontSize: 22, margin: '0 0 6px 0' }}>👤</p>
              <p style={{ color: '#ccc', fontSize: 13, margin: 0, fontWeight: 600 }}>My Profile</p>
            </div>
          </Link>
        </div>

        <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <p style={{ color: '#888', fontSize: 10, margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 1 }}>TRUST SCORE</p>
            <p style={{ color: '#4ade80', fontSize: 20, fontWeight: 800, margin: 0 }}>{trustScore}/100</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#888', fontSize: 10, margin: '0 0 6px 0', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 1 }}>STRIKES</p>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < strikes ? '#ef4444' : 'rgba(255,255,255,0.15)' }}/>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
