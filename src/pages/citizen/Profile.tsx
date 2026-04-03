import { useCitizenAuth } from '../../contexts/CitizenAuthContext';
import { useLocation } from 'wouter';
import { getInitials } from '../../lib/api';

export default function Profile() {
  const { citizen, logout } = useCitizenAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation('/');
  };

  if (!citizen) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--citizen-bg, #0a0a2e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#fff' }}>Loading...</p>
      </div>
    );
  }

  const trustScore = citizen.trust?.score ?? 0;
  const totalAlerts = citizen.trust?.total_alerts ?? 0;
  const falseAlarms = citizen.trust?.false_alarms ?? 0;
  const resolvedEmergencies = citizen.trust?.resolved_emergencies ?? 0;
  const strikeCount = citizen.strike_count ?? 0;

  const getTrustLabel = (score: number) => {
    if (score >= 80) return 'Trusted Citizen';
    if (score >= 60) return 'Good Standing';
    if (score >= 40) return 'Fair Standing';
    return 'Needs Improvement';
  };

  const getStrikeMessage = (strikes: number) => {
    if (strikes === 0) return 'No strikes — great record!';
    if (strikes === 1) return '1 strike — be careful';
    if (strikes === 2) return '2 strikes — final warning';
    return '3 strikes — account suspended';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--citizen-bg, #0a0a2e)', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <a href="/home" style={{ color: '#fff', textDecoration: 'none', fontSize: 20 }}>←</a>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>My Profile</h1>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Profile Card */}
        <div style={{ background: '#1a1a3e', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1e4c8f 0%, #ffc72c 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {getInitials(citizen.full_name)}
          </div>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 700 }}>{citizen.full_name}</h2>
            <p style={{ margin: '0 0 2px 0', fontSize: 13, color: '#888' }}>{citizen.phone}</p>
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
              {citizen.barangay ? `Barangay ${citizen.barangay}, Pasay City` : 'Pasay City'}
            </p>
          </div>
        </div>

        {/* Trust Score */}
        <div style={{ background: '#1a1a3e', borderRadius: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 700 }}>Trust Score</h3>

          {/* Semicircular gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ position: 'relative', width: 160, height: 100 }}>
              <svg width="160" height="100" viewBox="0 0 160 100">
                <path
                  d="M 10 90 A 70 70 0 0 1 150 90"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M 10 90 A 70 70 0 0 1 150 90"
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(trustScore / 100) * 220} 220`}
                />
              </svg>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center' }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: '#4ade80' }}>{trustScore}</span>
                <span style={{ fontSize: 14, color: '#888' }}> / 100</span>
              </div>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: 14, fontWeight: 600, color: '#4ade80' }}>
              {getTrustLabel(trustScore)}
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div style={{ background: '#0a0a2e', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 700, color: '#60a5fa' }}>{totalAlerts}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#888' }}>Total Alerts</p>
            </div>
            <div style={{ background: '#0a0a2e', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 700, color: '#4ade80' }}>{resolvedEmergencies}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#888' }}>Resolved</p>
            </div>
            <div style={{ background: '#0a0a2e', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 700, color: '#f87171' }}>{falseAlarms}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#888' }}>False Alarms</p>
            </div>
          </div>
        </div>

        {/* Strike Record */}
        <div style={{ background: '#1a1a3e', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Strike Record</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: i < strikeCount ? '#ef4444' : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{getStrikeMessage(strikeCount)}</p>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: 'var(--sos-red, #e63946)', border: 'none',
            color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
