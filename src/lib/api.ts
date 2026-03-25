const BASE = '';

function getToken(type: 'citizen' | 'officer'): string | null {
  return localStorage.getItem(`safesignal_${type}_token`);
}

export function setToken(type: 'citizen' | 'officer', token: string): void {
  localStorage.setItem(`safesignal_${type}_token`, token);
}

export function clearToken(type: 'citizen' | 'officer'): void {
  localStorage.removeItem(`safesignal_${type}_token`);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authType?: 'citizen' | 'officer'
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authType) {
    const token = getToken(authType);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data as T;
}

// Citizen API
export const citizenApi = {
  register: (body: any) => request('/api/citizen/register', { method: 'POST', body: JSON.stringify(body) }),
  verifyOtp: (body: any) => request('/api/citizen/verify-otp', { method: 'POST', body: JSON.stringify(body) }),
  resendOtp: (body: any) => request('/api/citizen/resend-otp', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => request('/api/citizen/login', { method: 'POST', body: JSON.stringify(body) }),
  getProfile: () => request('/api/citizen/profile', {}, 'citizen'),
  updateProfile: (body: any) => request('/api/citizen/profile', { method: 'PUT', body: JSON.stringify(body) }, 'citizen'),
  verifyPin: (pin: string) => request('/api/citizen/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) }, 'citizen'),
  sendSos: (body: any) => request('/api/citizen/sos', { method: 'POST', body: JSON.stringify(body) }, 'citizen'),
  getActiveAlert: () => request('/api/citizen/active-alert', {}, 'citizen'),
  cancelSos: (reason: string) => request('/api/citizen/sos/cancel', { method: 'POST', body: JSON.stringify({ reason }) }, 'citizen'),
  updateLocation: (lat: number, lng: number) => request('/api/citizen/location-update', { method: 'POST', body: JSON.stringify({ lat, lng }) }, 'citizen'),
  getAlerts: () => request('/api/citizen/alerts', {}, 'citizen'),
};

// ── Alert field normalizer ──────────────────────────────────────────
// Backend: name, phone_number, triggered_at (unix sec), latitude, longitude
// Frontend: full_name, phone, triggered_at (unix sec), lat, lng
export function normalizeAlert(raw: any): any {
  return {
    ...raw,
    full_name: raw.full_name || raw.name || 'Unknown',
    phone: raw.phone || raw.phone_number || '',
    lat: raw.lat ?? raw.latitude ?? null,
    lng: raw.lng ?? raw.longitude ?? null,
  };
}

// Dispatch API
export const dispatchApi = {
  login: (body: any) => request('/api/dispatch/login', { method: 'POST', body: JSON.stringify(body) }),
  getAlerts: async (status?: string) => {
    const data: any = await request(`/api/dispatch/alerts${status ? `?status=${status}` : ''}`, {}, 'officer');
    if (data.alerts) data.alerts = data.alerts.map(normalizeAlert);
    return data;
  },
  getAlert: async (id: number) => {
    const data: any = await request(`/api/dispatch/alerts/${id}`, {}, 'officer');
    if (data.alert) data.alert = normalizeAlert(data.alert);
    return data;
  },
  acknowledge: (id: number) => request(`/api/dispatch/alerts/${id}/acknowledge`, { method: 'POST' }, 'officer'),
  resolve: (id: number, notes?: string) => request(`/api/dispatch/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({ notes }) }, 'officer'),
  falseAlarm: (id: number, notes?: string) => request(`/api/dispatch/alerts/${id}/false-alarm`, { method: 'POST', body: JSON.stringify({ notes }) }, 'officer'),
  markSuspicious: (id: number, reason: string) => request(`/api/dispatch/alerts/${id}/suspicious`, { method: 'POST', body: JSON.stringify({ reason }) }, 'officer'),
  getCitizens: (params?: { search?: string; filter?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request(`/api/dispatch/citizens${qs ? `?${qs}` : ''}`, {}, 'officer');
  },
  getCitizen: (id: number) => request(`/api/dispatch/citizens/${id}`, {}, 'officer'),
  suspendCitizen: (id: number, reason: string) => request(`/api/dispatch/citizens/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }, 'officer'),
  unsuspendCitizen: (id: number) => request(`/api/dispatch/citizens/${id}/unsuspend`, { method: 'POST' }, 'officer'),
  resetStrikes: (id: number) => request(`/api/dispatch/citizens/${id}/reset-strikes`, { method: 'POST' }, 'officer'),
  getOfficers: () => request('/api/dispatch/officers', {}, 'officer'),
  addOfficer: (body: any) => request('/api/dispatch/officers', { method: 'POST', body: JSON.stringify(body) }, 'officer'),
  toggleOfficerActive: (id: number) => request(`/api/dispatch/officers/${id}/toggle-active`, { method: 'POST' }, 'officer'),
  getStats: () => request('/api/dispatch/stats', {}, 'officer'),
  getSettings: () => request('/api/dispatch/settings', {}, 'officer'),
  updateSettings: (body: any) => request('/api/dispatch/settings', { method: 'PUT', body: JSON.stringify(body) }, 'officer'),
};

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
}

export function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'badge-active',
    ACKNOWLEDGED: 'badge-acknowledged',
    RESOLVED: 'badge-resolved',
    CANCELLED: 'badge-cancelled',
    FALSE_ALARM: 'badge-false_alarm',
  };
  return map[status] || 'badge-cancelled';
}

export function getInitials(name: string): string {
  return (name || 'UN').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
