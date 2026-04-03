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
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('safesignal_officer_token');
    const officerDataRaw = localStorage.getItem('safesignal_officer_data');
    const officerObj = officerDataRaw ? JSON.parse(officerDataRaw) : null;
    if (!token || !officerObj || officerObj.role !== 'OFFICER') {
      setLocation('/dispatch/login');
      return;
    }
    fetchAssignment();
    const interval = setInterval(fetchAssignment, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAssignment() {
    try {
      const res = await officerFetch('/api/officer/active-assignment');
      if (res.status === 401) {
        setLocation('/dispatch/login');
        return;
      }
      if (!res.ok) {
        setAssignment(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setAssignment(data.assignment || null);
      setLoading(false);
      if (data.assignment) {
        updateMap(data.assignment.lat, data.assignment.lng);
      }
    } catch (err) {
      // Network error or missing endpoint — show empty state, not error
      setAssignment(null);
      setLoading(false);
    }
  }
  function updateMap(lat: number, lng: number) {
    if (!(window as any).maplibregl) return;
    const maplibregl = (window as any).maplibregl;
    if (!mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = new maplibregl.Map({
        container: mapRef.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [lng, lat],
        zoom: 15,
      });
      mapInstanceRef.current.on('load', () => {
        markerRef.current = new maplibregl.Marker({ color: '#e63946' })
          .setLngLat([lng, lat])
          .addTo(mapInstanceRef.current);
      });
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({ center: [lng, lat], zoom: 15 });
      if (markerRef.current) markerRef.current.setLngLat([lng, lat]);
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
    } catch {
      setError('Failed to update status');
    }
    setUpdating(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', color: '#ffc107' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#fff', padding: '20px', fontFamily: 'sans-serif' }}>
      <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
      <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />

      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: '#ffc107', fontSize: 18 }}>Officer Dashboard</h2>
          <button
            onClick={() => { localStorage.removeItem('safesignal_officer_token'); localStorage.removeItem('safesignal_officer_role'); setLocation('/dispatch/login'); }}
            style={{ background: 'transparent', border: '1px solid #444', color: '#aaa', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            Logout
          </button>
        </div>

        {error && <div style={{ background: '#3d1a1a', border: '1px solid #e63946', borderRadius: 8, padding: 12, marginBottom: 16, color: '#ff6b6b', fontSize: 14 }}>{error}</div>}

        {!assignment ? (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>--</div>
            <div style={{ color: '#8b949e', fontSize: 16 }}>No active assignment</div>
            <div style={{ color: '#666', fontSize: 13, marginTop: 8 }}>Waiting for dispatch...</div>
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

            <div ref={mapRef} style={{ height: 220, borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: '#161b22', border: '1px solid #30363d' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              <button onClick={() => updateStatus('EN_ROUTE')} disabled={updating}
                style={{ background: assignment.status === 'EN_ROUTE' ? '#d97706' : '#1a1a2e', border: '1px solid #d97706', color: assignment.status === 'EN_ROUTE' ? '#fff' : '#d97706', padding: '10px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                EN ROUTE
              </button>
              <button onClick={() => updateStatus('ON_SCENE')} disabled={updating}
                style={{ background: assignment.status === 'ON_SCENE' ? '#ea580c' : '#1a1a2e', border: '1px solid #ea580c', color: assignment.status === 'ON_SCENE' ? '#fff' : '#ea580c', padding: '10px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                ON SCENE
              </button>
              <button onClick={() => updateStatus('RESOLVED')} disabled={updating}
                style={{ background: assignment.status === 'RESOLVED' ? '#16a34a' : '#1a1a2e', border: '1px solid #16a34a', color: assignment.status === 'RESOLVED' ? '#fff' : '#16a34a', padding: '10px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                RESOLVED
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
