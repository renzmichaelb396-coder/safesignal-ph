import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useCitizenAuth } from '../../hooks/useCitizenAuth';
import { citizenApi } from '../../lib/api';

export default function SosConfirm() {
 const [, navigate] = useLocation();
 const { user } = useCitizenAuth();
 const [pin, setPin] = useState('');
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 const [countdown, setCountdown] = useState(5);
 const [showCountdown, setShowCountdown] = useState(false);
 const [geoError, setGeoError] = useState('');

 useEffect(() => {
 if (!user) {
 navigate('/login');
 }
 }, [user, navigate]);

 useEffect(() => {
 if (showCountdown && countdown > 0) {
 const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
 return () => clearTimeout(timer);
 }

 if (countdown === 0 && showCountdown) {
 navigate('/home');
 }
 }, [countdown, showCountdown, navigate]);

 const getLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
 return new Promise((resolve, reject) => {
 if (!navigator.geolocation) {
 reject(new Error('Geolocation not supported'));
 return;
 }

 navigator.geolocation.getCurrentPosition(
 position => {
 resolve({
 lat: position.coords.latitude,
 lng: position.coords.longitude,
 accuracy: position.coords.accuracy,
 });
 },
 error => {
 reject(error);
 },
 { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
 );
 });
 };

 const handleNumpadClick = (digit: string) => {
 if (pin.length < 4) {
 setPin(pin + digit);
 }
 };

 const handleBackspace = () => {
 setPin(pin.slice(0, -1));
 };

 const handleSubmit = async () => {
 if (pin.length !== 4) {
 setError('PIN must be 4 digits');
 return;
 }

 setError('');
 setLoading(true);
 setGeoError('');

 try {
 const location = await getLocation();

 const data = await citizenApi.sendSos({
 pin,
 lat: location.lat,
 lng: location.lng,
 accuracy: location.accuracy,
 });

 localStorage.setItem('active_sos_id', String((data as any).alert?.id));
 setShowCountdown(true);
 } catch (err: any) {
 if (err.code === 1) {
 setGeoError('Location permission denied. Using fallback coordinates.');
 try {
 const data = await citizenApi.sendSos({
 pin,
 lat: 14.5794,
 lng: 120.9749,
 accuracy: 5000,
 });
 localStorage.setItem('active_sos_id', String((data as any).alert?.id));
 setShowCountdown(true);
 } catch (fallbackErr: any) {
 const msg = fallbackErr.message || '';
 if (msg.toLowerCase().includes('active alert') || msg.toLowerCase().includes('already have')) {
 navigate('/sos/active');
 } else {
 setError(msg || 'SOS submission failed');
 }
 }
 } else if (err.code === 3) {
 setGeoError('Location request timed out. Using fallback coordinates.');
 try {
 const data = await citizenApi.sendSos({
 pin,
 lat: 14.5794,
 lng: 120.9749,
 accuracy: 5000,
 });
 localStorage.setItem('active_sos_id', String((data as any).alert?.id));
 setShowCountdown(true);
 } catch (fallbackErr: any) {
 const msg = fallbackErr.message || '';
 if (msg.toLowerCase().includes('active alert') || msg.toLowerCase().includes('already have')) {
 navigate('/sos/active');
 } else {
 setError(msg || 'SOS submission failed');
 }
 }
 } else if (err.message && (err.message.toLowerCase().includes('active alert') || err.message.toLowerCase().includes('already have'))) {
 navigate('/sos/active');
 } else {
 setError(err.message || 'Failed to send SOS');
 }
 } finally {
 setLoading(false);
 }
 };

 const numpadButtons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

 if (showCountdown) {
 return (
 <div className="citizen-container px-5 py-6 flex flex-col items-center justify-center min-h-screen" style={{ background: 'var(--citizen-bg)' }}>
 <div className="flex flex-col items-center gap-6">
 <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>
 SOS Sent
 </h1>
 <p style={{ color: '#888', fontSize: 14, textAlign: 'center', margin: 0 }}>
 Police are on their way. Staying on the line...
 </p>
 </div>
 </div>
 );
 }

 return (
 <div className="citizen-container px-5 py-6 flex flex-col items-center justify-between min-h-screen" style={{ background: 'var(--citizen-bg)' }}>
 <div className="w-full">
 <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: 0, marginBottom: 4 }}>
 Confirm Emergency
 </h1>
 <p style={{ color: '#888', fontSize: 12, margin: 0, marginBottom: 20 }}>
 Enter your 4-digit PIN to send SOS
 </p>
 {error && <div style={{padding: 12, background: 'rgba(230,57,70,0.2)', color: '#ff6b6b', borderRadius: 8, marginBottom: 12}}>{error}</div>}
 </div>
 <div className="w-full mb-6">
 <button onClick={handleSubmit} disabled={loading || pin.length !== 4} style={{width: '100%', padding: '16px', borderRadius: 12, background: pin.length === 4 && !loading ? 'var(--sos-red)' : '#555', border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer'}}>
 {loading ? 'Sending SOS...' : 'Send Emergency Alert'}
 </button>
 </div>
 </div>
 );
}
