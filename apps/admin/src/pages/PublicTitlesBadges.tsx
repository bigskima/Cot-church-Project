import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SelectField, Toggle } from '../components/ui';

type Organization = { id: string; name: string; slug?: string; status: string };
type Definition = {
  id: string;
  label: string;
  code: string;
  background_color: string;
  text_color: string;
  priority: number;
  is_membership_default: boolean;
  is_active: boolean;
  badge_variant: string;
  notify_priority_posts: boolean;
};
type Assignment = {
  id: string;
  profile_id: string;
  badge_definition_id: string;
  is_active: boolean;
};
type Member = { id: string; display_name?: string | null; username?: string | null; avatar_url?: string | null };
type Payload = { organizations: Organization[]; definitions: Definition[]; assignments: Assignment[]; members: Member[] };

const variants = [
  { value: 'silver', label: 'Silver / platinum' },
  { value: 'gold', label: 'Gold premium' },
  { value: 'blue', label: 'Blue' },
  { value: 'teal', label: 'Teal' },
  { value: 'default', label: 'Default neutral' },
  { value: 'custom', label: 'Custom color' },
];

export function PublicTitlesBadges({ api }: { api: ApiClient }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [editor, setEditor] = useState<Definition | null | 'new'>(null);
  const [label, setLabel] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#475569');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [priority, setPriority] = useState('50');
  const [badgeVariant, setBadgeVariant] = useState('default');
  const [notifyPriorityPosts, setNotifyPriorityPosts] = useState(false);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async (orgId?: string) => {
    setLoading(true);
    setError('');
    try {
      const suffix = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : '';
      const data = await api.request<Payload>(`platform-identity-badges${suffix}`);
      setOrganizations(data.organizations ?? []);
      setDefinitions(data.definitions ?? []);
      setAssignments(data.assignments ?? []);
      setMembers(data.members ?? []);
      const resolved = orgId || organizationId || data.organizations?.[0]?.id || '';
      if (resolved && resolved !== organizationId) setOrganizationId(resolved);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load public titles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [api]);
  useEffect(() => {
    if (!organizationId) return;
    setSelectedMemberId('');
    setSelectedDefinitionId('');
    void load(organizationId);
  }, [organizationId]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members.slice(0, 100);
    return members.filter((member) =>
      (member.display_name ?? '').toLowerCase().includes(q)
      || (member.username ?? '').toLowerCase().includes(q),
    ).slice(0, 100);
  }, [memberQuery, members]);

  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const assignedForMember = selectedMemberId
    ? assignments.filter((assignment) => assignment.profile_id === selectedMemberId)
    : [];

  const openCreate = () => {
    setEditor('new');
    setLabel('');
    setBackgroundColor('#475569');
    setTextColor('#FFFFFF');
    setPriority('50');
    setBadgeVariant('default');
    setNotifyPriorityPosts(false);
    setActive(true);
    setError('');
  };

  const openEdit = (definition: Definition) => {
    if (definition.is_membership_default) return;
    setEditor(definition);
    setLabel(definition.label);
    setBackgroundColor(definition.background_color);
    setTextColor(definition.text_color);
    setPriority(String(definition.priority));
    setBadgeVariant(definition.badge_variant || 'default');
    setNotifyPriorityPosts(definition.notify_priority_posts);
    setActive(definition.is_active);
    setError('');
  };

  const saveDefinition = async () => {
    if (!organizationId || !label.trim()) return;
    setSaving(true);
    setError('');
    try {
      const editing = editor !== 'new' && editor !== null;
      await api.request('platform-identity-badges', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          action: editing ? 'update_definition' : 'create_definition',
          organizationId,
          ...(editing ? { definitionId: editor.id } : {}),
          label: label.trim(),
          backgroundColor,
          textColor,
          priority: Number(priority) || 0,
          badgeVariant,
          notifyPriorityPosts,
          ...(editing ? { isActive: active } : {}),
        }),
      });
      setEditor(null);
      setMessage(editing ? 'Public title updated.' : 'Public title created.');
      await load(organizationId);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save this public title.');
    } finally {
      setSaving(false);
    }
  };

  const setAssignment = async (definitionId: string, assign: boolean) => {
    if (!organizationId || !selectedMemberId) return;
    setSaving(true);
    setError('');
    try {
      await api.request('platform-identity-badges', {
        method: assign ? 'POST' : 'DELETE',
        body: JSON.stringify({
          action: assign ? 'assign' : 'revoke',
          organizationId,
          profileId: selectedMemberId,
          definitionId,
        }),
      });
      setMessage(assign ? 'Public title assigned.' : 'Public title removed.');
      await load(organizationId);
      setSelectedMemberId(selectedMemberId);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update this title assignment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page-stack">
      {error && editor === null ? <div className="admin-inline-error" role="alert">{error}</div> : null}
      {message ? <div className="admin-status-message admin-status-success">{message}</div> : null}

      <Card
        title="Public Titles & Badges"
        subtitle="Presentation-only ministry titles. These badges never grant permissions or administrative access."
        headerAction={<Button variant="gold" size="sm" onClick={openCreate}>Create title</Button>}
      >
        <div className="admin-form-grid-two">
          <SelectField
            label="Church"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            options={[{ value: '', label: 'Choose church' }, ...organizations.map((item) => ({ value: item.id, label: item.name }))]}
          />
          <div className="admin-filter-summary">
            <span className="admin-filter-summary-label">IDENTITY LAYER</span>
            <strong>{definitions.filter((item) => item.is_active && !item.is_membership_default).length} active title(s)</strong>
            <span>Security roles remain managed separately in Roles & Access.</span>
          </div>
        </div>
      </Card>

      <Card title="Badge definitions" subtitle="The highest-priority active badge is used as the compact mark beside a member’s name.">
        {loading ? <div className="admin-table-loading"><span className="admin-spinner" /><p>Loading titles…</p></div> : definitions.length ? (
          <div className="admin-leader-grid">
            {definitions.filter((item) => !item.is_membership_default).map((definition) => (
              <div key={definition.id} className={`admin-leader-card ${definition.is_active ? '' : 'archived'}`}>
                <div className="admin-leader-photo" style={{ background: definition.background_color, color: definition.text_color, display: 'grid', placeItems: 'center', fontWeight: 900 }}>✦</div>
                <div className="admin-leader-copy">
                  <div className="admin-record-title-row">
                    <strong>{definition.label}</strong>
                    <Badge label={definition.badge_variant.toUpperCase()} variant={definition.badge_variant === 'gold' ? 'gold' : 'neutral'} />
                  </div>
                  <p>Priority {definition.priority}{definition.notify_priority_posts ? ' · priority-post alerts enabled' : ''}</p>
                  <div className="admin-record-title-row">
                    <Badge label={definition.is_active ? 'ACTIVE' : 'INACTIVE'} variant={definition.is_active ? 'active' : 'neutral'} />
                    <span className="admin-row-meta">{definition.background_color} / {definition.text_color}</span>
                  </div>
                </div>
                <div className="admin-table-actions"><Button variant="outline" size="sm" onClick={() => openEdit(definition)}>Edit</Button></div>
              </div>
            ))}
          </div>
        ) : <div className="admin-table-empty"><p>No public titles configured yet.</p></div>}
      </Card>

      <Card title="Assign a title" subtitle="Choose an active church member, then add or remove presentation badges without changing that person’s permissions.">
        <div className="admin-form-grid-two">
          <InputField label="Find member" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Name or @username" />
          <SelectField
            label="Member"
            value={selectedMemberId}
            onChange={(event) => setSelectedMemberId(event.target.value)}
            options={[
              { value: '', label: 'Choose member' },
              ...filteredMembers.map((member) => ({ value: member.id, label: `${member.display_name || member.username || 'Member'}${member.username ? ` · @${member.username}` : ''}` })),
            ]}
          />
        </div>

        {selectedMember ? (
          <div style={{ marginTop: 18 }}>
            <div className="admin-record-title-row">
              <strong>{selectedMember.display_name || selectedMember.username}</strong>
              {selectedMember.username ? <span className="admin-row-meta">@{selectedMember.username}</span> : null}
            </div>
            <div className="admin-capability-tags" style={{ marginTop: 12 }}>
              {definitions.filter((item) => item.is_active && !item.is_membership_default).map((definition) => {
                const assigned = assignedForMember.some((item) => item.badge_definition_id === definition.id);
                return (
                  <button
                    key={definition.id}
                    type="button"
                    className={assigned ? 'active' : ''}
                    disabled={saving}
                    onClick={() => void setAssignment(definition.id, !assigned)}
                    style={{ borderColor: definition.background_color }}
                  >
                    {assigned ? '✓ ' : '+ '}{definition.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </Card>

      <Modal
        isOpen={editor !== null}
        onClose={() => { if (!saving) setEditor(null); }}
        title={editor === 'new' ? 'Create public title' : 'Edit public title'}
        subtitle="Display identity only · no permissions"
        maxWidth="lg"
        footer={<><Button variant="outline" disabled={saving} onClick={() => setEditor(null)}>Cancel</Button><Button variant="gold" loading={saving} onClick={() => void saveDefinition()}>Save title</Button></>}
      >
        <div className="admin-modal-form">
          {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
          <InputField label="Title shown to users" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Lead Pastor, G.O, Choir Director…" />
          <div className="admin-form-grid-two">
            <SelectField label="Badge style" value={badgeVariant} onChange={(event) => setBadgeVariant(event.target.value)} options={variants} />
            <InputField label="Display priority" type="number" value={priority} onChange={(event) => setPriority(event.target.value)} helperText="Higher priority becomes the compact badge shown beside the name." />
          </div>
          <div className="admin-form-grid-two">
            <InputField label="Badge color" type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} />
            <InputField label="Icon/text color" type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} />
          </div>
          <Toggle label="Priority ministry post alerts" checked={notifyPriorityPosts} onChange={setNotifyPriorityPosts} description="When enabled, members who allow Priority ministry updates can be alerted when a person carrying this title publishes." />
          {editor !== 'new' ? <Toggle label="Active" checked={active} onChange={setActive} description="Inactive titles remain in history but are no longer presented or assignable." /> : null}
        </div>
      </Modal>
    </div>
  );
}
