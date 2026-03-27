import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useCitizenAuth } from '../../hooks/useCitizenAuth';
import { citizenApi } from '../../lib/api';

export default function SosActive() {
 const [, navigate] = useLocation();
 const { user } = useCitizenAuth();
 const [alert, setAlert] = useState<any>(null);
 const [elapsedTime, setElapsedTime] = useState(0);
 const [showCancelModal, setShowCancelModal] = useState(false);
 const [cancelReason, setCancelReason] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const mapRef = useRef<HTMLDivElement>(null);
 const mapInstance = useRef<any>(null);
 const markerRef = useRef<any>(null);
 const leafletCssLoaded = useRef(false);

 const sosId = localStorage.getItem('active_sos_id');

 useEffect(() => {
 if (!user || !sosId) {
 navigate('/home');
 }
 }, [user, sosId, navigate]);

 useEffect(() => {
 const fetchAlert = async () => {
 try {
 const a = await citizenApi.getActiveAlert();
 setAlert(a);
 } catch(e) {
 setError('Failed to load active alert');
 navigate('/home');
 }
 };
 fetchAlert();
 const timer = setInterval(fetchAlert, 5000);
 return () => clearInterval(timer);
 }, [sosId]);

 useEffect(() => {
 const timer = setInterval(() => {
 if (alert) {
 setElapsedTime(Date.now() - alert.triggered_at);
 }
 }, 1000);
 return () => clearInterval(timer);
 }, [alert]);

 const initMap = async () => {
 if (!mapRef.current || !alert) return;
 const L = (window as any).L;
 if (!L) return;

 if (mapInstance.current) {
 mapInstance.current.off();
 mapInstance.current.remove();
 }

 mapInstance.current = L.map(mapRef.current).setView([alert.lat, alert.lng], 15);
 L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
 attribution: 'CartoDB',
 maxZoom: 19
 }).addTo(mapInstance.current);
 
 if (markerRef.current) markerRef.current.remove();
 markerRef.current = L.marker([alert.lat, alert.lng]).bindPopup('Your Location').addTo(mapInstance.current);
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
 }, [alert]);

 const handleCancel = async () => {
 setLoading(true);
 try {
 await citizenApi.cancelSos({reason: cancelReason});
 localStorage.removeItem('active_sos_id');
 navigate('/home');
 } catch(e: any) {
 setError(e.message);
 } finally {
 setLoading(false);
 }
 };

 if (!alert) {
 return <div style={{padding: 20, color: '#666'}}>Loading...</div>;
 }

 return (
 <div style={{padding: 20, height: '100vh', display: 'flex', flexDirection: 'column'}}>
 <div style={{flex: 1, borderRadius: 8, overflow: 'hidden'}} ref={mapRef}></div>
 <div style={{marginTop: 20}}>
 <p>SOS Active for {Math.floor(elapsedTime / 1000)}s</p>
 <button onClick={() => setShowCancelModal(true)} style={{padding: '12px 24px', borderRadius: 8, background: '#555', color: '#fff', border: 'none', cursor: 'pointer'}}>Cancel SOS</button>
 </div>
 {showCancelModal && (
 <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
 <div style={{background: '#fff', padding: 20, borderRadius: 8, maxWidth: 400}}>
 <h2>Cancel SOS?</h2>
 <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Why are you cancelling?" style={{width: '100%', padding: 12, borderRadius: 4, border: '1px solid #ccc', marginBottom: 12}}></textarea>
 <button onClick={handleCancel} disabled={loading} style={{padding: '12px 24px', borderRadius: 8, background: '#e74c3c', color: '#fff', border: 'none', cursor: 'pointer'}}>Confirm Cancel</button>
 <button onClick={() => setShowCancelModal(false)} style={{padding: '12px 24px', borderRadius: 8, background: '#ccc', color: '#000', border: 'none', cursor: 'pointer', marginLeft: 12}}>Back</button>
 </div>
 </div>
 )}
 </div>
 );
}
