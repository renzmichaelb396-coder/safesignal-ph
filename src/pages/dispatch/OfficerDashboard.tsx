import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';

interface Assignment {
    alert_id: number;
    alert_type: string;
    description: string;
    triggered_at: number;
    assignment_status: 'assigned' | 'en_route' | 'on_scene' | 'resolved';
    citizen: { full_name: string; phone_number: string; trust_score: number };
    citizen_location: { lat: number; lng: number; updated_at: number } | null;
}

interface HistoryEntry {
    id: number;
    alert_id: number;
    citizen_name: string;
    alert_type: string;
    triggered_at: number;
    resolved_at: number | null;
    response_time_minutes: number | null;
    status: string;
}

function getOfficerToken(): string | null {
    return localStorage.getItem('safesignal_officer_token');
}

async function officerFetch(path: string, options: RequestInit = {}): Promise<any> {
    const token = getOfficerToken();
    const res = await fetch(path, {
          ...options,
          headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  ...(options.headers || {}),
          },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

export default function OfficerDashboard() {
    const { officer, loading } = useDispatchAuth();
    const [, navigate] = useLocation();
    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [view, setView] = useState<'map' | 'history'>('map');
    const [updating, setUpdating] = useState(false);
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const citizenMarkerRef = useRef<any>(null);
    const assignmentRef = useRef<Assignment | null>(null);
    assignmentRef.current = assignment;

  useEffect(() => {
        if (loading) return;
        if (!officer || (officer as any).role !== 'OFFICER') {
                navigate('/dispatch/login');
        }
  }, [loading, officer]);

  useEffect(() => {
        if (!officer) return;
        loadAll();
        postLocation();
        const interval = setInterval(() => {
                loadAll();
                postLocation();
        }, 10000);
        return () => clearInterval(interval);
  }, [officer]);

  useEffect(() => {
        if (!document.getElementById('maplibre-css')) {
                const link = document.createElement('link');
                link.id = 'maplibre-css';
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css';
                document.head.appendChild(link);
        }
  }, []);

  useEffect(() => {
        if (view !== 'map' || !mapRef.current) return;
        const initMap = () => {
                if (mapInstanceRef.current) return;
                const ml = (window as any).maplibregl;
                if (!ml) return;
                mapInstanceRef.current = new ml.Map({
                          container: mapRef.current!,
                          style: 'https://tiles.openfreemap.org/styles/liberty',
                          center: [120.9932, 14.5378],
                          zoom: 15,
                });
                mapInstanceRef.current.addControl(new ml.NavigationControl(), 'top-left');
                if (assignmentRef.current?.citizen_location) {
                          placeCitizenMarker(assignmentRef.current.citizen_location, ml);
                }
        };
        if (!(window as any).maplibregl) {
                if (!document.getElementById('maplibre-js')) {
                          const s = document.createElement('script');
                          s.id = 'maplibre-js';
                          s.src = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js';
                          s.onload = initMap;
                          document.head.appendChild(s);
                }
        } else {
                setTimeout(initMap, 50);
        }
  }, [view]);

  useEffect(() => {
        if (!mapInstanceRef.current || !assignment?.citizen_location) return;
        const ml = (window as any).maplibregl;
        if (ml) placeCitizenMarker(assignment.citizen_location, ml);
  }, [assignment?.citizen_location?.lat, assignment?.citizen_location?.lng]);

  function placeCitizenMarker(loc: { lat: number; lng: number }, ml: any) {
        if (citizenMarkerRef.current) citizenMarkerRef.current.remove();
        const el = document.createElement('div');
        el.style.cssText = 'width:22px;height:22px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 0 0 4px rgba(239,68,68,0.35)';
        citizenMarkerRef.current = new ml.Marker({ element: el })
          .setLngLat([loc.lng, loc.lat])
          .setPopup(new ml.Popup().setHTML('<b style="color:#ef4444">Citizen needs help</b>'))
          .addTo(mapInstanceRef.current);
        mapInstanceRef.current.flyTo({ center: [loc.lng, loc.lat], zoom: 16, duration: 800 });
  }

  async function loadAll() {
        try {
                const [aData, hData] = await Promise.all([
                          officerFetch('/api/officer/active-assignment'),
                          officerFetch('/api/officer/assignment-history'),
                        ]);
                setAssignment(aData.assignment || null);
                setHistory(hData.history || []);
        } catch (e) {
                console.error('Officer loadAll error', e);
        }
  }

  function postLocation() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                          await officerFetch('/api/officer/location-update', {
                                      method: 'POST',
                                      body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                          });
                } catch { /* silent */ }
        });
  }

  async function updateStatus(status: string) {
        if (!assignment) return;
        setUpdating(true);
        try {
                await officerFetch(`/api/officer/assignment/${assignment.alert_id}/status`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status }),
                });
                await loadAll();
        } catch (e) {
                console.error('updateStatus error', e);
        } finally {
                setUpdating(false);
        }
  }

  const statusColors: Record<string, string> = {
        assigned: '#3b82f6',
        en_route: '#f59e0b',
        on_scene: '#f97316',
        resolved: '#22c55e',
  };

  if (loading) {
        return (
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', color: '#ffc107' }}>
                          Loading...
                </div>div>
              );
  }

  return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <img src="/pasay-police-badge.svg" alt="badge" style={{ width: 30, height: 30 }} />
                                      <div>
                                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ffc107' }}>Officer Field View</div>div>
                                                  <div style={{ fontSize: 11, color: '#8b949e' }}>{(officer as any)?.full_name || 'Officer'}</div>div>
                                      </div>div>
                          </div>div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(['map', 'history'] as const).map(v => (
                      <button key={v} onClick={() => setView(v)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: view === v ? '#1d4ed8' : 'transparent', color: view === v ? '#fff' : '#8b949e', border: '1px solid #30363d', cursor: 'pointer' }}>
                        {v === 'map' ? 'Map' : 'History'}
                      </button>button>
                    ))}
                        </div>div>
                </div>div>
        
          {view === 'history' && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                            <h3 style={{ color: '#ffc107', margin: '0 0 12px' }}>My Assignments</h3>h3>
                    {history.length === 0 ? (
                                <p style={{ color: '#8b949e', textAlign: 'center', marginTop: 40 }}>No history yet</p>p>
                              ) : history.map(h => (
                                <div key={h.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                              <span style={{ fontSize: 13, fontWeight: 600 }}>{h.citizen_name}</span>span>
                                                              <span style={{ fontSize: 11, color: h.status === 'resolved' ? '#22c55e' : '#f59e0b' }}>{h.status.toUpperCase()}</span>span>
                                              </div>div>
                                              <div style={{ fontSize: 12, color: '#8b949e' }}>
                                                {h.alert_type} &middot; {h.response_time_minutes != null ? `${h.response_time_minutes}m response` : 'Ongoing'}
                                              </div>div>
                                </div>div>
                              ))}
                  </div>div>
              )}
        
          {view === 'map' && (
                  <>
                            <div style={{ flex: '0 0 60%', position: 'relative', overflow: 'hidden', background: '#0d1117' }}>
                              {!assignment ? (
                                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                                  <img src="/pasay-police-badge.svg" alt="badge" style={{ width: 72, height: 72, opacity: 0.35 }} />
                                                  <div style={{ color: '#8b949e', fontSize: 15, fontWeight: 600 }}>No Active Assignment</div>div>
                                                  <div style={{ color: '#484f58', fontSize: 12 }}>Waiting for dispatch...</div>div>
                                  </div>div>
                                ) : (
                                  <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                                )}
                            </div>div>
                  
                            <div style={{ flex: '0 0 40%', borderTop: '1px solid #30363d', overflowY: 'auto', padding: 16 }}>
                              {!assignment ? (
                                  <p style={{ color: '#484f58', fontSize: 13, textAlign: 'center' }}>Stand by - you will be notified when assigned.</p>p>
                                ) : (
                                  <>
                                                  <div style={{ background: '#161b22', border: `1px solid ${statusColors[assignment.assignment_status] ?? '#30363d'}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                                                        <span style={{ fontSize: 11, fontWeight: 700, color: statusColors[assignment.assignment_status], textTransform: 'uppercase' }}>
                                                                                          {assignment.assignment_status.replace('_', ' ')}
                                                                                          </span>span>
                                                                                        <span style={{ fontSize: 11, color: '#8b949e' }}>{assignment.alert_type}</span>span>
                                                                    </div>div>
                                                                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{assignment.citizen.full_name}</div>div>
                                                                    <div style={{ fontSize: 12, color: '#8b949e', marginBottom: assignment.description ? 6 : 0 }}>{assignment.citizen.phone_number}</div>div>
                                                    {assignment.description && <div style={{ fontSize: 12, color: '#cdd9e5' }}>{assignment.description}</div>div>}
                                                  </div>div>
                                  
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {assignment.assignment_status === 'assigned' && (
                                                        <button disabled={updating} onClick={() => updateStatus('en_route')}
                                                                                style={{ minHeight: 56, borderRadius: 10, fontSize: 15, fontWeight: 700, border: 'none', cursor: updating ? 'not-allowed' : 'pointer', background: '#d97706', color: '#fff', opacity: updating ? 0.6 : 1 }}>
                                                                              EN ROUTE
                                                        </button>button>
                                                                    )}
                                                    {assignment.assignment_status === 'en_route' && (
                                                        <button disabled={updating} onClick={() => updateStatus('on_scene')}
                                                                                style={{ minHeight: 56, borderRadius: 10, fontSize: 15, fontWeight: 700, border: 'none', cursor: updating ? 'not-allowed' : 'pointer', background: '#ea580c', color: '#fff', opacity: updating ? 0.6 : 1 }}>
                                                                              ON SCENE
                                                        </button>button>
                                                                    )}
                                                    {(assignment.assignment_status === 'en_route' || assignment.assignment_status === 'on_scene') && (
                                                        <button disabled={updating} onClick={() => updateStatus('resolved')}
                                                                                style={{ minHeight: 56, borderRadius: 10, fontSize: 15, fontWeight: 700, border: 'none', cursor: updating ? 'not-allowed' : 'pointer', background: '#16a34a', color: '#fff', opacity: updating ? 0.6 : 1 }}>
                                                                              RESOLVED
                                                        </button>button>
                                                                    )}
                                                    {assignment.assignment_status === 'resolved' && (
                                                        <div style={{ textAlign: 'center', color: '#22c55e', fontWeight: 700, padding: 16, fontSize: 14 }}>
                                                                              Assignment Resolved
                                                        </div>div>
                                                                    )}
                                                  </div>div>
                                  </>>
                                )}
                            </div>div>
                  </>>
                )}
        </div>div>
      );
}</></></div>
