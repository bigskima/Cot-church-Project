import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SearchBar, SelectField, Table } from '../components/ui';

type ScopeType = 'global' | 'organization' | 'expression' | 'group';
type OverrideState = 'inherit' | 'enabled' | 'disabled';

type FeatureOverride = {
  enabled?: boolean | null;
  reason?: string | null;
  updated_at?: string | null;
};

type FeatureFlag = {
  key: string;
  name: string;
  category: string;
  description: string;
  global_enabled: boolean;
  rollout_percentage: number;
  configuration: Record<string, unknown>;
  organization_override?: FeatureOverride | null;
  expression_override?: FeatureOverride | null;
  group_override?: FeatureOverride | null;
  direct_enabled: boolean;
  effective_enabled: boolean;
  inherited_from: 'global' | 'organization' | 'expression' | 'group';
  blocked_by?: string | null;
};

type FeaturePayload = {
  organizationId: string | null;
  expressionId: string | null;
  groupId: string | null;
  items: FeatureFlag[];
};

type ScopeDirectory = {
  organizations: Array<{ id: string; name: string; slug?: string | null; status?: string | null }>;
  expressions: Array<{ id: string; organization_id: string; name: string; code?: string | null; is_active?: boolean | null }>;
  groups: Array<{ id: string; organization_id: string; branch_id?: string | null; name: string; is_active?: boolean | null }>;
};

