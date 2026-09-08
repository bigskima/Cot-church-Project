import React, { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SearchBar, SelectField, Table, Tabs } from '../components/ui';

type PostingMode = 'open' | 'closed' | 'allowlist';
type ModerationTab = 'posting' | 'reports' | 'content' | 'deletions';

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

interface ModeratedContent {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  author_profile_id?: string | null;
  content_type: string;
  visibility: string;
  status: string;
  published_at?: string | null;
  created_at: string;
  displayTitle: string;
  preview: string;
  openReportCount: number;
  author?: { id: string; displayName?: string | null; username?: string | null; avatarUrl?: string | null } | null;
  expression?: { id: string; name: string; code: string; isActive: boolean; deletedAt?: string | null } | null;
}

interface ModerationReport {
  id: string;
  organization_id: string;
  expression_id?: string | null;
  content_item_id?: string | null;
  comment_id?: string | null;
  reporter_profile_id: string;
  reason: string;
  details: string;
  status: string;
  action_taken?: string | null;
  reviewed_by?: string | null;
  created_at: string;
  updated_at: string;
  content?: ModeratedContent | null;
  comment?: {
    id: string;
    content_item_id: string;
    author_profile_id: string;
    parent_comment_id?: string | null;
    body: string;
    is_hidden: boolean;
    created_at: string;
  } | null;
  reporter?: { id: string; display_name?: string | null; username?: string | null } | null;
  reviewer?: { id: string; display_name?: string | null; username?: string | null } | null;
}

interface DeletionItem {
  id: string;
  target_type: 'content' | 'comment' | 'expression';
  target_id: string;
  organization_id?: string | null;
  expression_id?: string | null;
  actor_profile_id?: string | null;
  reason: string;
  storage_cleanup_status: 'not_required' | 'pending' | 'partial' | 'complete' | 'failed';
  created_at: string;
  completed_at?: string | null;
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

function contentScope(item: ModeratedContent) {
  return item.expression ? item.expression.name : 'General COT';
}

function contentAuthor(item: ModeratedContent) {
  return item.author?.displayName || (item.author?.username ? '@' + item.author.username : null) || 'Unknown author';
}

function reportTarget(report: ModerationReport) {
  if (report.comment) return 'Comment · ' + report.comment.body.slice(0, 80);
  if (report.content) return report.content.displayTitle;
  return 'Target no longer available';
}

function cleanupVariant(status: DeletionItem['storage_cleanup_status']) {
  if (status === 'complete' || status === 'not_required') return 'active' as const;
  if (status === 'partial' || status === 'pending') return 'warning' as const;
  return 'suspended' as const;
}

export function ModerationCenter({ api, canManage = false }: { api: ApiClient; canManage?: boolean }) {
  const [activeTab, setActiveTab] = useState<ModerationTab>('posting');
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

  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportStatus, setReportStatus] = useState('open');
  const [reportBusyId, setReportBusyId] = useState('');

  const [contentItems, setContentItems] = useState<ModeratedContent[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSearch, setContentSearch] = useState('');
  const [contentScopeFilter, setContentScopeFilter] = useState('all');
  const [contentTypeFilter, setContentTypeFilter] = useState('all');

  const [deletions, setDeletions] = useState<DeletionItem[]>([]);
  const [deletionsLoading, setDeletionsLoading] = useState(false);
  const [retryBusyId, setRetryBusyId] = useState('');

  const [deleteContent, setDeleteContent] = useState<ModeratedContent | null>(null);
  const [deleteReport, setDeleteReport] = useState<ModerationReport | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const applyState = (next: ModerationState) => {
    setState(next);
    setDraftMode(next.policy.mode);
    setDraftReason(next.policy.reason ?? '');
  };

