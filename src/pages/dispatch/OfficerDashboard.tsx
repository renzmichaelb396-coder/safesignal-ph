import React, { useEffect, useState, useRef } from 'react';
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
  const [officerName, setOfficerName] = useState('Officer');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('safesignal_officer_token');
    const officerDataRaw = localStorage.getItem('safesignal_officer_data');
    const dispatchUser = localStorage.getItem('dispatch_user');
    const officerObj = officerDataRaw ? JSON.parse(officerDataRaw) : null;
    const dispatchObj = dispatchUser ? JSON.parse(dispatchUser) : null;

    if (!token || !officerObj || officerObj.role !== 'OFFICER') {
      setLocation('/dispatch/login');
      return;
    }

    setOfficerName(dispatchObj?.full_name || officerObj?.full_name || officerObj?.name || 'Officer');
    fetchAssignment();
    loadMapLibre();
    const interval = setInterval(fetchAssignment, 10000);
    return () => clearInterval(interval);
  }, []);

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
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '\u00a9 OpenStreetMap contributors',
              },
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
          },
          center: PASAY_CENTER,
          zoom: 14,
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
      setAssignment(data.assignment || null);
      setLoading(false);
      if (data.assignment) updateMap(data.assignment.lat, data.assignment.lng);
    } catch {
      setAssignment(null);
      setLoading(false);
    }
  }

  function updateMap(lat: number, lng: number) {
    if (!mapInstanceRef.current) return;
    const maplibregl = (window as any).maplibregl;
    mapInstanceRef.current.flyTo({ center: [lng, lat], zoom: 15 });
    if (markerRef.current) markerRef.current.setLngLat([lng, lat]);
    else {
      markerRef.current = new maplibregl.Marker({ color: '#e63946' })
        .setLngLat([lng, lat])
        .addTo(mapInstanceRef.current);
    }
  }

  async function updateStatus(status: string) {
    if (!assignment) return;
    setUpdating(true);
    try {
      await officerFetch('/api/officer/assignment/' + assignment.id + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await fetchAssignment();
    } catch { setError('Failed to update status'); }
    setUpdating(false);
  }

  function handleLogout() {
    localStorage.removeItem('safesignal_officer_token');
    localStorage.removeItem('safesignal_officer_role');
    localStorage.removeItem('safesignal_officer_data');
    localStorage.removeItem('dispatch_user');
    localStorage.removeItem('dispatch_token');
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
      {/* Header */}
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #30363d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/pasay-police-badge.svg" alt="PNP" style={{ width: 36, height: 36, filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.3))' }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: '#e6edf3' }}>Field Officer View</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#ffc107' }}>{officerName}</div>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Logout</button>
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '16px' }}>
        <div ref={mapRef} style={{ height: 260, borderRadius: 10, overflow: 'hidden', border: '1px solid #30363d', background: '#161b22', marginBottom: 12 }} />

        {/* Location sharing status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderBottom: '1px solid #30363d', marginBottom: 20 }}>
          <span style={{ color: '#3fb950', fontSize: 14 }}>{String.fromCodePoint(0x1F4CD)}</span>
          <span style={{ color: '#3fb950', fontSize: 13, fontWeight: 500 }}>Sharing your location with dispatch</span>
        </div>

        {error && <div style={{ background: '#3d1a1a', border: '1px solid #e63946', borderRadius: 8, padding: 12, marginBottom: 16, color: '#ff6b6b', fontSize: 14 }}>{error}</div>}

        {!assignment ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{String.fromCodePoint(0x1F3AF)}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 8 }}>No active assignment</div>
            <div style={{ color: '#8b949e', fontSize: 14 }}>Waiting for dispatch...</div>
          </div>
        ) : (
          <div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{assignment.citizenName}</div>
                  <div style={{ color: '#8b949e', fontSize: 13, marginTop: 2 }}>{assignment.citizenPhone}</div>
                </div>
                <span style={{ background: '#1a3a2a', color: '#3fb950', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {assignment.status}
                </span>
              </div>
              <div style={{ color: '#ccc', fontSize: 13 }}>{assignment.address}</div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                {new Date(assignment.createdAt).toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              <button onClick={() => updateStatus('EN_ROUTE')} disabled={updating} style={{ background: assignment.status === 'EN_ROUTE' ? '#d97706' : '#161b22', border: '1px solid #d97706', color: assignment.status === 'EN_ROUTE' ? '#fff' : '#d97706', padding: '12px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const }}>
                En Route
              </button>
              <button onClick={() => updateStatus('ON_SCENE')} disabled={updating} style={{ background: assignment.status === 'ON_SCENE' ? '#ea580c' : '#161b22', border: '1px solid #ea580c', color: assignment.status === 'ON_SCENE' ? '#fff' : '#ea580c', padding: '12px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const }}>
                On Scene
              </button>
              <button onClick={() => updateStatus('RESOLVED')} disabled={updating} style={{ background: assignment.status === 'RESOLVED' ? '#16a34a' : '#161b22', border: '1px solid #16a34a', color: assignment.status === 'RESOLVED' ? '#fff' : '#16a34a', padding: '12px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const }}>
                Resolved
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