function featureScopes(flag: FeatureFlag) {
  const value = flag.configuration?.scopes;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function operationalVisible(flag: FeatureFlag) {
  return flag.configuration?.operationalVisible !== false;
}

function overrideFor(flag: FeatureFlag, scopeType: ScopeType): FeatureOverride | null {
  if (scopeType === 'organization') return flag.organization_override ?? null;
  if (scopeType === 'expression') return flag.expression_override ?? null;
  if (scopeType === 'group') return flag.group_override ?? null;
  return null;
}

function controlState(flag: FeatureFlag, scopeType: ScopeType): OverrideState {
  if (scopeType === 'global') return flag.global_enabled ? 'enabled' : 'disabled';
  const override = overrideFor(flag, scopeType);
  if (override?.enabled === true) return 'enabled';
  if (override?.enabled === false) return 'disabled';
  return 'inherit';
}

function stateLabel(value: OverrideState) {
  if (value === 'enabled') return 'ENABLED';
  if (value === 'disabled') return 'DISABLED';
  return 'INHERIT';
}

function categoryLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AppControlsPanel({
  api,
  canRead = false,
  canManage = false,
}: {
  api: ApiClient;
  canRead?: boolean;
  canManage?: boolean;
}) {
  const [directory, setDirectory] = useState<ScopeDirectory | null>(null);
  const [scopeType, setScopeType] = useState<ScopeType>('global');
  const [organizationId, setOrganizationId] = useState('');
  const [expressionId, setExpressionId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [payload, setPayload] = useState<FeaturePayload | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [draftState, setDraftState] = useState<OverrideState>('inherit');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const expressions = useMemo(
    () => (directory?.expressions ?? []).filter((item) => !organizationId || item.organization_id === organizationId),
    [directory?.expressions, organizationId],
  );

  const groups = useMemo(
    () => (directory?.groups ?? []).filter((item) => {
      if (organizationId && item.organization_id !== organizationId) return false;
      if (expressionId && item.branch_id !== expressionId) return false;
      return true;
    }),
    [directory?.groups, expressionId, organizationId],
  );

  const scopeReady =
    scopeType === 'global' ||
    (scopeType === 'organization' && Boolean(organizationId)) ||
    (scopeType === 'expression' && Boolean(expressionId)) ||
    (scopeType === 'group' && Boolean(groupId));

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (scopeType !== 'global' && organizationId) params.set('organizationId', organizationId);
    if ((scopeType === 'expression' || scopeType === 'group') && expressionId) params.set('expressionId', expressionId);
    if (scopeType === 'group' && groupId) params.set('groupId', groupId);
    const value = params.toString();
    return value ? `platform-features?${value}` : 'platform-features';
  }, [expressionId, groupId, organizationId, scopeType]);

  const loadDirectory = async () => {
    if (!canRead) return;
    setDirectoryLoading(true);
    try {
      const data = await api.request<ScopeDirectory>('platform-features?view=scopes');
      setDirectory(data);
      if (!organizationId && data.organizations.length) setOrganizationId(data.organizations[0].id);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load app-control scopes.');
    } finally {
      setDirectoryLoading(false);
    }
  };

  const load = async () => {
    if (!canRead || !scopeReady) {
      setPayload(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.request<FeaturePayload>(query);
      setPayload(data);
    } catch (value) {
      setPayload(null);
      setError(value instanceof Error ? value.message : 'Unable to load app controls.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDirectory();
  }, [api, canRead]);

  useEffect(() => {
    void load();
  }, [api, canRead, query, scopeReady]);

  useEffect(() => {
    if (!organizationId) return;
    if (expressionId && !expressions.some((item) => item.id === expressionId)) {
      setExpressionId('');
      setGroupId('');
    }
  }, [expressionId, expressions, organizationId]);

  useEffect(() => {
    if (groupId && !groups.some((item) => item.id === groupId)) setGroupId('');
  }, [groupId, groups]);

  const categories = useMemo(
    () => Array.from(new Set((payload?.items ?? []).filter(operationalVisible).map((item) => item.category))).sort(),
    [payload?.items],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (payload?.items ?? []).filter((item) => {
      if (!operationalVisible(item)) return false;
      if (scopeType !== 'global' && !featureScopes(item).includes(scopeType)) return false;
      if (category !== 'all' && item.category !== category) return false;
      if (!needle) return true;
      return [item.name, item.key, item.category, item.description].some((value) => value.toLowerCase().includes(needle));
    });
  }, [category, payload?.items, scopeType, search]);

  const openControl = (flag: FeatureFlag) => {
    setEditing(flag);
    setDraftState(controlState(flag, scopeType));
    setReason('');
    setError('');
    setNotice('');
  };

  const saveControl = async () => {
    if (!editing || !canManage) return;
    if (reason.trim().length < 3) {
      setError('Add a short reason for this availability change.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (scopeType === 'global') {
        await api.request('platform-features', {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'set_global',
            key: editing.key,
            enabled: draftState === 'enabled',
            rolloutPercentage: editing.rollout_percentage,
            configuration: editing.configuration ?? {},
            reason: reason.trim(),
          }),
        });
      } else if (draftState === 'inherit') {
        await api.request('platform-features', {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'clear_scope_override',
            scopeType,
            organizationId: organizationId || undefined,
            expressionId: expressionId || undefined,
            groupId: groupId || undefined,
            key: editing.key,
            reason: reason.trim(),
          }),
        });
      } else {
        await api.request('platform-features', {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'set_scope_override',
            scopeType,
            organizationId: organizationId || undefined,
            expressionId: expressionId || undefined,
            groupId: groupId || undefined,
            key: editing.key,
            enabled: draftState === 'enabled',
            rolloutPercentage: null,
            configuration: {},
            reason: reason.trim(),
          }),
        });
      }

      setNotice(`${editing.name} availability updated.`);
      setEditing(null);
      setReason('');
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update this app control.');
    } finally {
      setSaving(false);
    }
  };

  if (!canRead) {
    return (
      <Card title="App Controls" subtitle="Feature availability is managed by administrators with Platform Feature access.">
        <div className="admin-muted">Your administrator role does not include feature-availability access.</div>
      </Card>
    );
  }

  const selectedOrganization = directory?.organizations.find((item) => item.id === organizationId);
  const selectedExpression = directory?.expressions.find((item) => item.id === expressionId);
  const selectedGroup = directory?.groups.find((item) => item.id === groupId);
  const scopeTitle =
    scopeType === 'global' ? 'Entire COT platform' :
    scopeType === 'organization' ? selectedOrganization?.name ?? 'Church / General COT' :
    scopeType === 'expression' ? selectedExpression?.name ?? 'Expression' :
    selectedGroup?.name ?? 'Group';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {error ? <div className="admin-form-error" role="alert">{error}</div> : null}
      {notice ? (
        <div className="admin-card" style={{ padding: 14, borderColor: 'var(--admin-success, #2db783)' }}>
          <strong>{notice}</strong>
        </div>
      ) : null}

      <Card
        title="App Controls"
        subtitle="Operational availability only. These switches do not delete data, change ministry permissions or replace the working feature backend."
        headerAction={<Badge label={scopeType === 'global' ? 'GLOBAL' : 'SCOPED'} variant={scopeType === 'global' ? 'gold' : 'neutral'} />}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="admin-form-grid-two">
            <SelectField
              label="Control scope"
              value={scopeType}
              onChange={(event) => {
                const next = event.target.value as ScopeType;
                setScopeType(next);
                setExpressionId('');
                setGroupId('');
                setSearch('');
                setCategory('all');
              }}
              options={[
                { label: 'Global · entire COT platform', value: 'global' },
                { label: 'Church / General COT', value: 'organization' },
                { label: 'Expression', value: 'expression' },
                { label: 'Group', value: 'group' },
              ]}
            />

            {scopeType !== 'global' ? (
              <SelectField
                label="Church organisation"
                value={organizationId}
                onChange={(event) => {
                  setOrganizationId(event.target.value);
                  setExpressionId('');
                  setGroupId('');
                }}
                disabled={directoryLoading}
                options={[
                  { label: 'Choose church…', value: '' },
                  ...(directory?.organizations ?? []).map((item) => ({ label: item.name, value: item.id })),
                ]}
              />
            ) : null}

            {scopeType === 'expression' || scopeType === 'group' ? (
              <SelectField
                label={scopeType === 'group' ? 'Expression (optional for General groups)' : 'Expression'}
                value={expressionId}
                onChange={(event) => {
                  setExpressionId(event.target.value);
                  setGroupId('');
                }}
                options={[
                  { label: scopeType === 'group' ? 'General COT / no Expression' : 'Choose Expression…', value: '' },
                  ...expressions.map((item) => ({ label: item.name, value: item.id })),
                ]}
              />
            ) : null}

            {scopeType === 'group' ? (
              <SelectField
                label="Group"
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                options={[
                  { label: 'Choose Group…', value: '' },
                  ...groups.map((item) => ({ label: item.name, value: item.id })),
                ]}
              />
            ) : null}
          </div>

          <div className="admin-card" style={{ padding: 14, background: 'var(--admin-surface-muted, transparent)' }}>
            <strong>{scopeTitle}</strong>
            <p className="admin-muted" style={{ marginTop: 5, lineHeight: 1.5 }}>
              Higher-level OFF switches always win. A scoped ENABLED value cannot bypass a parent scope or master feature that is OFF.
              INHERIT removes the local override and follows the next higher scope.
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Feature availability"
        subtitle={scopeReady ? `${visible.length} operational control${visible.length === 1 ? '' : 's'} for this scope.` : 'Choose a complete scope to manage its controls.'}
        headerAction={
          <div className="admin-header-actions">
            <SelectField
              aria-label="Feature category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              options={[
                { label: 'All categories', value: 'all' },
                ...categories.map((item) => ({ label: categoryLabel(item), value: item })),
              ]}
            />
            <SearchBar value={search} onChange={setSearch} placeholder="Search app controls…" />
            <Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>Refresh</Button>
          </div>
        }
      >
        <Table
          columns={[
            {
              header: 'FEATURE',
              accessor: (item) => (
                <div>
                  <div className="admin-row-title">{item.name}</div>
                  <div className="admin-row-meta">{item.description}</div>
                </div>
              ),
            },
            {
              header: 'CATEGORY',
              accessor: (item) => <Badge label={categoryLabel(item.category).toUpperCase()} variant="neutral" />,
            },
            {
              header: scopeType === 'global' ? 'GLOBAL STATE' : 'THIS SCOPE',
              accessor: (item) => {
                const state = controlState(item, scopeType);
                return <Badge label={stateLabel(state)} variant={state === 'enabled' ? 'active' : state === 'disabled' ? 'suspended' : 'neutral'} />;
              },
            },
            {
              header: 'EFFECTIVE',
              accessor: (item) => (
                <div>
                  <Badge label={item.effective_enabled ? 'AVAILABLE' : 'UNAVAILABLE'} variant={item.effective_enabled ? 'active' : 'suspended'} />
                  {item.blocked_by ? (
                    <div className="admin-row-meta" style={{ marginTop: 4 }}>
                      Blocked by {payload?.items.find((candidate) => candidate.key === item.blocked_by)?.name ?? item.blocked_by}
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              header: 'CONTROL',
              accessor: (item) => canManage ? (
                <Button variant="outline" size="sm" onClick={() => openControl(item)}>Change</Button>
              ) : <span className="admin-muted">Read only</span>,
            },
          ]}
          data={scopeReady ? visible : []}
          keyExtractor={(item) => item.key}
          loading={loading}
          emptyMessage={scopeReady ? 'No controls match this filter.' : 'Choose a scope first.'}
        />
      </Card>

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => { if (!saving) setEditing(null); }}
        title={editing ? `App control · ${editing.name}` : 'App control'}
        subtitle={scopeTitle}
        footer={
          <div className="admin-header-actions">
            <Button variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant={draftState === 'disabled' ? 'danger' : 'primary'}
              loading={saving}
              disabled={!canManage}
              onClick={() => void saveControl()}
            >
              Apply control
            </Button>
          </div>
        }
      >
        <SelectField
          label="Availability"
          value={draftState}
          onChange={(event) => setDraftState(event.target.value as OverrideState)}
          options={scopeType === 'global'
            ? [
                { label: 'Enabled', value: 'enabled' },
                { label: 'Disabled', value: 'disabled' },
              ]
            : [
                { label: 'Inherit from higher scope', value: 'inherit' },
                { label: 'Enabled at this scope', value: 'enabled' },
                { label: 'Disabled at this scope', value: 'disabled' },
              ]}
        />
        <InputField
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why is this availability changing?"
          helperText="Recorded in Audit & Security with the administrator, scope, previous policy and new policy."
        />
        {editing?.blocked_by && draftState === 'enabled' ? (
          <div className="admin-inline-error">
            This feature is currently blocked by its parent control. Enabling it here will not bypass that higher-level restriction.
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
