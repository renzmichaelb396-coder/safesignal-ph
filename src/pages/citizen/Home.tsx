import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useCitizenAuth } from '../../hooks/useCitizenAuth';
import { citizenApi } from '../../lib/api';

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout } = useCitizenAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [trustScore, setTrustScore] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

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
      setTrustScore(Math.floor(Math.random() * 40) + 60);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getTrustColor = (score: number) => {
    if (score >= 80) return '#4ade80';
    if (score >= 60) return '#facc15';
    return '#ef4444';
  };

  return (
    <div className="citizen-container px-5 py-6 flex flex-col min-h-screen" style={{ background: 'var(--citizen-bg)' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>
            Hello, {user?.full_name?.split(' ')[0]}
          </h1>
          <p style={{ color: '#888', fontSize: 12, margin: 0, marginTop: 2 }}>
            {isOnline ? 'Online & Ready' : 'Offline Mode'}
          </p>
        </div>
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            width: 40,
            height: 40,
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ⚙️
        </button>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}>
          <p style={{ color: '#ff6b6b', fontSize: 12, margin: 0 }}>
            You're offline. Emergency calls will send when connection restores.
          </p>
        </div>
      )}

      {/* Menu Dropdown */}
      {showMenu && (
        <div
          className="absolute top-20 right-5 rounded-xl shadow-lg z-10"
          style={{
            background: 'rgba(10,10,46,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            minWidth: 200,
          }}
        >
          <Link href="/profile">
            <button
              onClick={() => setShowMenu(false)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                color: '#fff',
                textAlign: 'left',
                fontSize: 14,
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              👤 Profile
            </button>
          </Link>
          <Link href="/history">
            <button
              onClick={() => setShowMenu(false)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                color: '#fff',
                textAlign: 'left',
                fontSize: 14,
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              📋 History
            </button>
          </Link>
          <button
            onClick={() => {
              setShowMenu(false);
              handleLogout();
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              color: '#ff6b6b',
              textAlign: 'left',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            🚪 Logout
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {/* Trust Score */}
        <div className="w-full p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ color: '#888', fontSize: 11, margin: '0 0 8px 0', textTransform: 'uppercase', fontWeight: 600 }}>
            Trust Score
          </p>
          <div className="flex items-center gap-3">
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${trustScore}%`,
                  height: '100%',
                  background: getTrustColor(trustScore),
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <span style={{ color: getTrustColor(trustScore), fontWeight: 700, fontSize: 14, minWidth: 40 }}>
              {trustScore}%
            </span>
          </div>
        </div>

        {/* SOS Button */}
        <div style={{ position: 'relative', width: 180, height: 180 }}>
          <style>{`
            @keyframes pulse-ring {
              0% {
                transform: scale(1);
                opacity: 1;
              }
              100% {
                transform: scale(1.3);
                opacity: 0;
              }
            }
            .sos-pulse {
              animation: pulse-ring 2s infinite;
            }
          `}</style>

          <div
            className="sos-pulse"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid var(--sos-red)',
              opacity: 0.5,
            }}
          />

          <Link href="/sos/confirm">
            <button
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                width: '100%',
                height: '100%',
                background: 'var(--sos-red)',
                border: 'none',
                color: '#fff',
                fontSize: 48,
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 8px 30px rgba(230,57,70,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseDown={e => {
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onMouseUp={e => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              SOS
            </button>
          </Link>
        </div>

        <p style={{ color: '#888', fontSize: 12, textAlign: 'center', maxWidth: 200 }}>
          Press and hold for emergency. Your location will be shared with police.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3 mt-auto">
        <Link href="/history">
          <div
            className="p-4 rounded-xl text-center cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
          >
            <p style={{ fontSize: 20, margin: '0 0 4px 0' }}>📋</p>
            <p style={{ color: '#ccc', fontSize: 12, margin: 0, fontWeight: 600 }}>History</p>
          </div>
        </Link>

        <Link href="/profile">
          <div
            className="p-4 rounded-xl text-center cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
          >
            <p style={{ fontSize: 20, margin: '0 0 4px 0' }}>👤</p>
            <p style={{ color: '#ccc', fontSize: 12, margin: 0, fontWeight: 600 }}>Profile</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
