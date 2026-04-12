import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';

function officerFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('safesignal_officer_token');
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers || {}),
    },
  });
}


function getStatusLabel(s: string) { switch(s) { case "ACTIVE": return "New Assignment"; case "ACKNOWLEDGED": return "Acknowledged"; case "EN_ROUTE": return "En Route"; case "ON_SCENE": return "On Scene"; case "RESOLVED": return "Resolved"; default: return s; } }
function getStatusColor(s: string) { switch(s) { case "ACTIVE": return "#e63946"; case "ACKNOWLEDGED": return "#3b82f6"; case "EN_ROUTE": return "#0ea5e9"; case "ON_SCENE": return "#f97316"; case "RESOLVED": return "#16a34a"; default: return "#8b949e"; } }

interface Assignment {
  id: number;
  citizenName: string;
  citizenPhone: string;
  lat: number;
  lng: number;
  address: string;
  status: string;
  createdAt: string;
}

export default function OfficerDashboard() {
  const [, setLocation] = useLocation();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [citizenAddress, setCitizenAddress] = useState('');
  const [officerName, setOfficerName] = useState('Officer');
  const [now, setNow] = useState(Date.now());
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const officerMarkerRef = useRef<any>(null);
  const officerLatLngRef = useRef<{lat: number; lng: number} | null>(null);
  const pendingCitizenRef = useRef<{lat: number; lng: number} | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevAssignmentIdRef = useRef<number | null>(null);
  const hasInitialLoadRef = useRef(false);
  const [toastMsg, setToastMsg] = useState('');
  const [soundArmed, setSoundArmed] = useState(false);
  const [dispositionNotes, setDispositionNotes] = useState('');

  useEffect(() => {
    if (assignment?.lat != null && assignment?.lng != null) {
      setCitizenAddress('');
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${assignment.lat}&lon=${assignment.lng}&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'en' } })
        .then(r => r.json()).then(data => { if (data.display_name) { setCitizenAddress(data.display_name.split(',').slice(0,4).map((s: string) => s.trim()).join(', ')); } }).catch(() => {});
    }
  }, [assignment?.lat, assignment?.lng]);

  // Live elapsed timer
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('safesignal_officer_token');
    const officerDataRaw = localStorage.getItem('safesignal_officer_data');
    const officerObj = officerDataRaw ? JSON.parse(officerDataRaw) : null;

    // Only read officer-specific keys — never read dispatch_user or dispatch_token here.
    // Dispatch session is managed by DispatchAuthContext and must not bleed into officer view.
    if (!token || !officerObj || officerObj.role !== 'OFFICER') {
      setLocation('/dispatch/login');
      return;
    }

    setOfficerName(officerObj?.full_name || officerObj?.name || 'Officer');
    fetchAssignment();
    loadMapLibre();
    // NOTE: do NOT call reportLocation() here — map isn't ready yet.
    // map.on('load') inside initMap() handles the first location report.
    const interval = setInterval(fetchAssignment, 5000);
    const locInterval = setInterval(reportLocation, 10000); // Report GPS every 10s after map ready
    return () => { clearInterval(interval); clearInterval(locInterval); };
  }, []);

  function showToast(msg: string) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500); }

  // Urgent siren alert played when officer receives a new assignment
  function playAssignmentAlert() {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      ctx.resume().catch(() => {}); // unblock browser autoplay policy
      const playTone = (startTime: number, freqHigh: number, freqLow: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freqHigh, startTime);
        osc.frequency.linearRampToValueAtTime(freqLow, startTime + dur);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.7, startTime + 0.02);
        gain.gain.setValueAtTime(0.7, startTime + dur - 0.05);
        gain.gain.linearRampToValueAtTime(0, startTime + dur);
        osc.start(startTime); osc.stop(startTime + dur);
      };
      const t = ctx.currentTime;
      // 4 cycles — louder and more urgent than dispatch beep
      playTone(t,        1100, 700, 0.3);
      playTone(t + 0.38, 1100, 700, 0.3);
      playTone(t + 0.76, 1100, 700, 0.3);
      playTone(t + 1.14, 1100, 700, 0.3);
    } catch {}
  }

  // Report officer's GPS location to dispatch + update own marker on map
  async function reportLocation() {
    try {
      if (!navigator.geolocation) {
        // No geolocation — use demo Pasay coords
        updateOfficerMarker(14.5400, 121.0010);
        officerFetch('/api/dispatch/officer-location', {
          method: 'POST',
          body: JSON.stringify({ lat: 14.5400, lng: 121.0010, heading: null, status: 'ON_DUTY' }),
        }).catch(() => {});
        return;
      }
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        officerLatLngRef.current = { lat, lng };
        updateOfficerMarker(lat, lng);
        try {
          await officerFetch('/api/dispatch/officer-location', {
            method: 'POST',
            body: JSON.stringify({
              lat,
              lng,
              heading: pos.coords.heading || null,
              status: 'ON_DUTY',
            }),
          });
        } catch {}
      }, () => {
        // Geolocation denied — use demo Pasay location
        const lat = 14.5400;
        const lng = 121.0010;
        officerLatLngRef.current = { lat, lng };
        updateOfficerMarker(lat, lng);
        officerFetch('/api/dispatch/officer-location', {
          method: 'POST',
          body: JSON.stringify({ lat, lng, heading: null, status: 'ON_DUTY' }),
        }).catch(() => {});
      }, { enableHighAccuracy: true, timeout: 5000 });
    } catch {}
  }

  // Update officer's own GPS marker on map (blue dot)
  function updateOfficerMarker(lat: number, lng: number) {
    if (!mapInstanceRef.current) return;
    const maplibregl = (window as any).maplibregl;
    if (!maplibregl) return;
    if (officerMarkerRef.current) {
      officerMarkerRef.current.setLngLat([lng, lat]);
    } else {
      const el = document.createElement('div');
      el.style.cssText = 'width:18px;height:18px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(59,130,246,0.8);cursor:default';
      el.title = 'Your location';
      officerMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(mapInstanceRef.current);
    }
  }

  function loadMapLibre() {
    // Load CSS
    if (!document.getElementById('maplibre-css')) {
      const link = document.createElement('link');
      link.id = 'maplibre-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }
    // Load JS
    if (!(window as any).maplibregl) {
      if (!document.getElementById('maplibre-js')) {
        const script = document.createElement('script');
        script.id = 'maplibre-js';
        script.src = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js';
        script.onload = () => initMap();
        document.head.appendChild(script);
      }
    } else {
      initMap();
    }
  }

  function initMap() {
    const checkMapLibre = setInterval(() => {
      if ((window as any).maplibregl && mapRef.current && !mapInstanceRef.current) {
        clearInterval(checkMapLibre);
        const maplibregl = (window as any).maplibregl;
        const PASAY_CENTER: [number, number] = [120.9982, 14.5378];
        mapInstanceRef.current = new maplibregl.Map({
          container: mapRef.current,
          style: 'https://tiles.openfreemap.org/styles/liberty',
          center: PASAY_CENTER,
          zoom: 14,
        });
        // Place the blue dot immediately once the map is ready
        mapInstanceRef.current.on('load', () => {
          reportLocation();
          if (pendingCitizenRef.current) { const { lat, lng } = pendingCitizenRef.current; pendingCitizenRef.current = null; updateMap(lat, lng); }
        });
      }
    }, 200);
    setTimeout(() => clearInterval(checkMapLibre), 10000);
  }

  async function fetchAssignment() {
    try {
      const res = await officerFetch('/api/officer/active-assignment');
      if (res.status === 401) { setLocation('/dispatch/login'); return; }
      if (!res.ok) { setAssignment(null); setLoading(false); return; }
      const data = await res.json();
      const incoming = data.assignment || null;
      // New assignment arrived — play urgent alert sound
      if (incoming && prevAssignmentIdRef.current !== incoming.id) {
        if (hasInitialLoadRef.current) {
          // Only play after first poll completes — avoids sound on page open
          playAssignmentAlert();
          showToast('🚨 New Assignment Received!');
        }
        prevAssignmentIdRef.current = incoming.id;
      } else if (!incoming) {
        prevAssignmentIdRef.current = null;
      }
      hasInitialLoadRef.current = true;
      setAssignment(incoming);
      setLoading(false);
      if (incoming) updateMap(incoming.lat, incoming.lng);
    } catch {
      setAssignment(null);
      setLoading(false);
    }
  }

  function updateMap(lat: number, lng: number) {
    if (!mapInstanceRef.current) { pendingCitizenRef.current = { lat, lng }; return; }
    const maplibregl = (window as any).maplibregl;
    mapInstanceRef.current.flyTo({ center: [lng, lat], zoom: 16 });
    if (markerRef.current) { markerRef.current.setLngLat([lng, lat]); } else {
      const popup = new maplibregl.Popup({ offset: 36, closeOnClick: false, className: 'sos-popup' }).setHTML(
        '<div style="background:#7f0000;color:#fff;padding:8px 12px;border-radius:6px;font-weight:700;font-size:13px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.6);">🚨 SOS — Citizen Location</div>'
      );
      // Pulsing red circle — matches dispatch dashboard citizen dot style
      const sosEl = document.createElement('div');
      sosEl.style.cssText = 'position:relative;width:44px;height:44px;';
      sosEl.innerHTML = `
        <style>
          @keyframes sosPulseOfficer {
            0%   { transform:translate(-50%,-50%) scale(0.4); opacity:1; }
            100% { transform:translate(-50%,-50%) scale(2.2); opacity:0; }
          }
        </style>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:rgba(230,57,70,0.15);animation:sosPulseOfficer 1.6s ease-out infinite;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:rgba(230,57,70,0.28);animation:sosPulseOfficer 1.6s ease-out infinite 0.4s;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#E63946;border:3px solid #fff;box-shadow:0 2px 10px rgba(230,57,70,0.8);"></div>
      `;
      markerRef.current = new maplibregl.Marker({ element: sosEl }).setLngLat([lng, lat]).setPopup(popup).addTo(mapInstanceRef.current);
      markerRef.current.togglePopup();
    }
  }

  async function updateStatus(status: string, notes?: string) {
    if (!assignment) return;
    setUpdating(true);
    try {
      const res = await officerFetch('/api/officer/assignment/' + assignment.id + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status, notes: notes || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error || 'Update failed (' + res.status + ')');
      }
      await fetchAssignment();
      showToast('✅ Status updated to ' + getStatusLabel(status));
    } catch(e: any) { setError(e.message || 'Failed to update status. Try again.'); }
    setUpdating(false);
  }

  function handleLogout() {
    // Only clear officer-specific keys — never touch dispatch_user or dispatch_token.
    // Dispatch session is independent and must survive an officer logout.
    localStorage.removeItem('safesignal_officer_token');
    localStorage.removeItem('safesignal_officer_role');
    localStorage.removeItem('safesignal_officer_data');
    setLocation('/dispatch/login');
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', color: '#ffc107' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {toastMsg && (<div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#1a472a', border: '1px solid #3fb950', color: '#4ade80', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, zIndex: 9999, whiteSpace: 'nowrap' }}>{toastMsg}</div>)}

      {/* Header */}
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #30363d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/pasay-police-badge.svg" alt="PNP" style={{ width: 36, height: 36, filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.3))' }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: '#e6edf3' }}>Field Officer View</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#ffc107' }}>{officerName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => {
                  if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
                  audioCtxRef.current.resume().catch(() => {});
                  setSoundArmed(true);
                }}
                title={soundArmed ? 'Alert sounds armed' : 'Tap to enable alert sounds'}
                style={{ background: soundArmed ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${soundArmed ? 'rgba(34,197,94,0.35)' : '#30363d'}`, borderRadius: 6, color: soundArmed ? '#22c55e' : '#6b7280', fontSize: 14, padding: '2px 8px', cursor: 'pointer', lineHeight: '1.6' }}
              >
                {soundArmed ? '🔔' : '🔕'}
              </button>
              <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Logout</button>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '16px' }}>
        <div ref={mapRef} style={{ height: 340, borderRadius: 10, overflow: 'hidden', border: '1px solid #30363d', background: '#161b22', marginBottom: 12 }} />

        <div style={{ display: 'flex', gap: 16, padding: '4px', marginBottom: 4, fontSize: 11, color: '#8b949e' }}><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#e63946', marginRight: 4 }} />SOS</span><span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', marginRight: 4 }} />You</span></div>
        {/* Location sharing status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderBottom: '1px solid #30363d', marginBottom: 20 }}>
          <span style={{ color: '#3fb950', fontSize: 14 }}>📍</span>
          <span style={{ color: '#3fb950', fontSize: 13, fontWeight: 500 }}>Sharing your location with dispatch</span>
        </div>

        {error && <div style={{ background: '#3d1a1a', border: '1px solid #e63946', borderRadius: 8, padding: 12, marginBottom: 16, color: '#ff6b6b', fontSize: 14 }}>{error}</div>}

        {!assignment ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎯</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 8 }}>No active assignment</div>
            <div style={{ color: '#8b949e', fontSize: 14 }}>Waiting for dispatch...</div>
          </div>
        ) : (
          <div>
            {/* Citizen info card matching Manus reference */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              {/* Header row: avatar + name + status badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {assignment.citizenName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#e6edf3' }}>{assignment.citizenName}</div>
                  <a href={'tel:' + assignment.citizenPhone} style={{ color: '#3fb950', fontSize: 13, textDecoration: 'none' }}>{assignment.citizenPhone}</a>
                </div>
                <span style={{ background: getStatusColor(assignment.status), color: '#fff', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{getStatusLabel(assignment.status)}</span>
              </div>

              {/* Location — show reverse-geocoded address, fall back to DB address, then barangay */}
              <div style={{ fontSize: 14, color: '#3fb950', marginBottom: 4 }}>
                {String.fromCodePoint(0x1F4CD)} {citizenAddress || assignment.address || (assignment as any).barangay || 'Locating...'}
              </div>
              {citizenAddress && (assignment.address || (assignment as any).barangay) && (
                <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>
                  {(assignment as any).barangay || assignment.address}
                </div>
              )}

              {/* Elapsed time */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>ELAPSED</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#e6edf3' }}>
                  {(() => {
                    const raw = assignment.createdAt;
                    const ts = Number(raw) || new Date(String(raw)).getTime();
                    const diff = Math.max(0, Math.floor((now - ts) / 1000));
                    const h = Math.floor(diff / 3600);
                    const m = Math.floor((diff % 3600) / 60);
                    const s = diff % 60;
                    return (h > 0 ? h + 'h  ' : '') + m + 'm  ' + s + 's';
                  })()}
                </div>
              </div>

              {/* Coordinates */}
              {assignment.lat != null && assignment.lng != null && (
                <div>
                  <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>
                    {Number(assignment.lat).toFixed(6)}, {Number(assignment.lng).toFixed(6)}
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${assignment.lat},${assignment.lng}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#58a6ff', fontSize: 13, textDecoration: 'none' }}
                  >
                    {String.fromCodePoint(0x1F4CD)} Open in Google Maps
                  </a>
                </div>
              )}
            </div>

            {assignment.status === 'ACTIVE' && (<button onClick={() => updateStatus('ACKNOWLEDGED')} disabled={updating} style={{ width: '100%', padding: '18px', borderRadius: 10, marginBottom: 8, background: '#1e40af', border: '2px solid #3b82f6', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>✅ Acknowledge Assignment</button>)}
            {assignment.status === 'ACKNOWLEDGED' && (<button onClick={() => updateStatus('EN_ROUTE')} disabled={updating} style={{ width: '100%', padding: '18px', borderRadius: 10, marginBottom: 8, background: '#0c4a6e', border: '2px solid #0ea5e9', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>{String.fromCodePoint(0x1F694)} En Route to Citizen</button>)}
            {assignment.status === 'EN_ROUTE' && (<><div style={{ background: '#0c4a6e22', border: '1px solid #0ea5e9', borderRadius: 8, padding: '8px 14px', marginBottom: 10, fontSize: 13, color: '#7dd3fc' }}>{String.fromCodePoint(0x1F694)} En Route</div><button onClick={() => updateStatus('ON_SCENE')} disabled={updating} style={{ width: '100%', padding: '18px', borderRadius: 10, marginBottom: 8, background: '#7c2d12', border: '2px solid #f97316', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>{String.fromCodePoint(0x1F6A8)} Arrived - On Scene</button></>)}
            {assignment.status === 'ON_SCENE' && (<><div style={{ background: '#f9731622', border: '1px solid #f97316', borderRadius: 8, padding: '8px 14px', marginBottom: 10, fontSize: 13, color: '#fdba74' }}>{String.fromCodePoint(0x1F6A8)} On Scene</div><div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px', marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1, fontWeight: 600 }}>Disposition / Action Taken</label><textarea value={dispositionNotes} onChange={e => setDispositionNotes(e.target.value)} placeholder="Describe action taken (e.g. arrested suspect, provided first aid, referred to hospital...)" rows={3} style={{ width: '100%', padding: '10px 12px', fontSize: 13, backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', resize: 'vertical' as const, boxSizing: 'border-box' as const, fontFamily: 'inherit' }} /></div><button onClick={() => updateStatus('RESOLVED', dispositionNotes)} disabled={updating} style={{ width: '100%', padding: '18px', borderRadius: 10, marginBottom: 8, background: '#14532d', border: '2px solid #16a34a', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>✅ Mark as Resolved</button></>)}
            {assignment.status === 'RESOLVED' && (<div style={{ background: '#14532d33', border: '1px solid #16a34a', borderRadius: 10, padding: 16, marginBottom: 8, textAlign: 'center' }}><div style={{ fontSize: 24 }}>✅</div><div style={{ color: '#4ade80', fontWeight: 700 }}>Case Resolved</div><div style={{ color: '#8b949e', fontSize: 12 }}>Waiting for next assignment...</div></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
