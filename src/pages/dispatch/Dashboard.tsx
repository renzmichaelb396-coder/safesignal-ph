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
  const officerMarkersRef = useRef<Map<number, any>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevAlertIdsRef = useRef<Set<number>>(new Set());
  const hasInitialLoadRef = useRef(false);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundArmedRef = useRef(false);
  // Only auto-zoom when the PRIORITY alert changes (new ID). After first zoom, user can pan/zoom freely.
  const autoZoomAlertIdRef = useRef<number | null>(null);
  const repushCounterRef = useRef(0);
  const [soundArmed, setSoundArmed] = useState(false);
  // Nearby officers per alert id (fetched once per ACTIVE alert)
  const [nearbyOfficers, setNearbyOfficers] = useState<Record<number, any[]>>({});
  const fetchedNearbyRef = useRef<Set<number>>(new Set());

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

      // Dark mode: invert canvas only — markers in overlay div stay normal
      leafletMapRef.current.on('load', () => {
        const canvas = leafletMapRef.current!.getCanvas();
        canvas.style.filter = 'invert(1) hue-rotate(180deg)';
        canvas.style.borderRadius = 'inherit';
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
        const wasInitialized = hasInitialLoadRef.current;
        prevAlertIdsRef.current = new Set(incoming.map((a: any) => a.id));
        hasInitialLoadRef.current = true;
        // Alarm loops while any alert needs attention: ACTIVE (no dispatch ack) or ACKNOWLEDGED (no officer ack)
        // Stops only when all active alerts are EN_ROUTE or beyond (both sides have acknowledged)
        if (wasInitialized) {
          const needsAlarm = incoming.some((a: any) => ['ACTIVE', 'ACKNOWLEDGED'].includes(a.status));
          if (needsAlarm) startAlarmLoop(); else stopAlarmLoop();
        }
        React.startTransition(() => { setAlerts(() => incoming); });
        // Repush to nearby/assigned officers every 30s while ACTIVE or ACKNOWLEDGED
        repushCounterRef.current++;
        if (repushCounterRef.current % 10 === 0) {
          const repushToken = localStorage.getItem('dispatch_token');
          if (repushToken) {
            for (const a of incoming) {
              if (['ACTIVE', 'ACKNOWLEDGED'].includes(a.status)) {
                fetch(`/api/dispatch/alerts/${a.id}/repush`, {
                  method: 'POST',
                  headers: { Authorization: 'Bearer ' + repushToken },
                }).catch(() => {});
              }
            }
          }
        }
        // Fetch nearby officers once per new ACTIVE alert (fire-and-forget)
        const token = localStorage.getItem('dispatch_token');
        if (token) {
          for (const a of incoming) {
            if (a.status === 'ACTIVE' && !fetchedNearbyRef.current.has(a.id) && a.lat != null && a.lng != null) {
              fetchedNearbyRef.current.add(a.id);
              fetch(`/api/dispatch/nearby-officers?lat=${a.lat}&lng=${a.lng}`, {
                headers: { Authorization: 'Bearer ' + token },
              }).then(r => r.json()).then(d => {
                if (d.officers?.length) {
                  setNearbyOfficers(prev => ({ ...prev, [a.id]: d.officers }));
                }
              }).catch(() => {});
            }
          }
        }
      } catch {}
    };

    // Initial poll
    pollAlerts();
    // Poll every 3 seconds
    const interval = setInterval(pollAlerts, 3000);
    return () => { clearInterval(interval); stopAlarmLoop(); };
  }, [officer]);

  // Poll officer locations every 5 seconds and show blue dots on map
  useEffect(() => {
    if (!officer) return;
    const pollOfficerLocations = async () => {
      try {
        const token = localStorage.getItem('dispatch_token');
        if (!token) return;
        const res = await fetch('/api/dispatch/officer-locations', {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) return;
        const data = await res.json();
        updateOfficerMarkers(data.officers || []);
      } catch {}
    };
    pollOfficerLocations();
    const interval = setInterval(pollOfficerLocations, 5000);
    return () => clearInterval(interval);
  }, [officer]);

  const updateOfficerMarkers = (officers: any[]) => {
    if (!leafletMapRef.current) return;
    const maplibregl = (window as any).maplibregl;
    if (!maplibregl) return;

    const currentIds = new Set(officers.map((o: any) => o.officer_id));

    // Remove stale officer markers
    for (const [id, marker] of Array.from(officerMarkersRef.current.entries())) {
      if (!currentIds.has(id)) {
        marker.remove();
        officerMarkersRef.current.delete(id);
      }
    }

    for (const ofc of officers) {
      if (ofc.lat == null || ofc.lng == null) continue;
      const initials = ofc.full_name ? ofc.full_name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() : ofc.badge_number || '?';

      if (officerMarkersRef.current.has(ofc.officer_id)) {
        const marker = officerMarkersRef.current.get(ofc.officer_id);
        marker.setLngLat([ofc.lng, ofc.lat]);
      } else {
        // Waze-style officer marker: double pulsing ring + large blue dot + name badge
        if (!document.getElementById('officer-pulse-style')) {
          const s = document.createElement('style'); s.id = 'officer-pulse-style';
          s.textContent = '@keyframes ofcPulse{0%{transform:translate(-50%,-50%) scale(1);opacity:0.65}100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}}';
          document.head.appendChild(s);
        }
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto';

        const dotWrap = document.createElement('div');
        dotWrap.style.cssText = 'position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center';

        const pulse1 = document.createElement('div');
        pulse1.style.cssText = 'position:absolute;top:50%;left:50%;width:42px;height:42px;border-radius:50%;background:rgba(59,130,246,0.45);animation:ofcPulse 1.8s ease-out infinite;pointer-events:none';
        const pulse2 = document.createElement('div');
        pulse2.style.cssText = 'position:absolute;top:50%;left:50%;width:42px;height:42px;border-radius:50%;background:rgba(59,130,246,0.28);animation:ofcPulse 1.8s ease-out infinite 0.7s;pointer-events:none';

        const dot = document.createElement('div');
        dot.style.cssText = 'position:relative;z-index:2;width:42px;height:42px;background:#1d4ed8;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#fff;box-shadow:0 0 0 3px rgba(59,130,246,0.5),0 4px 20px rgba(59,130,246,0.9),0 2px 6px rgba(0,0,0,0.7)';
        dot.textContent = initials;

        dotWrap.appendChild(pulse1);
        dotWrap.appendChild(pulse2);
        dotWrap.appendChild(dot);

        const nameLabel = document.createElement('div');
        nameLabel.style.cssText = 'background:rgba(29,78,216,0.97);color:#fff;font-size:11px;font-weight:800;padding:2px 10px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,0.7);margin-top:5px;max-width:140px;overflow:hidden;text-overflow:ellipsis;border:1px solid rgba(255,255,255,0.3);letter-spacing:0.02em';
        nameLabel.textContent = ofc.full_name || ofc.badge_number;

        wrapper.appendChild(dotWrap);
        wrapper.appendChild(nameLabel);
        wrapper.title = ofc.full_name + ' · ' + ofc.badge_number;

        // Click popup — shows full contact card for dispatcher to call
        const phoneDisplay = ofc.phone ? `<a href="tel:${ofc.phone}" style="color:#93c5fd;font-weight:700;text-decoration:none;">${ofc.phone}</a>` : '<span style="color:#6b7280;font-style:italic">No phone on file</span>';
        const dutyColor = ofc.duty_status === 'OFF_DUTY' ? '#f87171' : '#4ade80';
        const dutyLabel = ofc.duty_status === 'OFF_DUTY' ? '🔴 Off Duty' : '🟢 On Duty';
        const popup = new maplibregl.Popup({ offset: 52, closeButton: true, className: 'officer-popup' })
          .setHTML(`
            <div style="background:#0f172a;color:#f1f5f9;padding:12px 14px;border-radius:8px;min-width:180px;font-family:sans-serif;border:1px solid rgba(59,130,246,0.4);box-shadow:0 4px 20px rgba(0,0,0,0.8);">
              <div style="font-size:13px;font-weight:800;margin-bottom:4px;">${ofc.full_name || 'Unknown'}</div>
              <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Badge: <b style="color:#e2e8f0">${ofc.badge_number}</b></div>
              <div style="font-size:11px;margin-bottom:6px;">📞 ${phoneDisplay}</div>
              <div style="font-size:11px;color:${dutyColor};font-weight:700;">${dutyLabel}</div>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: wrapper })
          .setLngLat([ofc.lng, ofc.lat])
          .setPopup(popup)
          .addTo(leafletMapRef.current);

        // Open popup on click
        wrapper.addEventListener('click', () => marker.togglePopup());
        officerMarkersRef.current.set(ofc.officer_id, marker);
      }
    }
  };

  const fetchAlerts = async () => {
    try {
      const data: any = await dispatchApi.getAlerts();
      setAlerts(data.alerts || []);
    } catch {}
    finally { setAlertsLoading(false); }
  };

  const STATION_CENTER: [number, number] = [120.9932, 14.5378];

  const centerOnStation = () => {
    if (!leafletMapRef.current) return;
    leafletMapRef.current.flyTo({ center: STATION_CENTER, zoom: 14 });
  };

  const updateMapMarkers = (alertList: any[]) => {
    if (!leafletMapRef.current) return;

    // BUG-002 guard: map style must be loaded before markers/flyTo work correctly.
    // If called before tiles are ready, defer until map emits 'load' then retry.
    if (!leafletMapRef.current.isStyleLoaded()) {
      leafletMapRef.current.once('load', () => updateMapMarkers(alertList));
      return;
    }

    const maplibregl = (window as any).maplibregl;
    if (!maplibregl) return;

    // Remove stale markers for resolved/cancelled alerts
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

      if (!['ACTIVE','ACKNOWLEDGED','EN_ROUTE','ON_SCENE'].includes(alert.status)) continue;
      // Citizen markers are ALWAYS red — officers are always blue
      if (alert.status === 'ACTIVE' && alert.is_suspicious) {
        color = '#E63946'; size = 24; pulseClass = 'pin-suspicious';
      } else if (alert.status === 'ACTIVE') {
        color = '#E63946'; size = 24; pulseClass = 'pin-active';
      } else if (alert.status === 'ACKNOWLEDGED') {
        color = '#E63946'; size = 24;
      } else if (alert.status === 'EN_ROUTE') {
        color = '#E63946'; size = 22;
      } else if (alert.status === 'ON_SCENE') {
        color = '#E63946'; size = 22;
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

    // Pan to the most urgent active alert — prioritize ACTIVE, then any in-progress status.
    // This ensures the dispatcher map is ALWAYS centered on the emergency, not the officer.
    let priorityAlert = newestActive;
    if (!priorityAlert) {
      // No ACTIVE alert — find the most recent in-progress alert (EN_ROUTE, ON_SCENE, etc.)
      for (const alert of alertList) {
        if (['ACKNOWLEDGED','EN_ROUTE','ON_SCENE'].includes(alert.status)) {
          if (!priorityAlert || alert.triggered_at > priorityAlert.triggered_at) priorityAlert = alert;
        }
      }
    }
    // Only auto-zoom when the priority alert changes — user can freely pan/zoom after first zoom-in
    const priorityId = priorityAlert?.id ?? null;
    if (priorityId !== autoZoomAlertIdRef.current) {
      autoZoomAlertIdRef.current = priorityId;
      if (priorityAlert?.lat != null && priorityAlert?.lng != null) {
        leafletMapRef.current.flyTo({ center: [priorityAlert.lng, priorityAlert.lat], zoom: 15 });
      } else {
        // No active emergency — return camera to Pasay Police Station
        leafletMapRef.current.flyTo({ center: STATION_CENTER, zoom: 14 });
      }
    }
  };

  const stopAlarmLoop = () => {
    if (alarmIntervalRef.current !== null) { clearInterval(alarmIntervalRef.current); alarmIntervalRef.current = null; }
  };

  const startAlarmLoop = () => {
    if (!soundArmedRef.current || alarmIntervalRef.current !== null) return;
    playBeep();
    // Repeat every 5.5s — 3 wail tones take ~1.5s, then 4s silence before next cycle
    alarmIntervalRef.current = setInterval(() => { if (soundArmedRef.current) playBeep(); }, 5500);
  };

  const armSound = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    audioCtxRef.current.resume().catch(() => {});
    soundArmedRef.current = true;
    setSoundArmed(true);
    // If there are already unacknowledged alerts, start alarm immediately on arm
    const needsAlarm = alerts.some(a => ['ACTIVE', 'ACKNOWLEDGED'].includes(a.status));
    if (needsAlarm) setTimeout(startAlarmLoop, 100);
  };

  const playBeep = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      ctx.resume().catch(() => {}); // ensure AudioContext not suspended by browser autoplay policy
      // Siren pattern: 3 urgent beeps — high-low sweep, then repeat twice more
      const playTone = (startTime: number, freqHigh: number, freqLow: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freqHigh, startTime);
        osc.frequency.linearRampToValueAtTime(freqLow, startTime + duration);
        gain.gain.setValueAtTime(0.0, startTime);
        gain.gain.linearRampToValueAtTime(0.6, startTime + 0.02);
        gain.gain.setValueAtTime(0.6, startTime + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0.0, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = ctx.currentTime;
      // 3 wail cycles: 960Hz → 640Hz, 0.35s each, 0.1s gap between
      playTone(now,        960, 640, 0.35);
      playTone(now + 0.45, 960, 640, 0.35);
      playTone(now + 0.90, 960, 640, 0.35);
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

  const activeAlerts = alerts.filter(a => ['ACTIVE','ACKNOWLEDGED','EN_ROUTE','ON_SCENE'].includes(a.status));

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
            {/* Re-center on Pasay Police Station button */}
            <button
              onClick={centerOnStation}
              title="Center on Pasay Police Station"
              style={{
                position: 'absolute', bottom: 12, right: 12, zIndex: 10,
                background: '#1a2332', border: '1px solid #30363d', borderRadius: 8,
                color: '#e6edf3', padding: '8px 12px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              ⭐ Station
            </button>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={armSound}
                    title={soundArmed ? 'Alert sounds armed — click to re-arm' : 'Click to enable alert sounds'}
                    style={{ background: soundArmed ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${soundArmed ? 'rgba(34,197,94,0.35)' : '#30363d'}`, borderRadius: 6, color: soundArmed ? '#22c55e' : '#6b7280', fontSize: 14, padding: '2px 7px', cursor: 'pointer', lineHeight: '1.6' }}
                  >
                    {soundArmed ? '🔔' : '🔕'}
                  </button>
                  <span className="px-2 py-0.5 rounded text-xs font-bold tracking-widest"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' }}>
                    LIVE
                  </span>
                </div>
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
                          background: alert.status === 'ACTIVE' ? 'var(--sos-red)' : alert.status === 'ACKNOWLEDGED' ? '#eab308' : alert.status === 'EN_ROUTE' ? '#0ea5e9' : alert.status === 'ON_SCENE' ? '#f97316' : '#6b7280',
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
                        <p style={{ color: alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED' ? '#6b7280' : '#888', fontSize: 11, margin: '2px 0' }}>
                          {alert.address ? `${alert.address}, ${alert.barangay || ''}` : alert.barangay}
                          {alert.lat != null && alert.lng != null && (
                            <span style={{ color: '#6b7280', fontSize: 10, marginLeft: 4 }}>
                              ({Number(alert.lat).toFixed(4)}, {Number(alert.lng).toFixed(4)})
                            </span>
                          )}
                        </p>
                        <div className="flex items-center justify-between">
                          <span style={{ color: alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED' ? '#374151' : '#e1e4ed', fontSize: 12, fontFamily: 'monospace' }}>
                            {formatElapsed(Date.now() - alert.triggered_at)}
                          </span>
                          <div className="flex items-center gap-1">
                            {!!alert.is_suspicious && (
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
                        {(alert as any).officer_name && (
                          <div style={{ marginTop: 4, fontSize: 10, color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🚔</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(alert as any).officer_name}</span>
                          </div>
                        )}
                        {/* STOC 30s countdown badge */}
                        {alert.status === 'ACTIVE' && (() => {
                          const secElapsed = Math.floor((now - alert.triggered_at) / 1000);
                          const secLeft = Math.max(0, 30 - secElapsed);
                          const expired = secLeft === 0;
                          const pct = Math.max(0, secLeft / 30);
                          const badgeColor = expired ? '#dc2626' : pct > 0.5 ? '#22c55e' : '#eab308';
                          return (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{ marginTop: 6, padding: '5px 8px', borderRadius: 7, background: expired ? 'rgba(220,38,38,0.15)' : 'rgba(0,0,0,0.12)', border: `1px solid ${badgeColor}40`, display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                              {expired ? (
                                <>
                                  <span style={{ fontSize: 13 }}>📞</span>
                                  <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 800, letterSpacing: 0.3, animation: 'pulse 1s infinite' }}>CALL STOC NOW — 30s elapsed</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: 11 }}>⏱</span>
                                  <span style={{ color: badgeColor, fontSize: 11, fontWeight: 700 }}>STOC call in {secLeft}s</span>
                                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct * 100}%`, background: badgeColor, borderRadius: 2, transition: 'width 1s linear' }} />
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })()}
                        {/* Nearby Officers panel */}
                        {nearbyOfficers[alert.id]?.length > 0 && (
                          <div onClick={e => e.stopPropagation()} style={{ marginTop: 6, background: 'rgba(0,0,0,0.15)', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <p style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, margin: 0, padding: '4px 8px', letterSpacing: 0.5, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                              📍 Nearest Officers
                            </p>
                            {nearbyOfficers[alert.id].slice(0, 3).map((o: any, idx: number) => (
                              <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ color: '#e1e4ed', fontSize: 11, fontWeight: 600 }}>{o.full_name}</span>
                                  <span style={{ color: '#6b7280', fontSize: 10, marginLeft: 4 }}>{o.badge_number}</span>
                                  <span style={{ color: '#38bdf8', fontSize: 10, marginLeft: 4 }}>{Number(o.distance_km).toFixed(2)}km</span>
                                </div>
                                {o.phone ? (
                                  <a
                                    href={`tel:${o.phone}`}
                                    onClick={e => e.stopPropagation()}
                                    style={{ background: '#16a34a', borderRadius: 5, padding: '2px 7px', color: '#fff', fontSize: 10, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: 6 }}
                                  >
                                    📞 Call
                                  </a>
                                ) : (
                                  <span style={{ color: '#4b5563', fontSize: 10, marginLeft: 6 }}>No #</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Stats bar */}
            <div className="p-3 grid grid-cols-3 gap-2" style={{ borderTop: '1px solid var(--dispatch-border)' }}>
              {[
                { label: 'Active', value: alerts.filter(a => ['ACTIVE','ACKNOWLEDGED'].includes(a.status)).length, color: '#dc2626', bg: 'rgba(220,38,38,0.1)', icon: '🚨' },
                { label: "En Route", value: alerts.filter(a => ['EN_ROUTE','ON_SCENE'].includes(a.status)).length, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', icon: '🚔' },
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
