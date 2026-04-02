import React from 'react';
import { Link } from 'wouter';

export default function Landing() {
  return (
    <div className="citizen-container flex flex-col items-center justify-between min-h-screen px-6 py-10"
      style={{ background: 'var(--citizen-bg)' }}>
      {/* Header */}
      <div className="w-full flex items-center justify-center relative">
        <span style={{ color: 'var(--ph-gold)', fontSize: '12px', fontWeight: 600 }}>
          PASAY CITY POLICE STATION
        </span>
        <span style={{ color: '#666', fontSize: '11px', position: 'absolute', right: 0 }}>v1.0</span>
      </div>

      {/* Logo & Branding */}
      <div className="flex flex-col items-center text-center gap-6">
        <div className="relative" style={{ width: 120, height: 140}}>
          <svg viewBox="0 0 120 140" width="120" height="140">
            <path d="M60 5 L110 25 L110 75 Q110 120 60 135 Q10 120 10 75 L10 25 Z"
              fill="#0038A8" stroke="#FFD700" strokeWidth="3"/>
            <circle cx="60" cy="70" r="22" fill="#FFD700"/>
            <text x="60" y="77" textAnchor="middle" fill="#0038A8"
              fontSize="16" fontWeight="900" fontFamily="Arial">SOS</text>
            <text x="25" y="45" textAnchor="middle" fill="#FFD700" fontSize="12">★</text>
            <text x="95" y="45" textAnchor="middle" fill="#FFD700" fontSize="12">★</text>
            <text x="60" y="30" textAnchor="middle" fill="#FFD700" fontSize="12">★</text>
          </svg>
        </div>

        <div>
          <h1 style={{ color: '#ffffff', fontSize: '28px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
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
            { icon: '🔐', text: 'Secure PIN verification' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: 20 }}>{f.icon}</span>
              <span style={{ color: '#ccc', fontSize: 13 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <Link href="/register">
          <button className="w-full py-4 rounded-2xl font-bold text-white text-lg"
            style={{ background: 'var(--sos-red)', boxShadow: '0 4px 20px rgba(230,57,70,0.4)' }}>
            Register Now
          </button>
        </Link>
        <Link href="/login">
          <button className="w-full py-4 rounded-2xl font-bold text-lg"
            style={{ background: 'transparent', border: '2px solid rgba(255,255,255,0.3)', color: '#fff' }}>
            Login
          </button>
        </Link>
        <Link href="/dispatch/login">
          <p className="text-center text-xs mt-2" style={{ color: '#666' }}>
            Police Dispatcher? <span style={{ color: 'var(--ph-gold)' }}>Login here →</span>
          </p>
        </Link>
      </div>
    </div>
  );
}
