import React from 'react';
import { Link } from 'wouter';

export default function Landing() {
  return (
    <div
      className="citizen-container flex flex-col items-center justify-between min-h-screen px-6 py-10"
      style={{ background: 'var(--citizen-bg)' }}
    >
      {/* Header */}
      <div className="w-full flex justify-between items-center">
        <span style={{ color: 'var(--ph-gold)', fontSize: '12px', fontWeight: 600 }}>
          PASAY CITY POLICE STATION
        </span>
        <span style={{ color: '#666', fontSize: '11px' }}>v1.0</span>
      </div>

      {/* Logo and Branding */}
      <div className="flex flex-col items-center text-center gap-6">
        {/* Custom SOS Shield Logo */}
        <div style={{ width: 120, height: 140 }}>
          <svg viewBox="0 0 120 140" width="120" height="140" xmlns="http://www.w3.org/2000/svg">
            {/* Shield shape */}
            <path
              d="M60 5 L110 25 L110 75 Q110 115 60 135 Q10 115 10 75 L10 25 Z"
              fill="#1a237e"
              stroke="#ffc107"
              strokeWidth="3"
            />
            {/* Inner shield */}
            <path
              d="M60 15 L100 32 L100 75 Q100 108 60 125 Q20 108 20 75 L20 32 Z"
              fill="#283593"
            />
            {/* Stars row */}
            <text x="60" y="48" textAnchor="middle" fontSize="14" fill="#ffc107">★ ★ ★</text>
            {/* SOS text */}
            <text
              x="60"
              y="85"
              textAnchor="middle"
              fontSize="28"
              fontWeight="900"
              fill="#ffffff"
              fontFamily="Arial, sans-serif"
            >
              SOS
            </text>
            {/* Bottom text */}
            <text x="60" y="108" textAnchor="middle" fontSize="8" fill="#ffc107" fontFamily="Arial, sans-serif">
              EMERGENCY RESPONSE
            </text>
          </svg>
        </div>

        <div>
          <h1
            style={{
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: 800,
              margin: 0,
              letterSpacing: '-0.5px',
            }}
          >
            RespondPH
          </h1>
          <p style={{ color: 'var(--ph-gold)', fontSize: '14px', marginTop: 8, fontStyle: 'italic' }}>
            Emergency help, one tap away
          </p>
          <p style={{ color: '#8888aa', fontSize: '12px', marginTop: 6 }}>
            Pasay City Police Station
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full mt-4">
          {[
            { icon: '🚨', text: 'One-tap SOS with GPS location' },
            { icon: '🗺️', text: 'Real-time officer tracking' },
            { icon: '🔒', text: 'Secure PIN verification' },
          ].map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
              <span style={{ color: '#ccc', fontSize: 13 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <Link href="/register">
          <button
            className="w-full py-4 rounded-2xl font-bold text-white text-lg"
            style={{ background: 'var(--sos-red)', boxShadow: '0 4px 20px rgba(230,57,70,0.4)' }}
          >
            Register Now
          </button>
        </Link>
        <Link href="/login">
          <button
            className="w-full py-4 rounded-2xl font-bold text-lg"
            style={{
              background: 'transparent',
              border: '2px solid rgba(255,255,255,0.3)',
              color: '#fff',
            }}
          >
            Login
          </button>
        </Link>
        <Link href="/dispatch/login">
          <p className="text-center text-xs mt-2" style={{ color: '#666' }}>
            Police Dispatcher?{' '}
            <span style={{ color: 'var(--ph-gold)' }}>Login here</span>
          </p>
        </Link>
      </div>
    </div>
  );
}
