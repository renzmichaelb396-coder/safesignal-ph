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
 const sseRetryRef = useRef(0);

 useEffect(() => {
 if (!officer) {
 navigate('/login');
 return;
 }
 const timer = setInterval(() => setNow(Date.now()), 1000);
 return () => clearInterval(timer);
 }, [officer, navigate]);

 useEffect(() => {
 const hour = new Date().getHours();
 setClock(`${String(hour).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`);
 }, [now]);

 const initMap = async () => {
 if (!mapRef.current) return;
 const L = (window as any).L;
 if (!L) return;

 if (mapInstance.current) {
 mapInstance.current.off();
 mapInstance.current.remove();
 }

 mapInstance.current = L.map(mapRef.current).setView([14.5, 121], 11);
 L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
 attribution: 'CartoDB',
 maxZoom: 19
 }).addTo(mapInstance.current);
 };

 useEffect(() => {
 if (!leafletCssLoaded.current) {
 const link = document.createElement('link');
 link.rel = 'stylesheet';
 link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css';
 document.head.appendChild(link);
 const script = document.createElement('script');
 script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js';
 script.onload = initMap;
 document.body.appendChild(script);
 leafletCssLoaded.current = true;
 } else {
 initMap();
 }
 }, []);

 useEffect(() => {
 const timer = setInterval(async () => {
 try {
 const alerts = await dispatchApi.getAlerts();
 setAlerts(alerts);
 alerts.forEach(a => {
 if (mapInstance.current) {
 const existing = markersRef.current.get(a.id);
 if (existing) existing.setLatLng([a.lat, a.lng]);
 else {
 const m = (window as any).L.marker([a.lat, a.lng]).bindPopup(`Alert #${a.id}`).addTo(mapInstance.current);
 markersRef.current.set(a.id, m);
 }
 }
 });
 } catch(e) {
 console.error('Failed to fetch alerts:', e);
 }
 }, 5000);
 return () => clearInterval(timer);
 }, []);

 return (
 <DispatchLayout>
 <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, height: '100vh'}}>
 <div style={{overflowY: 'auto'}}>
 <h1>Active Alerts ({alerts.length})</h1>
 {alerts.map(a => (
 <div key={a.id} style={{padding: 12, borderRadius: 8, border: '1px solid #ccc', marginBottom: 12, cursor: 'pointer'}} onClick={() => setSelectedAlert(a)}>
 <div style={{fontWeight: 700}}>{a.full_name} #{a.id}</div>
 <div style={{fontSize: 12, color: '#666'}}>{a.alert_type} - {formatElapsed(now - a.triggered_at)}</div>
 </div>
 ))}
 </div>
 <div ref={mapRef} style={{borderRadius: 8, overflow: 'hidden'}}></div>
 </div>
 {selectedAlert && <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />}
 </DispatchLayout>
 );
}
