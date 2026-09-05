import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient, AuthState } from '../api';
import { Badge } from './ui';
import { PlatformOverview } from '../pages/PlatformOverview';
import { OrganizationsGovernance } from '../pages/OrganizationsGovernance';
import { ExpressionsGovernance } from '../pages/ExpressionsGovernance';
import { UserGovernance } from '../pages/UserGovernance';
import { AdminInvitations } from '../pages/AdminInvitations';
import { ExpressionCreators } from '../pages/ExpressionCreators';
import { BrandingAppearance } from '../pages/BrandingAppearance';
import { PublicDirectory } from '../pages/PublicDirectory';
import { StreamingInfrastructure } from '../pages/StreamingInfrastructure';
import { AiInfrastructure } from '../pages/AiInfrastructure';
import { PaymentInfrastructure } from '../pages/PaymentInfrastructure';
import { ProviderCredentials } from '../pages/ProviderCredentials';
import { FeatureFlags } from '../pages/FeatureFlags';
import { IntegrationsJobs } from '../pages/IntegrationsJobs';
import { AuditSecurity } from '../pages/AuditSecurity';

type NavItem = { key: string; label: string; permission: string; superAdminOnly?: boolean };
type NavSection = { group: string; items: NavItem[] };

const allNavSections: NavSection[] = [
  {
    group: 'Platform',
    items: [
      { key: 'overview', label: 'Overview', permission: 'platform.overview.read' },
      { key: 'organizations', label: 'Church Organisations', permission: 'platform.organizations.read' },
      { key: 'expressions', label: 'Expressions', permission: 'platform.expressions.read' },
      { key: 'users', label: 'Accounts & Access', permission: 'platform.users.read' },
      { key: 'admin-invitations', label: 'Administrator Access', permission: 'platform.roles.manage', superAdminOnly: true },
      { key: 'expression-creators', label: 'Expression Creation Access', permission: 'platform.expression_creators.manage', superAdminOnly: true },
      { key: 'branding', label: 'Branding & Identity', permission: 'platform.branding.manage' },
      { key: 'public-directory', label: 'Community Directory', permission: 'platform.public_directory.manage' },
      { key: 'features', label: 'Feature Availability', permission: 'platform.features.read' },
    ],
  },
  {
    group: 'Services & Operations',
    items: [
      { key: 'credentials', label: 'Secure Credentials', permission: 'platform.secrets.manage' },
      { key: 'streaming', label: 'Streaming Services', permission: 'platform.streaming.read' },
      { key: 'ai', label: 'AI Services', permission: 'platform.ai.read' },
      { key: 'payments', label: 'Payment Services', permission: 'platform.payments.read' },
      { key: 'integrations', label: 'System Activity', permission: 'platform.integrations.read' },
      { key: 'audit', label: 'Audit & Security', permission: 'platform.audit.read' },
    ],
  },
];

type PlatformAuthority = { displayName: string; roleName: string; roleCode: string };

