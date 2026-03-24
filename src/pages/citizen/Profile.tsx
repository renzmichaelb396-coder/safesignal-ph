import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useCitizenAuth } from '../../contexts/CitizenAuthContext';
import { citizenApi, getInitials } from '../../lib/api';

export default function Profile() {
  const { citizen, logout, refreshProfile } = useCitizenAuth();
  const [, setLocation] = useLocation();

  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [barangay, setBarangay] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (citizen) {
      setFullName(citizen.full_name || '');
      setAddress(citizen.address || '');
      setBarangay(citizen.barangay || '');
    }
  }, [citizen]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      await citizenApi.updateProfile({
        full_name: fullName,
        address: address,
        barangay: barangay,
      });

      await refreshProfile();
      setSuccessMsg('Profile updated successfully');
      setEditing(false);

      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (citizen) {
      setFullName(citizen.full_name || '');
      setAddress(citizen.address || '');
      setBarangay(citizen.barangay || '');
    }
    setEditing(false);
  };

  const handleLogout = () => {
    logout();
    setLocation('/');
  };

  if (!citizen) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--citizen-bg, #0a0a2e)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: '#fff' }}>Loading...</p>
      </div>
    );
  }

  const trustScore = citizen.trust?.score ?? 0;
  const totalAlerts = citizen.trust?.total_alerts ?? 0;
  const falseAlarms = citizen.trust?.false_alarms ?? 0;
  const resolvedEmergencies = citizen.trust?.resolved_emergencies ?? 0;
  const strikeCount = citizen.strike_count ?? 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--citizen-bg, #0a0a2e)',
        color: '#fff',
        padding: '0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--ph-blue, #1e4c8f) 0%, var(--ph-gold, #ffc72c) 100%)',
          padding: '16px',
          paddingTop: '20px',
          paddingBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <a
            href="/home"
            style={{ color: '#fff', textDecoration: 'none', fontSize: '20px', cursor: 'pointer' }}
          >
            ←
          </a>
          <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '700' }}>Profile</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {/* Messages */}
        {error && (
          <div
            style={{
              background: '#2a0a0a',
              border: '1px solid #ff4444',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              color: '#ff4444',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}
        {successMsg && (
          <div
            style={{
              background: '#0a2a0a',
              border: '1px solid #44ff44',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              color: '#44ff44',
              fontSize: '13px',
            }}
          >
            {successMsg}
          </div>
        )}

        {/* Profile Photo & Basic Info */}
        <div
          style={{
            background: '#1a1a3e',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            textAlign: 'center',
            border: '1px solid #2a2a5e',
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, var(--ph-blue, #1e4c8f) 0%, var(--ph-gold, #ffc72c) 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '32px',
              fontWeight: '700',
              color: '#fff',
            }}
          >
            {getInitials(citizen.full_name)}
          </div>

          {/* Name and Phone (read-only) */}
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600' }}>{citizen.full_name}</h2>
          <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#888' }}>{citizen.phone}</p>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              padding: '4px 8px',
              background: citizen.is_suspended ? '#2a0a0a' : '#0a2a0a',
              color: citizen.is_suspended ? '#ff4444' : '#44ff44',
              borderRadius: '4px',
              display: 'inline-block',
            }}
          >
            {citizen.is_suspended ? 'Account Suspended' : 'Account Active'}
          </p>
        </div>

        {/* Trust Score Section */}
        <div
          style={{
            background: '#1a1a3e',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            border: '1px solid #2a2a5e',
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Trust Score</h3>

          {/* Score Visualization */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#888' }}>Overall Score</span>
              <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--ph-gold, #ffc72c)' }}>
                {trustScore}/100
              </span>
            </div>
            <div style={{ background: '#0a0a2e', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: `linear-gradient(90deg, var(--ph-blue, #1e4c8f) 0%, var(--ph-gold, #ffc72c) 100%)`,
                  width: `${trustScore}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: '#0a0a2e', borderRadius: '8px', padding: '12px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#888' }}>Total Alerts</p>
              <p style={{ margin: '0', fontSize: '18px', fontWeight: '700', color: '#fff' }}>
                {totalAlerts}
              </p>
            </div>
            <div style={{ background: '#0a0a2e', borderRadius: '8px', padding: '12px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#888' }}>Resolved</p>
              <p style={{ margin: '0', fontSize: '18px', fontWeight: '700', color: '#44ff44' }}>
                {resolvedEmergencies}
              </p>
            </div>
            <div style={{ background: '#0a0a2e', borderRadius: '8px', padding: '12px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#888' }}>False Alarms</p>
              <p style={{ margin: '0', fontSize: '18px', fontWeight: '700', color: '#ff6b9d' }}>
                {falseAlarms}
              </p>
            </div>
            <div style={{ background: '#0a0a2e', borderRadius: '8px', padding: '12px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#888' }}>Strikes</p>
              <p style={{ margin: '0', fontSize: '18px', fontWeight: '700', color: strikeCount > 0 ? '#ff4444' : '#44ff44' }}>
                {strikeCount}/3
              </p>
            </div>
          </div>
        </div>

        {/* Editable Profile Fields */}
        <div
          style={{
            background: '#1a1a3e',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            border: '1px solid #2a2a5e',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '600' }}>Personal Information</h3>
            <button
              onClick={() => setEditing(!editing)}
              style={{
                padding: '6px 12px',
                background: editing ? '#666' : 'var(--ph-blue, #1e4c8f)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!editing) (e.target as HTMLButtonElement).style.background = 'var(--ph-gold, #ffc72c)';
              }}
              onMouseLeave={(e) => {
                if (!editing) (e.target as HTMLButtonElement).style.background = 'var(--ph-blue, #1e4c8f)';
              }}
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!editing}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: editing ? '#0a0a2e' : '#2a2a5e',
                  border: '1px solid #2a2a5e',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  cursor: editing ? 'text' : 'default',
                  transition: 'background 0.2s',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Address */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!editing}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: editing ? '#0a0a2e' : '#2a2a5e',
                  border: '1px solid #2a2a5e',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  cursor: editing ? 'text' : 'default',
                  transition: 'background 0.2s',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Barangay */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                Barangay
              </label>
              <input
                type="text"
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                disabled={!editing}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: editing ? '#0a0a2e' : '#2a2a5e',
                  border: '1px solid #2a2a5e',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  cursor: editing ? 'text' : 'default',
                  transition: 'background 0.2s',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Action Buttons */}
            {editing && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#44ff44',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#666',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '12px',
            background: 'var(--sos-red, #ff4444)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            marginBottom: '20px',
          }}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.8')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
        >
          Logout
        </button>
      </div>

      {/* Bottom Spacing */}
      <div style={{ height: '32px' }} />
    </div>
  );
}
