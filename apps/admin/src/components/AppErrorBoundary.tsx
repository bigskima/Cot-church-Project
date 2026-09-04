import React, { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Platform Administration render failure', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#061426',
          color: '#F8FAFC',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <section
          style={{
            width: 'min(560px, 100%)',
            border: '1px solid #21344B',
            borderRadius: 16,
            background: '#0C1929',
            padding: 28,
          }}
        >
          <p style={{ color: '#6EA8FF', fontWeight: 700, marginBottom: 8 }}>Platform Administration</p>
          <h1 style={{ fontSize: 24, marginBottom: 10 }}>This page could not be opened.</h1>
          <p style={{ color: '#CBD5E1', lineHeight: 1.6, marginBottom: 18 }}>
            Reload the page to try again. If the problem continues, contact the platform support team.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: 10,
              background: '#2F6FED',
              color: '#FFFFFF',
              fontWeight: 800,
              padding: '12px 18px',
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </section>
      </main>
    );
  }
}
