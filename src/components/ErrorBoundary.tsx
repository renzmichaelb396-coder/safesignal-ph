import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 32, background: '#0a0a2e' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 512, padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 24 }}>⚠️</div>
            <h2 style={{ fontSize: 20, marginBottom: 16, color: '#fff' }}>An unexpected error occurred.</h2>
            <div style={{ padding: 16, width: '100%', borderRadius: 8, background: 'rgba(255,255,255,0.1)', overflow: 'auto', marginBottom: 24 }}>
              <pre style={{ fontSize: 12, color: '#ccc', whiteSpace: 'pre-wrap' }}>
                {this.state.error?.stack}
              </pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
