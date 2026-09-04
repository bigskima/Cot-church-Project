import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SearchBar, Table, Toggle } from '../components/ui';

interface FeatureFlag {
  key: string;
  name: string;
  category: string;
  description: string;
  global_enabled: boolean;
  rollout_percentage: number;
  configuration: Record<string, unknown>;
  updated_at?: string;
  organization_override?: unknown;
  effective_enabled: boolean;
  effective_rollout_percentage: number;
}

interface FeaturePayload {
  organizationId: string | null;
  items: FeatureFlag[];
}

export function FeatureFlags({ api }: { api: ApiClient }) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [rolloutPercentage, setRolloutPercentage] = useState('100');
  const [disableReason, setDisableReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.request<FeaturePayload>('platform-features');
      setFlags(data.items ?? []);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load feature availability.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [api]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return flags;
    return flags.filter(
      (flag) =>
        flag.name.toLowerCase().includes(needle) ||
        flag.key.toLowerCase().includes(needle) ||
        flag.category.toLowerCase().includes(needle)
    );
  }, [flags, search]);

  const setGlobal = async (
    flag: FeatureFlag,
    enabled: boolean,
    percentage = flag.rollout_percentage,
    reason?: string
  ) => {
    setBusyKey(flag.key);
    setError('');
    try {
      const updated = await api.request<FeatureFlag>('platform-features', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'set_global',
          key: flag.key,
          enabled,
          rolloutPercentage: percentage,
          configuration: flag.configuration ?? {},
          reason: enabled ? undefined : reason,
        }),
      });
      setFlags((items) =>
        items.map((item) =>
          item.key === updated.key
            ? {
                ...item,
                ...updated,
                effective_enabled: updated.global_enabled,
                effective_rollout_percentage: updated.rollout_percentage,
              }
            : item
        )
      );
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update feature state.');
      throw value;
    } finally {
      setBusyKey(null);
    }
  };

  const requestToggle = async (flag: FeatureFlag) => {
    if (flag.global_enabled) {
      setEditing(flag);
      setRolloutPercentage(String(flag.rollout_percentage));
      setDisableReason('');
      return;
    }
    try {
      await setGlobal(flag, true);
    } catch {
      // Error already surfaced by setGlobal.
    }
  };

  const saveSettings = async () => {
    if (!editing) return;
    const percentage = Number(rolloutPercentage);
    if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
      setError('Rollout percentage must be an integer from 0 to 100.');
      return;
    }
    if (!disableReason.trim()) {
      setError('A governance reason is required before globally disabling a feature.');
      return;
    }
    try {
      await setGlobal(editing, false, percentage, disableReason.trim());
      setEditing(null);
      setDisableReason('');
    } catch {
      // Error already surfaced by setGlobal.
    }
  };

  return (
    <div>
      <Card
        title="Feature Availability"
        subtitle="Control which platform features are available globally. Church-specific availability can be adjusted separately where supported."
        headerAction={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search features..."
            />
            <Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>
              Refresh
            </Button>
          </div>
        }
      >
        {error ? (
          <div className="admin-form-error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        ) : null}

        <Table
          columns={[
            {
              header: 'FEATURE',
              accessor: (item) => (
                <div>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                    <code style={{ color: 'var(--gold)' }}>{item.key}</code> · {item.description}
                  </div>
                </div>
              ),
            },
            {
              header: 'CATEGORY',
              accessor: (item) => <Badge label={item.category.toUpperCase()} variant="neutral" />,
            },
            {
              header: 'AVAILABILITY',
              accessor: (item) => <strong>{item.rollout_percentage}%</strong>,
            },
            {
              header: 'STATE',
              accessor: (item) => (
                <Badge
                  label={item.global_enabled ? 'ENABLED' : 'DISABLED'}
                  variant={item.global_enabled ? 'active' : 'suspended'}
                  pulse={item.global_enabled}
                />
              ),
            },
            {
              header: 'CONTROL',
              accessor: (item) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Toggle
                    label=""
                    checked={item.global_enabled}
                    disabled={busyKey === item.key}
                    onChange={() => void requestToggle(item)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyKey === item.key}
                    onClick={() => {
                      setEditing(item);
                      setRolloutPercentage(String(item.rollout_percentage));
                      setDisableReason('');
                    }}
                  >
                    Policy
                  </Button>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(item) => item.key}
          loading={loading}
          emptyMessage="No features match your search."
        />
      </Card>

      <Modal
        isOpen={!!editing}
        onClose={() => {
          if (!busyKey) setEditing(null);
        }}
        title={editing ? `Feature policy · ${editing.name}` : 'Feature policy'}
        subtitle={editing?.key}
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" disabled={!!busyKey} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            {editing?.global_enabled ? (
              <Button variant="danger" loading={busyKey === editing.key} onClick={() => void saveSettings()}>
                Save & disable globally
              </Button>
            ) : (
              <Button
                variant="gold"
                loading={busyKey === editing?.key}
                onClick={() => {
                  if (!editing) return;
                  const percentage = Number(rolloutPercentage);
                  if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
                    setError('Rollout percentage must be an integer from 0 to 100.');
                    return;
                  }
                  void setGlobal(editing, true, percentage).then(() => setEditing(null)).catch(() => undefined);
                }}
              >
                Save & enable
              </Button>
            )}
          </div>
        }
      >
        <InputField
          label="Availability percentage"
          type="number"
          min={0}
          max={100}
          value={rolloutPercentage}
          onChange={(event) => setRolloutPercentage(event.target.value)}
          helperText="This is the default availability across the platform. Church-specific settings may further limit access."
        />
        {editing?.global_enabled ? (
          <InputField
            label="Reason for disabling"
            value={disableReason}
            onChange={(event) => setDisableReason(event.target.value)}
            placeholder="Operational incident, staged retirement, safety restriction..."
            helperText="This reason will be recorded in the audit log."
          />
        ) : null}
      </Modal>
    </div>
  );
}
