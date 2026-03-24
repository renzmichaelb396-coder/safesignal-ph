import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a2e' }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
        <h1 style={{ color: '#fff', fontSize: 48, fontWeight: 800 }}>404</h1>
        <h2 style={{ color: '#aaa', fontSize: 20, marginBottom: 24 }}>Page Not Found</h2>
        <p style={{ color: '#666', marginBottom: 32 }}>
          Sorry, the page you are looking for doesn't exist.
        </p>
        <button
          onClick={() => setLocation("/")}
          style={{ padding: '12px 24px', borderRadius: 12, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
