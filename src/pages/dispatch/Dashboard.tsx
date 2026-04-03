import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useDispatchAuth } from '../../contexts/DispatchAuthContext';
import { dispatchApi, formatElapsed, getInitials } from '../../lib/api';
import AlertDetailModal from './AlertDetailModal';
import DispatchLayout from './DispatchLayout';

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { officer, loading } = useDispatchAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [surgeWarning, setSurgeWarning] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [clock, setClock] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevAlertIdsRef = useRef<Set<number>>(new Set());

  // Live timer + PST clock
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      setClock(new Date().toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load MapLibre GL CSS
  useEffect(() => {
    if (!document.getElementById('maplibre-css')) {
      const link = document.createElement('link');
      link.id = 'maplibre-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }
  }, []);

  // Fetch initial alerts
  useEffect(() => {
    if (!officer) return;
    fetchAlerts();
  }, [officer]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !officer) return;

    const initMap = () => {
      if (leafletMapRef.current) return;
      const maplibregl = (window as any).maplibregl;
      if (!maplibregl) return;
      // Fix blank tiles on Vercel: use CDN worker instead of blob URL
      if (!maplibregl.workerUrl) maplibregl.workerUrl = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl-csp-worker.js';

      leafletMapRef.current = new maplibregl.Map({
        container: mapRef.current!,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [120.9932, 14.5378],
        zoom: 14,
      });

      // Station marker
      const el = document.createElement('div');
      el.innerHTML = '<div style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))">⭐</div>';
      new maplibregl.Marker({ element: el })
        .setLngLat([120.9932, 14.5378])
        .setPopup(new maplibregl.Popup().setHTML('<b>Pasay City Police Station</b>'))
        .addTo(leafletMapRef.current);
    };

    if (!(window as any).maplibregl) {
      if (!document.getElementById('maplibre-js')) {
        const script = document.createElement('script');
        script.id = 'maplibre-js';
        script.src = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js';
        script.onload = initMap;
        document.head.appendChild(script);
      }
    } else {
      initMap();
    }
  }, [officer]);

  // Update map markers when alerts change
  useEffect(() => {
    if (!leafletMapRef.current || alerts.length === 0) return;
    updateMapMarkers(alerts);
  }, [alerts]);

  // Poll for alerts every 3 seconds (SSE not supported on Vercel serverless)
  useEffect(() => {
    if (!officer) return;

    const pollAlerts = async () => {
      try {
        const data: any = await dispatchApi.getAlerts();
        const incoming = data.alerts || [];
        React.startTransition(() => {
          setAlerts(prev => {
            // Detect new alerts by comparing IDs
            const prevIds = prevAlertIdsRef.current;
            for (const a of incoming) {
              if (!prevIds.has(a.id) && prevIds.size > 0) {
                playBeep();
                break;
              }
            }
            // Update known IDs
            prevAlertIdsRef.current = new Set(incoming.map((a: any) => a.id));
            return incoming;
          });
        });
      } catch {}
    };

    // Initial poll
    pollAlerts();
    // Poll every 3 seconds
    const interval = setInterval(pollAlerts, 3000);
    return () => clearInterval(interval);
  }, [officer]);

  const fetchAlerts = async () => {
    try {
      const data: any = await dispatchApi.getAlerts();
      setAlerts(data.alerts || []);
    } catch {}
    finally { setAlertsLoading(false); }
  };

  const updateMapMarkers = (alertList: any[]) => {
    if (!leafletMapRef.current) return;
    const maplibregl = (window as any).maplibregl;
    if (!maplibregl) return;

    // Remove old markers
    for (const [id, marker] of Array.from(markersRef.current.entries())) {
      if (!alertList.find(a => a.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    let newestActive: any = null;

    for (const alert of alertList) {
      const initials = getInitials(alert.full_name);

      let color = '#6b7280';
      let size = 20;
      let pulseClass = '';

      if (alert.status === 'ACTIVE' && alert.is_suspicious) {
        color = '#f97316'; size = 24; pulseClass = 'pin-suspicious';
      } else if (alert.status === 'ACTIVE') {
        color = '#E63946'; size = 24; pulseClass = 'pin-active';
      } else if (alert.status === 'ACKNOWLEDGED') {
        color = '#eab308'; size = 24;
      } else if (alert.status === 'RESOLVED') {
        color = '#22c55e'; size = 20;
      }

      if (markersRef.current.has(alert.id)) {
        const marker = markersRef.current.get(alert.id);
        if (alert.lat != null && alert.lng != null) marker.setLngLat([alert.lng, alert.lat]);
        const existingEl = marker.getElement();
        existingEl.className = pulseClass;
        existingEl.style.cssText = `width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.6);cursor:pointer`;
        existingEl.textContent = initials;
      } else {
        if (alert.lat == null || alert.lng == null) continue;
        const el = document.createElement('div');
        el.className = pulseClass;
        el.style.cssText = `width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.6);cursor:pointer`;
        el.textContent = initials;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([alert.lng, alert.lat])
          .addTo(leafletMapRef.current);
        el.addEventListener('click', () => panToAlert(alert));
        markersRef.current.set(alert.id, marker);
      }

      if (alert.status === 'ACTIVE' && (!newestActive || alert.triggered_at > newestActive.triggered_at)) {
        newestActive = alert;
      }
    }

    if (newestActive?.lat != null && newestActive?.lng != null) {
      leafletMapRef.current.flyTo({ center: [newestActive.lng, newestActive.lat], zoom: 15 });
    }
  };

  const playBeep = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const panToAlert = async (alert: any) => {
    if (leafletMapRef.current && alert.lat != null && alert.lng != null) {
      leafletMapRef.current.flyTo({ center: [alert.lng, alert.lat], zoom: 16 });
    }
    setSelectedAlert(alert);
    try {
      const data: any = await dispatchApi.getAlert(alert.id);
      if (data?.alert) setSelectedAlert(data.alert);
    } catch {}
  };

  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED');

  if (loading) return null; // Wait for auth context to restore from localStorage
  if (!officer) {
    navigate('/dispatch/login');
    return null;
  }

  return (
    <>
      <DispatchLayout>
        {/* dispatch-main: map (flex-1) + right panel (360px) */}
        <div className="dispatch-main">
          {/* CENTER MAP */}
          <div className="dispatch-map-area" style={{ position: 'relative' }}>
            {surgeWarning && (
              <div className="absolute top-0 left-0 right-0 z-50 p-3 text-center"
                style={{ background: 'rgba(230,57,70,0.9)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                🚨 {surgeWarning}
              </div>
            )}
            <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#f8fafc' }} />
          </div>

          {/* RIGHT PANEL – Active Alerts */}
          <div className="dispatch-right-panel">
            <div className="p-4" style={{ borderBottom: '1px solid var(--dispatch-border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {alerts.filter(a => a.status === 'ACTIVE').length > 0 && (
                    <span className="animate-pulse w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#dc2626' }} />
                  )}
                  <h2 style={{ color: '#e1e4ed', fontSize: 15, fontWeight: 700, margin: 0 }}>Active Alerts</h2>
                  <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{ background: activeAlerts.length > 0 ? 'var(--sos-red)' : '#333', color: '#fff' }}>
                    {activeAlerts.length}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-bold tracking-widest"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' }}>
                  LIVE
                </span>
              </div>
              {clock && (
                <p style={{ color: '#6b7280', fontSize: 10, margin: '6px 0 0', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
                  🕐 {clock} PST
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {alertsLoading ? (
                <div className="flex flex-col gap-3 p-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="flex items-start gap-3">
                        <div className="animate-pulse bg-gray-700 rounded-full flex-shrink-0" style={{ width: 36, height: 36 }} />
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="animate-pulse bg-gray-700 rounded h-4" style={{ width: '60%' }} />
                          <div className="animate-pulse bg-gray-700 rounded h-3" style={{ width: '40%' }} />
                          <div className="animate-pulse bg-gray-700 rounded h-3" style={{ width: '30%' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeAlerts.length === 0 ? (
                <div className="text-center py-10">
                  <div style={{ fontSize: 32 }}>✌️</div>
                  <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>No active alerts</p>
                </div>
              ) : (
                [...activeAlerts].sort((a, b) => a.triggered_at - b.triggered_at).map(alert => (
                  <div key={alert.id}
                    onClick={() => panToAlert(alert)}
                    className="p-3 rounded-xl cursor-pointer"
                    style={(() => {
                      const isActive = alert.status === 'ACTIVE';
                      const isAck = alert.status === 'ACKNOWLEDGED';
                      const isSusp = alert.is_suspicious;
                      const borderColor = isSusp ? '#f97316' : isActive ? '#dc2626' : isAck ? '#d97706' : '#22c55e';
                      const bg = isSusp ? 'rgba(249,115,22,0.08)' : isActive ? '#fef2f2' : isAck ? '#fffbeb' : 'rgba(34,197,94,0.06)';
                      const sideBorder = `1px solid ${isSusp ? 'rgba(249,115,22,0.3)' : isActive ? 'rgba(220,38,38,0.2)' : 'rgba(217,119,6,0.2)'}`;
                      return {
                        background: bg,
                        borderLeft: `4px solid ${borderColor}`,
                        borderTop: sideBorder,
                        borderRight: sideBorder,
                        borderBottom: sideBorder,
                        transition: 'all 0.2s',
                      };
                    })()}>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center rounded-full flex-shrink-0"
                        style={{ width: 36, height: 36,
                          background: alert.status === 'ACTIVE' ? 'var(--sos-red)' : '#eab308',
                          fontSize: 12, fontWeight: 700, color: '#fff' }}>
                        {getInitials(alert.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p style={{ color: !alert.is_suspicious && (alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED') ? '#1f2937' : '#e1e4ed', fontSize: 13, fontWeight: 600, margin: 0 }}>
                            {alert.full_name}
                          </p>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold badge-${alert.status.toLowerCase()}`}>
                            {alert.status}
                          </span>
                        </div>
                        <p style={{ color: alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED' ? '#6b7280' : '#888', fontSize: 11, margin: '2px 0' }}>{alert.barangay}</p>
                        <div className="flex items-center justify-between">
                          <span style={{ color: alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED' ? '#374151' : '#e1e4ed', fontSize: 12, fontFamily: 'monospace' }}>
                            {formatElapsed(Date.now() - alert.triggered_at)}
                          </span>
                          <div className="flex items-center gap-1">
                            {alert.is_suspicious && (
                              <span style={{ fontSize: 12 }} title="Suspicious">🚩</span>
                            )}
                            <span style={{
                              fontSize: 10, fontWeight: 600,
                              color: (alert.trust_score || 100) >= 80 ? '#22c55e' : (alert.trust_score || 100) >= 50 ? '#eab308' : '#ef4444'
                            }}>
                              T:{alert.trust_score || 100}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Stats bar */}
            <div className="p-3 grid grid-cols-3 gap-2" style={{ borderTop: '1px solid var(--dispatch-border)' }}>
              {[
                { label: 'Active', value: alerts.filter(a => a.status === 'ACTIVE').length, color: '#dc2626', bg: 'rgba(220,38,38,0.1)', icon: '🚨' },
                { label: "Ack'd", value: alerts.filter(a => a.status === 'ACKNOWLEDGED').length, color: '#d97706', bg: 'rgba(217,119,6,0.1)', icon: '✓' },
                { label: 'Today', value: alerts.filter(a => a.triggered_at > Date.now() - 86400000).length, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '📅' },
              ].map((s, i) => (
                <div key={i} className="text-center p-2 rounded-lg"
                  style={{ background: s.bg }}>
                  <p style={{ color: '#888', fontSize: 10, margin: '0 0 2px', letterSpacing: '0.05em' }}>{s.icon} {s.label}</p>
                  <p style={{ color: s.color, fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1 }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </DispatchLayout>
      {/* Alert Detail Modal – rendered OUTSIDE DispatchLayout so position:fixed is not clipped by overflow:hidden */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onUpdate={(updated) => {
            setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));
            setSelectedAlert(updated);
          }}
        />
      )}
    </>
  );
}
