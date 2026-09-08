import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SearchBar, Table } from '../components/ui';

type PostingMode = 'open' | 'closed' | 'allowlist';

interface PostingPolicy {
  mode: PostingMode;
  reason: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

interface PostingExemption {
  profileId: string;
  reason: string;
  grantedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
}

interface ModerationState {
  policy: PostingPolicy;
  exemptions: PostingExemption[];
}

interface UserAccount {
  id: string;
  email?: string | null;
  phone?: string | null;
  display_name?: string | null;
  username?: string | null;
  account_status: 'active' | 'banned';
  posting_allowed?: boolean;
}

interface UserListResponse {
  items: UserAccount[];
  page: number;
  pageSize: number;
  total: number;
}

const modeOptions: Array<{
  mode: PostingMode;
  title: string;
  description: string;
  badge: string;
  variant: 'active' | 'warning' | 'suspended';
}> = [
  {
    mode: 'open',
    title: 'Open',
    description: 'Every signed-in account may publish in General COT unless that account is individually restricted.',
    badge: 'EVERYONE',
    variant: 'active',
  },
  {
    mode: 'closed',
    title: 'Paused',
    description: 'Public posting is stopped for every account. Private Expression posting is not affected.',
    badge: 'NO PUBLIC POSTS',
    variant: 'suspended',
  },
  {
    mode: 'allowlist',
    title: 'Approved accounts only',
    description: 'Only accounts listed below may publish in General COT. Individual restrictions still override approval.',
    badge: 'APPROVED LIST',
    variant: 'warning',
  },
];

function accountLabel(account: UserAccount) {
  return account.display_name?.trim() || account.email || account.phone || account.username || 'COT account';
}

function exemptionLabel(item: PostingExemption) {
  return item.displayName?.trim() || item.username || item.phoneNumber || 'COT account';
}

export function ModerationCenter({ api, canManage = false }: { api: ApiClient; canManage?: boolean }) {
  const [state, setState] = useState<ModerationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draftMode, setDraftMode] = useState<PostingMode>('open');
  const [draftReason, setDraftReason] = useState('');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserAccount[]>([]);
  const [approvalTarget, setApprovalTarget] = useState<UserAccount | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [removingProfileId, setRemovingProfileId] = useState('');

  const applyState = (next: ModerationState) => {
    setState(next);
    setDraftMode(next.policy.mode);
    setDraftReason(next.policy.reason ?? '');
  };

