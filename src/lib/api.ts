const BASE = '';

/**
 * Normalize an alert object from either server version:
 * - api/index.ts (Vercel): triggered_at in seconds, name/phone_number fields
 * - server/safesignal: triggered_at in ms, full_name/phone fields
 * Ensures Dashboard and SosActive always get consistent field names and ms timestamps.
 */
export function normalizeAlert(a: any): any {
  if (!a) return a;
  return {
    ...a,
    full_name: a.full_name || a.name || 'Unknown',
    phone: a.phone || a.phone_number || '',
    triggered_at: a.triggered_at && a.triggered_at < 1e10 ? a.triggered_at * 1000 : a.triggered_at,
    lat: a.lat ?? a.latitude ?? null,
    lng: a.lng ?? a.longitude ?? null,
  };
}

function getToken(type) {
  return localStorage.getItem(`safesignal_${type}_token`);
}

export function setToken(type, token) {
  localStorage.setItem(`safesignal_${type}_token`, token);
}

export function clearToken(type) {
  localStorage.removeItem(`safesignal_${type}_token`);
}

async function request(path, options = {}, authType) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (authType) {
    const token = getToken(authType);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const raw = await res.text();
  let data: any = {};
  try { data = JSON.parse(raw); } catch {
    throw new Error(raw.trim().slice(0, 200) || `Request failed: ${res.status}`);
  }
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const citizenApi = {
  register: (body) => request('/api/citizen/register', { method: 'POST', body: JSON.stringify(body) }),
  verifyOtp: (body) => request('/api/citizen/verify-otp', { method: 'POST', body: JSON.stringify(body) }),
  resendOtp: (body) => request('/api/citizen/resend-otp', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/citizen/login', { method: 'POST', body: JSON.stringify(body) }),
  getProfile: () => request('/api/citizen/profile', {}, 'citizen'),
  updateProfile: (body) => request('/api/citizen/profile', { method: 'PUT', body: JSON.stringify(body) }, 'citizen'),
  verifyPin: (pin) => request('/api/citizen/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) }, 'citizen'),
  sendSos: (body) => request('/api/citizen/sos', { method: 'POST', body: JSON.stringify(body) }, 'citizen'),
  getActiveAlert: async () => {
    const data = await request('/api/citizen/active-alert', {}, 'citizen');
    return { ...data, alert: normalizeAlert(data.alert) };
  },
  cancelSos: (reason) => request('/api/citizen/sos/cancel', { method: 'POST', body: JSON.stringify({ reason }) }, 'citizen'),
  updateLocation: (lat, lng) => request('/api/citizen/location-update', { method: 'POST', body: JSON.stringify({ lat, lng }) }, 'citizen'),
  getAlerts: () => request('/api/citizen/alerts', {}, 'citizen'),
};

export const dispatchApi = {
  login: (body) => request('/api/dispatch/login', { method: 'POST', body: JSON.stringify(body) }),
  getAlerts: async (status) => {
    const data = await request(`/api/dispatch/alerts${status ? `?status=${status}` : ''}`, {}, 'officer');
    return { ...data, alerts: (data.alerts || []).map(normalizeAlert) };
  },
  getAlert: async (id) => {
    const data = await request(`/api/dispatch/alerts/${id}`, {}, 'officer');
    return { ...data, alert: normalizeAlert(data.alert) };
  },
  acknowledge: (id) => request(`/api/dispatch/alerts/${id}/acknowledge`, { method: 'POST' }, 'officer'),
  resolve: (id, notes) => request(`/api/dispatch/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({ notes }) }, 'officer'),
  falseAlarm: (id, notes) => request(`/api/dispatch/alerts/${id}/false-alarm`, { method: 'POST', body: JSON.stringify({ notes }) }, 'officer'),
  markSuspicious: (id, reason) => request(`/api/dispatch/alerts/${id}/suspicious`, { method: 'POST', body: JSON.stringify({ reason }) }, 'officer'),
  assignOfficer: (id, officerId) => request(`/api/dispatch/alerts/${id}/assign`, { method: 'POST', body: JSON.stringify({ officer_id: officerId }) }, 'officer'),
  getCitizens: (params) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request(`/api/dispatch/citizens${qs ? `?${qs}` : ''}`, {}, 'officer');
  },
  getCitizen: (id) => request(`/api/dispatch/citizens/${id}`, {}, 'officer'),
  suspendCitizen: (id, reason) => request(`/api/dispatch/citizens/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }, 'officer'),
  unsuspendCitizen: (id) => request(`/api/dispatch/citizens/${id}/unsuspend`, { method: 'POST' }, 'officer'),
  resetStrikes: (id) => request(`/api/dispatch/citizens/${id}/reset-strikes`, { method: 'POST' }, 'officer'),
  verifyCitizen: (id, verified) => request(`/api/dispatch/citizens/${id}/verify`, { method: 'PATCH', body: JSON.stringify({ verified }) }, 'officer'),
  getOfficers: () => request('/api/dispatch/officers', {}, 'officer'),
  addOfficer: (body) => request('/api/dispatch/officers', { method: 'POST', body: JSON.stringify(body) }, 'officer'),
  toggleOfficerActive: (id) => request(`/api/dispatch/officers/${id}/toggle-active`, { method: 'POST' }, 'officer'),
  getStats: (query = '') => request('/api/dispatch/stats' + query, {}, 'officer'),
  getReports: (query = '') => request('/api/dispatch/reports' + query, {}, 'officer'),
  getSettings: () => request('/api/dispatch/settings', {}, 'officer'),
  updateSettings: (body) => request('/api/dispatch/settings', { method: 'PUT', body: JSON.stringify(body) }, 'officer'),
};

export function formatElapsed(ms) {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatDate(ts) {
  return new Date(ts).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
}

export function getStatusBadgeClass(status) {
  const map = {
    ACTIVE: 'badge-active',
    ACKNOWLEDGED: 'badge-acknowledged',
    RESOLVED: 'badge-resolved',
    CANCELLED: 'badge-cancelled',
    FALSE_ALARM: 'badge-false_alarm',
  };
  return map[status] || 'badge-cancelled';
}

export function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
