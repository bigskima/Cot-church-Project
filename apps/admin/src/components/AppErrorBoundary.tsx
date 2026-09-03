import React, { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Platform Admin render failure', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#140C07',
          color: '#FFFDF9',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <section
          style={{
            width: 'min(560px, 100%)',
            border: '1px solid #613C25',
            borderRadius: 18,
            background: '#22140C',
            padding: 28,
          }}
        >
          <p style={{ color: '#F59E0B', fontWeight: 800, marginBottom: 8 }}>Platform Administration</p>
          <h1 style={{ fontSize: 24, marginBottom: 10 }}>This screen could not be rendered.</h1>
          <p style={{ color: '#E6CCB2', lineHeight: 1.6, marginBottom: 18 }}>
            The application recovered instead of showing a blank page. Reload the control plane. If the problem repeats, the browser console will contain the render failure for diagnosis.
          </p>
          <details style={{ color: '#A68A75', marginBottom: 18 }}>
            <summary>Technical detail</summary>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 10 }}>
              {this.state.error.message}
            </pre>
          </details>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: 10,
              background: '#F59E0B',
              color: '#26140A',
              fontWeight: 800,
              padding: '12px 18px',
              cursor: 'pointer',
            }}
          >
            Reload Platform Administration
          </button>
        </section>
      </main>
    );
  }
}