  const loadState = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.request<ModerationState>('platform-moderation');
      applyState(data);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load moderation controls.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
  }, [api]);

  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.request<UserListResponse>(
          'platform-users?q=' + encodeURIComponent(search.trim()) + '&pageSize=12',
        );
        setSearchResults(data.items ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [api, search]);

  const currentMode = state?.policy.mode ?? 'open';
  const modeChanged = draftMode !== currentMode || draftReason.trim() !== (state?.policy.reason ?? '').trim();
  const exemptionIds = useMemo(() => new Set((state?.exemptions ?? []).map((item) => item.profileId)), [state?.exemptions]);

  const savePolicy = async () => {
    if (!canManage || !modeChanged) return;
    if (draftMode !== 'open' && draftReason.trim().length < 3) {
      setError('Add a short reason before restricting public posting.');
      return;
    }

    setSavingPolicy(true);
    setError('');
    setNotice('');
    try {
      const next = await api.request<ModerationState>('platform-moderation', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'set_public_posting_policy',
          mode: draftMode,
          reason: draftReason.trim(),
        }),
      });
      applyState(next);
      setNotice(
        draftMode === 'open'
          ? 'Public posting is open to signed-in accounts.'
          : draftMode === 'closed'
            ? 'Public posting is paused for all accounts.'
            : 'Public posting is limited to approved accounts.',
      );
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update public posting policy.');
    } finally {
      setSavingPolicy(false);
    }
  };

  const approveAccount = async () => {
    if (!canManage || !approvalTarget) return;
    setApprovalBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await api.request<ModerationState>('platform-moderation', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'add_public_posting_exemption',
          profileId: approvalTarget.id,
          reason: approvalReason.trim(),
        }),
      });
      applyState(next);
      setNotice(accountLabel(approvalTarget) + ' is approved for public posting when approved-only mode is active.');
      setApprovalTarget(null);
      setApprovalReason('');
      setSearch('');
      setSearchResults([]);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to approve this account.');
    } finally {
      setApprovalBusy(false);
    }
  };

  const removeApproval = async (profileId: string) => {
    if (!canManage) return;
    setRemovingProfileId(profileId);
    setError('');
    setNotice('');
    try {
      const next = await api.request<ModerationState>('platform-moderation', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'remove_public_posting_exemption',
          profileId,
        }),
      });
      applyState(next);
      setNotice('Public posting approval removed.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to remove this approval.');
    } finally {
      setRemovingProfileId('');
    }
  };

  const activeMode = modeOptions.find((item) => item.mode === currentMode) ?? modeOptions[0];

  return (
    <div className="admin-page-stack">
      {error ? <div className="admin-form-error" role="alert">{error}</div> : null}
      {notice ? (
        <div className="admin-card" style={{ padding: 14, borderColor: 'var(--admin-success, #2db783)' }}>
          <strong>{notice}</strong>
        </div>
      ) : null}

      <Card
        title="Public posting"
        subtitle="Control who can publish posts, photos, videos, Reels and voice content in General COT."
        headerAction={<Badge label={activeMode.badge} variant={activeMode.variant} />}
      >
        {loading && !state ? (
          <div className="admin-table-loading"><span className="admin-spinner" /><p>Loading posting controls...</p></div>
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {modeOptions.map((item) => {
                const selected = draftMode === item.mode;
                return (
                  <button
                    key={item.mode}
                    type="button"
                    disabled={!canManage}
                    onClick={() => setDraftMode(item.mode)}
                    className="admin-card"
                    style={{
                      padding: 18,
                      textAlign: 'left',
                      cursor: canManage ? 'pointer' : 'default',
                      borderColor: selected ? 'var(--admin-accent, #4f8cff)' : undefined,
                      boxShadow: selected ? '0 0 0 1px var(--admin-accent, #4f8cff)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <strong>{item.title}</strong>
                      <Badge label={item.badge} variant={item.variant} />
                    </div>
                    <p className="admin-muted" style={{ marginTop: 8, lineHeight: 1.55 }}>{item.description}</p>
                  </button>
                );
              })}
            </div>

            <InputField
              label={draftMode === 'open' ? 'Policy note' : 'Reason for restriction'}
              value={draftReason}
              onChange={(event) => setDraftReason(event.target.value)}
              placeholder={draftMode === 'open' ? 'Optional note for administrators' : 'Why is public posting being restricted?'}
              disabled={!canManage}
              helperText="Policy changes are recorded in Audit & Security."
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {modeChanged ? (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setDraftMode(state?.policy.mode ?? 'open');
                    setDraftReason(state?.policy.reason ?? '');
                    setError('');
                  }}
                  disabled={savingPolicy}
                >
                  Reset
                </Button>
              ) : null}
              <Button
                variant={draftMode === 'closed' ? 'danger' : 'primary'}
                size="md"
                onClick={() => void savePolicy()}
                loading={savingPolicy}
                disabled={!canManage || !modeChanged}
              >
                Apply posting policy
              </Button>
            </div>

            <div className="admin-card" style={{ padding: 14, background: 'var(--admin-surface-muted, transparent)' }}>
              <strong>How this combines with account restrictions</strong>
              <p className="admin-muted" style={{ marginTop: 6, lineHeight: 1.55 }}>
                An individual posting restriction always blocks that account, even when the account is approved below.
                Private Expression posting is not controlled by this global public-posting switch.
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Approved public posters"
        subtitle={(state?.exemptions.length ?? 0) + ' approved account' + (state?.exemptions.length === 1 ? '' : 's') + ' · used only when “Approved accounts only” is active'}
        headerAction={
          canManage ? <Badge label={currentMode === 'allowlist' ? 'ACTIVE LIST' : 'SAVED LIST'} variant={currentMode === 'allowlist' ? 'warning' : 'neutral'} /> : null
        }
      >
        <div style={{ display: 'grid', gap: 16 }}>
          {canManage ? (
            <div>
              <SearchBar value={search} onChange={setSearch} placeholder="Find an account to approve..." />
              {search.trim().length >= 2 ? (
                <div style={{ marginTop: 10 }}>
                  <Table
                    columns={[
                      {
                        header: 'ACCOUNT',
                        accessor: (item) => (
                          <div>
                            <div className="admin-row-title">{accountLabel(item)}</div>
                            <div className="admin-row-meta">{item.email ?? item.phone ?? item.username ?? ('ID ' + item.id.slice(0, 8))}</div>
                          </div>
                        ),
                      },
                      {
                        header: 'ACCOUNT STATUS',
                        accessor: (item) => <Badge label={item.account_status === 'banned' ? 'BANNED' : 'ACTIVE'} variant={item.account_status === 'banned' ? 'suspended' : 'active'} />,
                      },
                      {
                        header: 'INDIVIDUAL POSTING',
                        accessor: (item) => <Badge label={item.posting_allowed === false ? 'RESTRICTED' : 'ALLOWED'} variant={item.posting_allowed === false ? 'suspended' : 'active'} />,
                      },
                      {
                        header: '',
                        accessor: (item) => exemptionIds.has(item.id)
                          ? <Badge label="APPROVED" variant="active" />
                          : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setApprovalTarget(item);
                                setApprovalReason('');
                              }}
                            >
                              Approve
                            </Button>
                          ),
                      },
                    ]}
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    loading={searching}
                    emptyMessage="No matching accounts."
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <Table
            columns={[
              {
                header: 'APPROVED ACCOUNT',
                accessor: (item) => (
                  <div>
                    <div className="admin-row-title">{exemptionLabel(item)}</div>
                    <div className="admin-row-meta">
                      {item.username ? ('@' + item.username) : item.phoneNumber ?? ('ID ' + item.profileId.slice(0, 8))}
                    </div>
                  </div>
                ),
              },
              {
                header: 'NOTE',
                accessor: (item) => item.reason?.trim() || '—',
              },
              {
                header: 'ADDED',
                accessor: (item) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '—',
              },
              {
                header: '',
                accessor: (item) => canManage ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void removeApproval(item.profileId)}
                    loading={removingProfileId === item.profileId}
                  >
                    Remove
                  </Button>
                ) : null,
              },
            ]}
            data={state?.exemptions ?? []}
            keyExtractor={(item) => item.profileId}
            loading={loading && !state}
            emptyMessage="No accounts have been approved for the public posting exception list."
          />
        </div>
      </Card>

      <Modal
        isOpen={!!approvalTarget}
        onClose={() => {
          if (!approvalBusy) {
            setApprovalTarget(null);
            setApprovalReason('');
          }
        }}
        title="Approve public posting"
        subtitle={approvalTarget ? ('Allow ' + accountLabel(approvalTarget) + ' to post when approved-only mode is active.') : undefined}
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setApprovalTarget(null)} disabled={approvalBusy}>Cancel</Button>
            <Button variant="primary" size="md" onClick={() => void approveAccount()} loading={approvalBusy}>Approve account</Button>
          </>
        }
      >
        <InputField
          label="Administrative note"
          value={approvalReason}
          onChange={(event) => setApprovalReason(event.target.value)}
          placeholder="Optional reason for this approval"
          helperText="The approval and this note are recorded in the platform audit trail."
        />
      </Modal>
    </div>
  );
}
