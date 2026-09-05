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
      <main className="admin-fatal-shell">
        <section className="admin-fatal-card" role="alert">
          <div className="admin-fatal-mark" aria-hidden="true">COT</div>
          <p className="admin-fatal-kicker">Platform Administration</p>
          <h1>This page could not be opened</h1>
          <p className="admin-fatal-copy">
            Reload the page to try again. If the problem continues, the platform support team can review the application logs.
          </p>
          <button type="button" onClick={() => window.location.reload()} className="admin-btn-base admin-btn-gold admin-btn-md">
            Reload page
          </button>
        </section>
      </main>
    );
  }
}