  const loadState = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.request<ModerationState>('platform-moderation?view=posting');
      applyState(data);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load moderation controls.');
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    setReportsLoading(true);
    setError('');
    try {
      const data = await api.request<{ items: ModerationReport[]; total: number }>(
        'platform-moderation?view=reports&status=' + encodeURIComponent(reportStatus) + '&pageSize=100',
      );
      setReports(data.items ?? []);
      setReportTotal(data.total ?? 0);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load moderation reports.');
    } finally {
      setReportsLoading(false);
    }
  };

  const loadContent = async () => {
    setContentLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        view: 'content',
        scope: contentScopeFilter,
        type: contentTypeFilter,
        pageSize: '150',
      });
      if (contentSearch.trim()) params.set('q', contentSearch.trim());
      const data = await api.request<{ items: ModeratedContent[]; total: number }>('platform-moderation?' + params.toString());
      setContentItems(data.items ?? []);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load platform content.');
    } finally {
      setContentLoading(false);
    }
  };

  const loadDeletions = async () => {
    setDeletionsLoading(true);
    setError('');
    try {
      const data = await api.request<{ items: DeletionItem[] }>('platform-moderation?view=deletions');
      setDeletions(data.items ?? []);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load deletion history.');
    } finally {
      setDeletionsLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
  }, [api]);

  useEffect(() => {
    if (activeTab === 'reports') void loadReports();
    if (activeTab === 'deletions') void loadDeletions();
  }, [activeTab, reportStatus, api]);

  useEffect(() => {
    if (activeTab !== 'content') return;
    const timer = window.setTimeout(() => void loadContent(), 250);
    return () => window.clearTimeout(timer);
  }, [activeTab, api, contentSearch, contentScopeFilter, contentTypeFilter]);

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

  const resolveReport = async (report: ModerationReport, decision: 'review' | 'dismiss' | 'hide_target') => {
    if (!canManage) return;
    setReportBusyId(report.id);
    setError('');
    setNotice('');
    try {
      await api.request('platform-moderation', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'resolve_report',
          reportId: report.id,
          decision,
          note: decision === 'dismiss' ? 'Reviewed by Platform Moderation' : undefined,
        }),
      });
      setNotice(
        decision === 'review' ? 'Report moved into review.' :
        decision === 'dismiss' ? 'Report dismissed.' :
        'Reported target hidden.',
      );
      await loadReports();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update this moderation report.');
    } finally {
      setReportBusyId('');
    }
  };

  const removeTarget = async () => {
    if (!canManage || deleteReason.trim().length < 3) {
      setError('Add a reason before deleting content.');
      return;
    }

    const targetContent = deleteContent ?? deleteReport?.content ?? null;
    const targetComment = deleteReport?.comment ?? null;
    if (!targetContent && !targetComment) return;

    setDeleteBusy(true);
    setError('');
    setNotice('');
    try {
      if (targetComment) {
        await api.request('platform-moderation', {
          method: 'DELETE',
          body: JSON.stringify({
            action: 'remove_comment',
            commentId: targetComment.id,
            reason: deleteReason.trim(),
          }),
        });
        setNotice('Comment and its replies were removed. The moderation evidence was retained.');
      } else if (targetContent) {
        const data = await api.request<{ cleanup?: { status?: string } }>('platform-moderation', {
          method: 'DELETE',
          body: JSON.stringify({
            action: 'remove_content',
            contentId: targetContent.id,
            reason: deleteReason.trim(),
          }),
        });
        setNotice(
          data.cleanup?.status === 'failed' || data.cleanup?.status === 'partial'
            ? 'Content was removed. Some media cleanup remains queued for retry.'
            : 'Content and attached platform media were removed.',
        );
      }

      setDeleteContent(null);
      setDeleteReport(null);
      setDeleteReason('');
      if (activeTab === 'reports') await loadReports();
      if (activeTab === 'content') await loadContent();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to remove this target.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const retryCleanup = async (item: DeletionItem) => {
    if (!canManage) return;
    setRetryBusyId(item.id);
    setError('');
    setNotice('');
    try {
      const data = await api.request<{ cleanup?: { status?: string } }>('platform-moderation', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'retry_storage_cleanup', deletionId: item.id }),
      });
      setNotice(data.cleanup?.status === 'complete' ? 'Storage cleanup completed.' : 'Storage cleanup retried; unresolved files remain visible below.');
      await loadDeletions();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to retry Storage cleanup.');
    } finally {
      setRetryBusyId('');
    }
  };

  const activeMode = modeOptions.find((item) => item.mode === currentMode) ?? modeOptions[0];
  const unresolvedReports = reports.filter((item) => item.status === 'pending' || item.status === 'under_review').length;

  return (
    <div className="admin-page-stack">
      {error ? <div className="admin-form-error" role="alert">{error}</div> : null}
      {notice ? (
        <div className="admin-card" style={{ padding: 14, borderColor: 'var(--admin-success, #2db783)' }}>
          <strong>{notice}</strong>
        </div>
      ) : null}

      <Card>
        <Tabs
          ariaLabel="Moderation workspace"
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as ModerationTab)}
          tabs={[
            { key: 'posting', label: 'Public Posting' },
            { key: 'reports', label: 'Reports', count: activeTab === 'reports' ? unresolvedReports : undefined },
            { key: 'content', label: 'Content' },
            { key: 'deletions', label: 'Deletion History' },
          ]}
        />
      </Card>

      {activeTab === 'posting' ? (
        <>
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
                  { header: 'NOTE', accessor: (item) => item.reason?.trim() || '—' },
                  { header: 'ADDED', accessor: (item) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '—' },
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
        </>
      ) : null}

      {activeTab === 'reports' ? (
        <Card
          title="Content reports"
          subtitle={reportTotal + ' report' + (reportTotal === 1 ? '' : 's') + ' in this view. Platform moderation can review, hide, dismiss or permanently remove a target.'}
          headerAction={
            <SelectField
              aria-label="Report status"
              value={reportStatus}
              onChange={(event) => setReportStatus(event.target.value)}
              options={[
                { label: 'Open reports', value: 'open' },
                { label: 'Pending', value: 'pending' },
                { label: 'Under review', value: 'under_review' },
                { label: 'Actioned', value: 'actioned' },
                { label: 'Dismissed', value: 'dismissed' },
                { label: 'All reports', value: 'all' },
              ]}
            />
          }
        >
          <Table
            columns={[
              {
                header: 'REPORT',
                accessor: (item) => (
                  <div>
                    <div className="admin-row-title">{item.reason}</div>
                    <div className="admin-row-meta">{item.details || 'No extra details'} · {new Date(item.created_at).toLocaleString()}</div>
                  </div>
                ),
              },
              {
                header: 'TARGET',
                accessor: (item) => (
                  <div>
                    <div className="admin-row-title">{reportTarget(item)}</div>
                    <div className="admin-row-meta">{item.content ? contentScope(item.content) : item.comment ? 'Comment thread' : 'Unavailable'}</div>
                  </div>
                ),
              },
              {
                header: 'STATUS',
                accessor: (item) => <Badge label={item.status.replace('_', ' ').toUpperCase()} variant={item.status === 'dismissed' ? 'neutral' : item.status === 'actioned' ? 'active' : 'warning'} />,
              },
              {
                header: 'ACTIONS',
                accessor: (item) => canManage && (item.status === 'pending' || item.status === 'under_review') ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {item.status === 'pending' ? (
                      <Button size="sm" variant="outline" loading={reportBusyId === item.id} onClick={() => void resolveReport(item, 'review')}>Review</Button>
                    ) : null}
                    <Button size="sm" variant="outline" loading={reportBusyId === item.id} onClick={() => void resolveReport(item, 'hide_target')}>Hide</Button>
                    <Button size="sm" variant="outline" loading={reportBusyId === item.id} onClick={() => void resolveReport(item, 'dismiss')}>Dismiss</Button>
                    {(item.content || item.comment) ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setDeleteReport(item);
                          setDeleteContent(null);
                          setDeleteReason('');
                        }}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                ) : item.action_taken || '—',
              },
            ]}
            data={reports}
            keyExtractor={(item) => item.id}
            loading={reportsLoading}
            emptyMessage="No moderation reports match this view."
          />
        </Card>
      ) : null}

      {activeTab === 'content' ? (
        <Card
          title="Platform content"
          subtitle="Browse recent General and Expression posts, Reels, Watch videos and sermons. Deletion removes the canonical content and queues attached platform media for Storage cleanup."
          headerAction={<Button size="sm" variant="outline" onClick={() => void loadContent()} loading={contentLoading}>Refresh</Button>}
        >
          <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
            <SearchBar value={contentSearch} onChange={setContentSearch} placeholder="Search recent content, author or Expression..." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <SelectField
                label="Space"
                value={contentScopeFilter}
                onChange={(event) => setContentScopeFilter(event.target.value)}
                options={[
                  { label: 'General + Expressions', value: 'all' },
                  { label: 'General COT only', value: 'general' },
                  { label: 'Expressions only', value: 'expression' },
                ]}
              />
              <SelectField
                label="Content type"
                value={contentTypeFilter}
                onChange={(event) => setContentTypeFilter(event.target.value)}
                options={[
                  { label: 'All supported content', value: 'all' },
                  { label: 'Posts', value: 'post' },
                  { label: 'Reels', value: 'reel' },
                  { label: 'Videos', value: 'video' },
                  { label: 'Sermons', value: 'sermon' },
                ]}
              />
            </div>
          </div>

          <Table
            columns={[
              {
                header: 'CONTENT',
                accessor: (item) => (
                  <div>
                    <div className="admin-row-title">{item.displayTitle}</div>
                    <div className="admin-row-meta">{item.preview || 'No text preview'} </div>
                  </div>
                ),
              },
              {
                header: 'SPACE',
                accessor: (item) => (
                  <div>
                    <div className="admin-row-title">{contentScope(item)}</div>
                    <div className="admin-row-meta">{item.expression ? 'Expression' : 'General COT'} · {item.content_type}</div>
                  </div>
                ),
              },
              {
                header: 'AUTHOR',
                accessor: (item) => contentAuthor(item),
              },
              {
                header: 'REPORTS',
                accessor: (item) => item.openReportCount ? <Badge label={String(item.openReportCount)} variant="warning" /> : '0',
              },
              {
                header: 'STATUS',
                accessor: (item) => <Badge label={item.status.toUpperCase()} variant={item.status === 'published' ? 'active' : 'neutral'} />,
              },
              {
                header: '',
                accessor: (item) => canManage ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setDeleteContent(item);
                      setDeleteReport(null);
                      setDeleteReason('');
                    }}
                  >
                    Delete
                  </Button>
                ) : null,
              },
            ]}
            data={contentItems}
            keyExtractor={(item) => item.id}
            loading={contentLoading}
            emptyMessage="No supported content matches these filters."
          />
        </Card>
      ) : null}

      {activeTab === 'deletions' ? (
        <Card
          title="Deletion history"
          subtitle="Protected evidence of content, comment and Expression deletions. Storage cleanup can be retried without restoring deleted content."
          headerAction={<Button size="sm" variant="outline" onClick={() => void loadDeletions()} loading={deletionsLoading}>Refresh</Button>}
        >
          <Table
            columns={[
              {
                header: 'TARGET',
                accessor: (item) => (
                  <div>
                    <div className="admin-row-title">{item.target_type.toUpperCase()}</div>
                    <div className="admin-row-meta">{item.target_id}</div>
                  </div>
                ),
              },
              { header: 'REASON', accessor: (item) => item.reason },
              {
                header: 'MEDIA CLEANUP',
                accessor: (item) => <Badge label={item.storage_cleanup_status.replace('_', ' ').toUpperCase()} variant={cleanupVariant(item.storage_cleanup_status)} />,
              },
              { header: 'CREATED', accessor: (item) => new Date(item.created_at).toLocaleString() },
              {
                header: '',
                accessor: (item) => canManage && ['pending', 'partial', 'failed'].includes(item.storage_cleanup_status) ? (
                  <Button size="sm" variant="outline" loading={retryBusyId === item.id} onClick={() => void retryCleanup(item)}>Retry cleanup</Button>
                ) : null,
              },
            ]}
            data={deletions}
            keyExtractor={(item) => item.id}
            loading={deletionsLoading}
            emptyMessage="No destructive moderation actions have been recorded."
          />
        </Card>
      ) : null}

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

      <Modal
        isOpen={!!deleteContent || !!deleteReport}
        onClose={() => {
          if (!deleteBusy) {
            setDeleteContent(null);
            setDeleteReport(null);
            setDeleteReason('');
          }
        }}
        title={deleteReport?.comment ? 'Delete comment' : 'Delete content'}
        subtitle={deleteReport ? reportTarget(deleteReport) : deleteContent?.displayTitle}
        footer={
          <>
            <Button variant="outline" size="md" disabled={deleteBusy} onClick={() => {
              setDeleteContent(null);
              setDeleteReport(null);
              setDeleteReason('');
            }}>Cancel</Button>
            <Button variant="danger" size="md" loading={deleteBusy} disabled={deleteReason.trim().length < 3} onClick={() => void removeTarget()}>
              Permanently remove
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="admin-card" style={{ padding: 14 }}>
            <strong>This removes the canonical target</strong>
            <p className="admin-muted" style={{ marginTop: 6, lineHeight: 1.55 }}>
              Reports and audit evidence are retained. Attached media owned exclusively by this content is queued for deletion through Supabase Storage.
            </p>
          </div>
          <InputField
            label="Deletion reason"
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value)}
            placeholder="Why must this target be permanently removed?"
            helperText="This reason becomes part of the protected moderation history."
          />
        </div>
      </Modal>
    </div>
  );
}
