import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { citizenApi } from '../../lib/api';

const BARANGAYS = Array.from({ length: 201 }, (_, i) => `Barangay ${i + 1}`);

export default function Register() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    full_name: '', phone: '', address: '', barangay: 'Barangay 1',
    pin: '', confirm_pin: '', photo_url: '', terms: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.photo_url) { setError('Please upload your selfie photo'); return; }
    if (!form.terms) { setError('Please accept the terms'); return; }
    if (!/^09\d{9}$/.test(form.phone)) { setError('Phone must be 11 digits starting with 09'); return; }
    if (!/^\d{4}$/.test(form.pin)) { setError('PIN must be exactly 4 digits'); return; }
    if (form.pin !== form.confirm_pin) { setError('PINs do not match'); return; }

    setLoading(true);
    try {
      const data: any = await citizenApi.register({
        full_name: form.full_name,
        phone: form.phone,
        address: form.address,
        barangay: form.barangay,
        pin: form.pin,
        photo_url: form.photo_url || null,
      });
      localStorage.setItem('pending_citizen_id', String(data.citizen_id));
      navigate('/verify');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, photo_url: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12,
    color: '#fff',
    padding: '12px 16px',
    width: '100%',
    fontSize: 14,
    outline: 'none',
  };

  return (
    <div className="citizen-container px-5 py-6" style={{ background: 'var(--citizen-bg)' }}>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <button style={{ color: '#aaa', background: 'none', border: 'none', fontSize: 20 }}>←</button>
        </Link>
        <div>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Create Account</h1>
          <p style={{ color: '#888', fontSize: 12, margin: 0 }}>Register for RespondPH</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 mb-2">
          {/* Entire selfie block wrapped in label so tapping the circle opens the picker */}
          <label htmlFor="selfie-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 80, height: 80, position: 'relative' }}>
              {form.photo_url ? (
                <img src={form.photo_url} alt="Selfie" className="w-full h-full rounded-full object-cover"
                  style={{ border: '2px solid var(--ph-gold)' }} />
              ) : (
                <div className="w-full h-full rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '2px dashed rgba(255,255,255,0.3)' }}>
                  <span style={{ fontSize: 28 }}>📷</span>
                </div>
              )}
            </div>
            <span style={{ color: 'var(--ph-gold)', fontSize: 12 }}>
              {form.photo_url ? '✓ Selfie Uploaded — Tap to Change' : 'Tap Here to Upload Selfie (Required)'}
            </span>
            <input id="selfie-upload" type="file" accept="image/*" capture="user" onChange={handlePhotoUpload}
              style={{ display: 'none' }} />
          </label>
        </div>

        <div>
          <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>Full Name *</label>
          <input style={inputStyle} placeholder="Juan dela Cruz" value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
        </div>

        <div>
          <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>
            Phone Number * (09XX-XXXX-XXX)
          </label>
          <input style={inputStyle} placeholder="09171234567" value={form.phone} maxLength={11}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} required />
        </div>

        <div>
          <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>Address</label>
          <input style={inputStyle} placeholder="123 Leveriza St" value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </div>

        <div>
          <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>Barangay *</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.barangay}
            onChange={e => setForm(f => ({ ...f, barangay: e.target.value }))}>
            {BARANGAYS.map(b => <option key={b} value={b} style={{ background: '#1a1a3e' }}>{b}</option>)}
          </select>
        </div>

        <div>
          <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>4-Digit PIN *</label>
          <input style={inputStyle} type="password" placeholder="••••" maxLength={4} value={form.pin}
            onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))} required />
        </div>

        <div>
          <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>Confirm PIN *</label>
          <input style={inputStyle} type="password" placeholder="••••" maxLength={4} value={form.confirm_pin}
            onChange={e => setForm(f => ({ ...f, confirm_pin: e.target.value.replace(/\D/g, '') }))} required />
        </div>

        <div className="flex items-start gap-3 p-3 rounded-xl"
          style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)' }}>
          <input type="checkbox" id="terms" checked={form.terms}
            onChange={e => setForm(f => ({ ...f, terms: e.target.checked }))}
            style={{ marginTop: 2, accentColor: 'var(--sos-red)', width: 16, height: 16 }} />
          <label htmlFor="terms" style={{ color: '#ccc', fontSize: 12, lineHeight: 1.5 }}>
            I understand that <strong style={{ color: 'var(--sos-red)' }}>false alarms</strong> will result in strikes
            and possible account suspension. I will only use this for genuine emergencies.
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(230,57,70,0.2)', color: '#ff6b6b' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-white text-lg mt-2"
          style={{ background: loading ? '#555' : 'var(--sos-red)', boxShadow: '0 4px 20px rgba(230,57,70,0.3)' }}>
          {loading ? 'Registering...' : 'Register & Get OTP'}
        </button>

        <p className="text-center text-sm" style={{ color: '#888' }}>
          Already have an account?{' '}
          <Link href="/login"><span style={{ color: 'var(--ph-gold)' }}>Login</span></Link>
        </p>
      </form>
    </div>
  );
}
