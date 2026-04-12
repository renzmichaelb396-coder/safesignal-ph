import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { citizenApi } from '../../lib/api';

const BARANGAYS = Array.from({ length: 201 }, (_, i) => `Barangay ${String(i + 1).padStart(3, '0')}`);

export default function Register() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    full_name: '', phone: '', address: '', barangay: 'Barangay 001',
    pin: '', confirm_pin: '', photo_url: '', terms: false, privacy: false,
    gov_id_type: '', gov_id_number: '', gov_id_photo: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const [govIdCompressing, setGovIdCompressing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.photo_url) { setError('Please upload your selfie photo'); return; }
    if (!form.gov_id_type) { setError('Please select your government ID type'); return; }
    if (!form.gov_id_number.trim()) { setError('Please enter your government ID number'); return; }
    if (!form.gov_id_photo) { setError('Please upload a photo of your government ID'); return; }
    if (!form.terms) { setError('Please accept the terms and conditions'); return; }
    if (!form.privacy) { setError('Please accept the Data Privacy consent (RA 10173)'); return; }
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
        gov_id_type: form.gov_id_type,
        gov_id_number: form.gov_id_number.trim(),
        gov_id_photo: form.gov_id_photo,
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

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const MAX_DIMENSION = 800;
      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL('image/jpeg', 0.7);
      setForm(f => ({ ...f, photo_url: compressed }));
    };

    img.src = objectUrl;
  };

  const handleGovIdPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGovIdCompressing(true);
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // ID documents: allow larger dimension so text is readable
      const MAX_DIMENSION = 1200;
      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL('image/jpeg', 0.8);
      setForm(f => ({ ...f, gov_id_photo: compressed }));
      setGovIdCompressing(false);
    };

    img.src = objectUrl;
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
          <p style={{ color: '#888', fontSize: 12, margin: 0 }}>Register with Pasay City Police</p>
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

        <div style={{ background: 'rgba(255,199,44,0.06)', border: '1px solid rgba(255,199,44,0.2)', borderRadius: 12, padding: '12px 14px' }}>
          <label style={{ color: 'var(--ph-gold)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 8, letterSpacing: 0.5 }}>
            🪪 GOVERNMENT ID — Required for Verification
          </label>
          <select style={{ ...inputStyle, marginBottom: 8, cursor: 'pointer' }} value={form.gov_id_type}
            onChange={e => setForm(f => ({ ...f, gov_id_type: e.target.value }))}>
            <option value="" style={{ background: '#1a1a3e' }}>Select ID Type *</option>
            <option value="PhilSys" style={{ background: '#1a1a3e' }}>PhilSys / National ID</option>
            <option value="Passport" style={{ background: '#1a1a3e' }}>Philippine Passport</option>
            <option value="Driver's License" style={{ background: '#1a1a3e' }}>Driver's License (LTO)</option>
            <option value="SSS" style={{ background: '#1a1a3e' }}>SSS ID</option>
            <option value="GSIS" style={{ background: '#1a1a3e' }}>GSIS ID</option>
            <option value="Voter's ID" style={{ background: '#1a1a3e' }}>Voter's ID (COMELEC)</option>
            <option value="PRC" style={{ background: '#1a1a3e' }}>PRC ID</option>
            <option value="Postal ID" style={{ background: '#1a1a3e' }}>Postal ID</option>
            <option value="Barangay ID" style={{ background: '#1a1a3e' }}>Barangay ID</option>
            <option value="School ID" style={{ background: '#1a1a3e' }}>School ID</option>
          </select>
          <input style={inputStyle} placeholder="Enter your ID number *" value={form.gov_id_number}
            onChange={e => setForm(f => ({ ...f, gov_id_number: e.target.value }))} />

          {/* Gov ID Photo Upload */}
          <div style={{ marginTop: 10 }}>
            <label htmlFor="gov-id-upload" style={{ cursor: 'pointer', display: 'block' }}>
              <div style={{
                width: '100%', minHeight: 90, borderRadius: 10,
                border: form.gov_id_photo ? '2px solid var(--ph-gold)' : '2px dashed rgba(255,199,44,0.4)',
                background: 'rgba(255,199,44,0.04)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative',
              }}>
                {form.gov_id_photo ? (
                  <>
                    <img src={form.gov_id_photo} alt="Gov ID"
                      style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 8 }} />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'rgba(0,0,0,0.55)', padding: '4px 8px', textAlign: 'center',
                    }}>
                      <span style={{ color: 'var(--ph-gold)', fontSize: 11 }}>✓ ID Photo Uploaded — Tap to Change</span>
                    </div>
                  </>
                ) : govIdCompressing ? (
                  <span style={{ color: '#aaa', fontSize: 12 }}>Compressing photo…</span>
                ) : (
                  <>
                    <span style={{ fontSize: 24, marginBottom: 4 }}>🪪</span>
                    <span style={{ color: 'var(--ph-gold)', fontSize: 12, fontWeight: 600 }}>Tap to Upload ID Photo *</span>
                    <span style={{ color: '#888', fontSize: 10, marginTop: 2 }}>Front side — must be clearly visible</span>
                  </>
                )}
              </div>
              <input id="gov-id-upload" type="file" accept="image/*" capture="environment"
                onChange={handleGovIdPhotoUpload} style={{ display: 'none' }} />
            </label>
          </div>

          <p style={{ color: '#888', fontSize: 11, marginTop: 6, marginBottom: 0 }}>
            Your ID is stored securely and used only to verify your identity in case of misuse.
          </p>
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

        <div className="flex items-start gap-3 p-3 rounded-xl"
          style={{ background: 'rgba(0,56,168,0.1)', border: '1px solid rgba(0,56,168,0.4)' }}>
          <input type="checkbox" id="privacy" checked={form.privacy}
            onChange={e => setForm(f => ({ ...f, privacy: e.target.checked }))}
            style={{ marginTop: 2, accentColor: '#1e4c8f', width: 16, height: 16 }} />
          <label htmlFor="privacy" style={{ color: '#ccc', fontSize: 12, lineHeight: 1.5 }}>
            I consent to the collection and processing of my personal data (name, phone, photo, location)
            by the <strong style={{ color: '#4da6ff' }}>Pasay City Police Station</strong> for emergency
            response purposes, in accordance with the{' '}
            <strong style={{ color: '#4da6ff' }}>Data Privacy Act of 2012 (RA 10173)</strong>.
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
