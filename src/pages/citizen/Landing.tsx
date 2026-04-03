import React from 'react';
import { Link } from 'wouter';

export default function Landing() {
  return (
    <div className="citizen-container flex flex-col items-center justify-between min-h-screen px-6 py-10"
      style={{ background: 'var(--citizen-bg)' }}>
      {/* Header */}
      <div className="w-full flex justify-between items-center">
        <span style={{ color: 'var(--ph-gold)', fontSize: '12px', fontWeight: 600 }}>
          PASAY CITY POLICE STATION
        </span>
        <span style={{ color: '#666', fontSize: '11px' }}>v1.0</span>
      </div>

      {/* Logo & Branding */}
      <div className="flex flex-col items-center text-center gap-6">
        <div className="relative" style={{ width: 120, height: 140 }}>
          <img
            src="/pasay-police-badge.svg"
            alt="Pasay City Police Station"
            style={{ width: 120, height: 140, objectFit: 'contain' }}
          />
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
            { icon: '\u{1F6A8}', text: 'One-tap SOS with GPS location' },
            { icon: '\u{1F5FA}\uFE0F', text: 'Live status updates on your SOS' },
            { icon: '\u{1F510}', text: 'Secure PIN verification' },
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
            Police Dispatcher? <span style={{ color: 'var(--ph-gold)' }}>Login here \u2192</span>
          </p>
        </Link>
      </div>
    </div>
  );
}import React from 'react';
import { Link } from 'wouter';

export default function Landing() {
  return (
    <div className="citizen-container flex flex-col items-center justify-between min-h-screen px-6 py-10"
      style={{ background: 'var(--citizen-bg)' }}>
      {/* Header */}
      <div className="w-full flex justify-between items-center">
        <span style={{ color: 'var(--ph-gold)', fontSize: '12px', fontWeight: 600 }}>
          PASAY CITY POLICE STATION
        </span>
        <span style={{ color: '#666', fontSize: '11px' }}>v1.0</span>
      </div>

      {/* Logo & Branding */}
      <div className="flex flex-col items-center text-center gap-6">
        <div className="relative" style={{ width: 120, height: 140 }}>
          <img
            src="/pasay-police-badge.svg"
            alt="Pasay City Police Station"
            style={{ width: 120, height: 140, objectFit: 'contain' }}
          />
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
            { icon: '\u{1F6A8}', text: 'One-tap SOS with GPS location' },
            { icon: '\u{1F5FA}\uFE0F', text: 'Real-time officer tracking' },
            { icon: '\u{1F510}', text: 'Secure PIN verification' },
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
