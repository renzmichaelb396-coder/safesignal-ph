const BASE = '';

export function normalizeAlert(a: any): any {
  if (!a) return a;
  return {
    ...a,
    full_name: a.full_name || a.name || 'Unknown',
    phone: a.phone || a.phone_number || '',
    triggered_at: typeof a.triggered_at === 'number' ? (a.triggered_at < 10000000000 ? a.triggered_at * 1000 : a.triggered_at) : Date.now()
  };
}

export const dispatchApi = {
  async getAlerts() {
    const r = await fetch(`${BASE}/api/dispatch/alerts`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    if (!r.ok) throw new Error(`getAlerts: ${r.status}`);
    const d = await r.json();
    return (d.alerts || []).map(normalizeAlert);
  },
  async getAlert(id: number) {
    const r = await fetch(`${BASE}/api/dispatch/alerts/${id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    if (!r.ok) throw new Error(`getAlert: ${r.status}`);
    const d = await r.json();
    return normalizeAlert(d.alert);
  },
  async getActiveAlert() {
    const r = await fetch(`${BASE}/api/dispatch/alerts/active`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    if (!r.ok) throw new Error(`getActiveAlert: ${r.status}`);
    const d = await r.json();
    return normalizeAlert(d.alert);
  }
};

export const citizenApi = {
  async sendSos(data: any) {
    const r = await fetch(`${BASE}/api/citizen/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async getActiveAlert() {
    const id = localStorage.getItem('active_sos_id');
    if (!id) throw new Error('No active SOS');
    const r = await fetch(`${BASE}/api/citizen/alerts/${id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    if (!r.ok) throw new Error(`getActiveAlert: ${r.status}`);
    const d = await r.json();
    return normalizeAlert(d.alert);
  }
};

export function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