export function Shell({ api, auth, updateAuth }: { api: ApiClient; auth: AuthState; updateAuth: (auth: AuthState | null) => void }) {
  const [page, setPage] = useState<string>('overview');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>([]);
  const [authority, setAuthority] = useState<PlatformAuthority>({ displayName: 'Administrator', roleName: 'Platform Administrator', roleCode: '' });

  const isSuperAdmin = authority.roleCode === 'super_admin';
  const navSections = useMemo(
    () => allNavSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => (!item.superAdminOnly || isSuperAdmin) && (isSuperAdmin || effectivePermissions.includes(item.permission)),
        ),
      }))
      .filter((section) => section.items.length),
    [effectivePermissions, isSuperAdmin],
  );
  const allowedPageKeys = useMemo(
    () => new Set(navSections.flatMap((section) => section.items.map((item) => item.key))),
    [navSections],
  );

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  useEffect(() => {
    let active = true;
    api.request<{
      profile?: { display_name?: string | null };
      roles?: Array<{ platform_roles?: { name?: string | null } | null; role_code?: string }>;
      effectivePermissions?: string[];
    }>('platform-context')
      .then((data) => {
        if (!active) return;
        const sortedRoles = [...(data.roles ?? [])].sort((a, b) => (a.role_code === 'super_admin' ? -1 : b.role_code === 'super_admin' ? 1 : 0));
        const firstRole = sortedRoles[0];
        setEffectivePermissions(data.effectivePermissions ?? []);
        setAuthority({
          displayName: data.profile?.display_name?.trim() || 'Administrator',
          roleName: firstRole?.platform_roles?.name?.trim() || firstRole?.role_code?.replaceAll('_', ' ') || 'Platform Administrator',
          roleCode: firstRole?.role_code ?? '',
        });
      })
      .catch(() => { if (active) updateAuth(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, updateAuth, auth.accessToken]);

  useEffect(() => {
    if (!loading && !allowedPageKeys.has(page)) setPage('overview');
  }, [allowedPageKeys, loading, page]);

  const navigate = (nextPage: string) => {
    if (!allowedPageKeys.has(nextPage)) return;
    setPage(nextPage);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    if (!allowedPageKeys.has(page)) return <PlatformOverview api={api} onNavigate={navigate} allowedPages={allowedPageKeys} />;
    switch (page) {
      case 'overview': return <PlatformOverview api={api} onNavigate={navigate} allowedPages={allowedPageKeys} />;
      case 'organizations': return <OrganizationsGovernance api={api} />;
      case 'expressions': return <ExpressionsGovernance api={api} />;
      case 'users': return <UserGovernance api={api} />;
      case 'admin-invitations': return isSuperAdmin ? <AdminInvitations api={api} /> : <PlatformOverview api={api} onNavigate={navigate} allowedPages={allowedPageKeys} />;
      case 'expression-creators': return isSuperAdmin ? <ExpressionCreators api={api} /> : <PlatformOverview api={api} onNavigate={navigate} allowedPages={allowedPageKeys} />;
      case 'branding': return <BrandingAppearance api={api} />;
      case 'public-directory': return <PublicDirectory api={api} />;
      case 'credentials': return <ProviderCredentials api={api} />;
      case 'streaming': return <StreamingInfrastructure api={api} />;
      case 'ai': return <AiInfrastructure api={api} />;
      case 'payments': return <PaymentInfrastructure api={api} />;
      case 'features': return <FeatureFlags api={api} />;
      case 'integrations': return <IntegrationsJobs api={api} />;
      case 'audit': return <AuditSecurity api={api} />;
      default: return <PlatformOverview api={api} onNavigate={navigate} allowedPages={allowedPageKeys} />;
    }
  };

  const getPageTitle = () => {
    for (const section of allNavSections) {
      const match = section.items.find((item) => item.key === page);
      if (match) return match.label;
    }
    return 'Platform Administration';
  };

  return (
    <div className="admin-shell">
      <button
        type="button"
        className={`admin-sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close navigation"
      />
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-brand"><div className="admin-brand-icon">COT</div><div className="admin-brand-text"><h1>City of Transformation</h1><p>Platform Administration</p></div></div>
        <nav className="admin-nav">
          {navSections.map((section) => (
            <div key={section.group} className="admin-nav-group">
              <div className="admin-nav-group-title">{section.group}</div>
              {section.items.map((item) => {
                const isActive = page === item.key;
                return <button key={item.key} type="button" onClick={() => navigate(item.key)} className={`admin-nav-item ${isActive ? 'active' : ''}`}>
                  <span className="admin-nav-indicator" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>;
              })}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer"><div className="admin-user-pill"><div className="admin-user-info"><span className="admin-user-name">{authority.displayName}</span><span className="admin-user-role">{authority.roleName}</span></div><button type="button" onClick={() => updateAuth(null)} className="admin-btn-ghost admin-btn-sm" title="Sign out of Platform Administration">Sign out</button></div></div>
      </aside>

      <div className="admin-main-stage">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-mobile-menu"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={sidebarOpen}
            >
              <span />
              <span />
              <span />
            </button>
            <div className="admin-page-heading">
              <span className="admin-topbar-kicker">Platform control</span>
              <h2 className="admin-topbar-title">{getPageTitle()}</h2>
            </div>
            <Badge label="ADMIN" variant="gold" />
          </div>
          <div className="admin-topbar-right">
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              className="admin-theme-toggle"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              <span className={`admin-theme-dot ${theme}`} aria-hidden="true" />
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </header>
        <main className="admin-content-viewport">
          {loading ? <div className="admin-table-loading" style={{ padding: 120 }}><span className="admin-spinner" /><p>Loading Platform Administration…</p></div> : renderContent()}
        </main>
      </div>
    </div>
  );
}
