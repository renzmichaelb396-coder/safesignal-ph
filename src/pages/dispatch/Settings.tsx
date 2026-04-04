import React, { useState, useEffect } from 'react';
import { dispatchApi } from '../../lib/api';
import DispatchLayout from './DispatchLayout';

interface Settings {
  surge_threshold: number;
  surge_window_minutes: number;
  cooldown_minutes: number;
  strike_limit: number;
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [formData, setFormData] = useState<Settings>({
    surge_threshold: 0,
    surge_window_minutes: 0,
    cooldown_minutes: 0,
    strike_limit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await dispatchApi.getSettings();
      setSettings(response.settings);
      setFormData(response.settings);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Settings, value: number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSaveSuccess('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      await dispatchApi.updateSettings(formData);
      setSettings(formData);
      setHasChanges(false);
      setSaveSuccess('Settings saved successfully');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setFormData(settings);
      setHasChanges(false);
    }
  };

  const settingFields: Array<{
    key: keyof Settings;
    label: string;
    description: string;
    unit: string;
    min: number;
  }> = [
    {
      key: 'surge_threshold',
      label: 'Surge Threshold',
      description: 'Number of alerts to trigger surge mode',
      unit: 'alerts',
      min: 1,
    },
    {
      key: 'surge_window_minutes',
      label: 'Surge Window',
      description: 'Time window for counting alerts towards surge',
      unit: 'minutes',
      min: 1,
    },
    {
      key: 'cooldown_minutes',
      label: 'Cooldown Period',
      description: 'Time before a user can trigger another alert',
      unit: 'minutes',
      min: 1,
    },
    {
      key: 'strike_limit',
      label: 'Strike Limit',
      description: 'Number of false alarms before suspension',
      unit: 'strikes',
      min: 1,
    },
  ];

  return (
    <DispatchLayout>
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--dispatch-bg, #0d1117)',
        color: '#e6edf3',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '24px',
          borderBottom: '1px solid var(--dispatch-border, #30363d)',
        }}
      >
        <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600, color: 'var(--ph-gold, #ffc107)' }}>
          Settings
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
          Configure system parameters and thresholds
        </p>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px', maxWidth: '800px' }}>
        {error && (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid var(--sos-red, #f85149)',
              borderRadius: '6px',
              color: 'var(--sos-red, #f85149)',
              fontSize: '13px',
              marginBottom: '24px',
            }}
          >
            {error}
          </div>
        )}

        {saveError && (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid var(--sos-red, #f85149)',
              borderRadius: '6px',
              color: 'var(--sos-red, #f85149)',
              fontSize: '13px',
              marginBottom: '24px',
            }}
          >
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid #4caf50',
              borderRadius: '6px',
              color: '#4caf50',
              fontSize: '13px',
              marginBottom: '24px',
            }}
          >
            {saveSuccess}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <p style={{ fontSize: '14px' }}>Loading settings...</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            {/* Settings Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {settingFields.map(({ key, label, description, unit, min }) => (
                <div key={key}>
                  <label
                    htmlFor={key}
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--dispatch-border, #c9d1d9)',
                      marginBottom: '6px',
                    }}
                  >
                    {label}
                  </label>
                  <p
                    style={{
                      margin: '0 0 10px 0',
                      fontSize: '12px',
                      color: '#94a3b8',
                    }}
                  >
                    {description}
                  </p>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      id={key}
                      type="number"
                      min={min}
                      value={formData[key]}
                      onChange={(e) => handleChange(key, parseInt(e.target.value) || 0)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        fontSize: '13px',
                        backgroundColor: 'var(--dispatch-border, #161b22)',
                        border: '1px solid var(--dispatch-border, #30363d)',
                        borderRadius: '6px',
                        color: '#e6edf3',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--ph-gold, #ffc107)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
                      }}
                    />
                    <span
                      style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        minWidth: '60px',
                      }}
                    >
                      {unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Info Box */}
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--dispatch-border, #161b22)',
                border: '1px solid var(--dispatch-border, #30363d)',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#94a3b8',
                lineHeight: '1.6',
              }}
            >
              <p style={{ margin: '0 0 12px 0', fontWeight: 600 }}>About These Settings</p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <li>
                  <strong>Surge Threshold:</strong> Activates surge mode when this many alerts are received
                </li>
                <li>
                  <strong>Surge Window:</strong> The time period used to count alerts for surge detection
                </li>
                <li>
                  <strong>Cooldown Period:</strong> Minimum time a user must wait between alert triggers
                </li>
                <li>
                  <strong>Strike Limit:</strong> Number of false alarms that lead to account suspension
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasChanges || saving}
                style={{
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#e6edf3',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--dispatch-border, #30363d)',
                  borderRadius: '6px',
                  cursor: !hasChanges || saving ? 'not-allowed' : 'pointer',
                  opacity: !hasChanges || saving ? 0.5 : 1,
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                  fontVariantNumeric: 'tabular-nums',
                }}
                onMouseEnter={(e) => {
                  if (hasChanges && !saving) {
                    e.currentTarget.style.borderColor = '#94a3b8';
                    e.currentTarget.style.backgroundColor = 'rgba(139, 148, 158, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--dispatch-border, #30363d)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={!hasChanges || saving}
                style={{
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0d1117',
                  backgroundColor: 'var(--ph-gold, #ffc107)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: !hasChanges || saving ? 'not-allowed' : 'pointer',
                  opacity: !hasChanges || saving ? 0.6 : 1,
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => {
                  if (hasChanges && !saving) {
                    e.currentTarget.style.backgroundColor = '#ffb300';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--ph-gold, #ffc107)';
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
    </DispatchLayout>
  );
}
