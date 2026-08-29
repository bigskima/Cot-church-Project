import React, { useEffect, useState } from 'react';
import type { ApiClient, AuthState } from '../api';
import { Badge } from './ui';
import { PlatformOverview } from '../pages/PlatformOverview';
import { OrganizationsGovernance } from '../pages/OrganizationsGovernance';
import { ExpressionsGovernance } from '../pages/ExpressionsGovernance';
import { UserGovernance } from '../pages/UserGovernance';
import { BrandingAppearance } from '../pages/BrandingAppearance';
import { StreamingInfrastructure } from '../pages/StreamingInfrastructure';
import { AiInfrastructure } from '../pages/AiInfrastructure';
import { PaymentInfrastructure } from '../pages/PaymentInfrastructure';
import { FeatureFlags } from '../pages/FeatureFlags';
import { IntegrationsJobs } from '../pages/IntegrationsJobs';
import { AuditSecurity } from '../pages/AuditSecurity';

const navSections = [
  {
    group: 'Platform Ecosystem',
    items: [
      { key: 'overview', label: 'Platform Telemetry', icon: '📊' },
      { key: 'organizations', label: 'Church Organizations', icon: '🏛' },
      { key: 'expressions', label: 'Expression Campuses', icon: '🌿' },
      { key: 'users', label: 'Global Identities', icon: '👥' },
      { key: 'branding', label: 'Branding & Identity', icon: '🎨' },
      { key: 'features', label: 'Tenant Feature Flags', icon: '⚑' },
    ],
  },
  {
    group: 'Provider Infrastructure',
    items: [
      { key: 'streaming', label: 'Video Broadcast Adapter', icon: '📡' },
      { key: 'ai', label: 'AI Gateway & Models', icon: '✦' },
      { key: 'payments', label: 'Payment Gateways', icon: '💳' },
      { key: 'integrations', label: 'Jobs & Webhooks', icon: '⚡' },
      { key: 'audit', label: 'Audit & Security', icon: '🛡' },
    ],
  },
] as const;

export function Shell({
  api,
  auth,
  updateAuth,
}: {
  api: ApiClient;
  auth: AuthState;
  updateAuth: (auth: AuthState | null) => void;
}) {
  const [page, setPage] = useState<string>('overview');
  const [loading, setLoading] = useState(!auth.organizationId);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    if (auth.organizationId) return;
    api
      .request<{ memberships: Array<{ organization: { id: string; name: string }; branch?: { id: string } }> }>(
        'organization-context'
      )
      .then((data) => {
        const first = data.memberships?.[0];
        if (first) {
          updateAuth({
            ...auth,
            organizationId: first.organization.id,
            branchId: first.branch?.id,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const renderContent = () => {
    switch (page) {
      case 'overview':
        return <PlatformOverview api={api} onNavigate={setPage} />;
      case 'organizations':
        return <OrganizationsGovernance api={api} />;
      case 'expressions':
        return <ExpressionsGovernance api={api} />;
      case 'users':
        return <UserGovernance api={api} />;
      case 'branding':
        return <BrandingAppearance api={api} />;
      case 'streaming':
        return <StreamingInfrastructure api={api} />;
      case 'ai':
        return <AiInfrastructure api={api} />;
      case 'payments':
        return <PaymentInfrastructure api={api} />;
      case 'features':
        return <FeatureFlags api={api} />;
      case 'integrations':
        return <IntegrationsJobs api={api} />;
      case 'audit':
        return <AuditSecurity api={api} />;
      default:
        return <PlatformOverview api={api} onNavigate={setPage} />;
    }
  };

  const getPageTitle = () => {
    for (const section of navSections) {
      const match = section.items.find((item) => item.key === page);
      if (match) return match.label;
    }
    return 'Platform Governance';
  };

  return (
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-icon">✦</div>
          <div className="admin-brand-text">
            <h1>Sanctuary OS</h1>
            <p>Platform Control Plane</p>
          </div>
        </div>

        <nav className="admin-nav">
          {navSections.map((section, idx) => (
            <div key={idx} className="admin-nav-group">
              <div className="admin-nav-group-title">{section.group}</div>
              {section.items.map((item) => {
                const isActive = page === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPage(item.key)}
                    className={`admin-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="admin-nav-item-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-pill">
            <div className="admin-user-info">
              <span className="admin-user-name">Platform Authority</span>
              <span className="admin-user-role">Super Administrator</span>
            </div>
            <button
              type="button"
              onClick={() => updateAuth(null)}
              className="admin-btn-ghost admin-btn-sm"
              title="Sign out of control plane"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Stage */}
      <div className="admin-main-stage">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <h2 className="admin-topbar-title">{getPageTitle()}</h2>
            <Badge label="LEVEL 1 AUTHORITY" variant="gold" />
          </div>

          <div className="admin-topbar-right">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="admin-btn-secondary admin-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <div className="admin-system-health-pill">
              <span className="pulse-live-dot" />
              <span>All Systems Operational</span>
            </div>
          </div>
        </header>

        <main className="admin-content-viewport">
          {loading ? (
            <div className="admin-table-loading" style={{ padding: 120 }}>
              <span className="admin-spinner" />
              <p>Authenticating Platform Authority session...</p>
            </div>
          ) : (
            renderContent()
          )}
        </main>
      </div>
    </div>
  );
}
