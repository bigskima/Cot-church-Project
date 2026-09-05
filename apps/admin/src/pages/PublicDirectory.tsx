import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';
import { Badge, Button, Card, InputField, Modal, SelectField, Toggle } from '../components/ui';

type Organization = { id: string; name: string; slug?: string; status: string };
type Story = {
  id?: string;
  organization_id?: string;
  title: string;
  subtitle: string;
  mission: string;
  vision: string;
  founding_story: string;
  founding_year: number | null;
  history_milestones: unknown[];
  values: unknown[];
  banner_image_url: string | null;
  is_published: boolean;
};
type Leader = {
  id: string;
  display_name: string;
  portrait_url: string | null;
  role_title: string;
  short_bio: string;
  full_bio: string;
  ministry: string | null;
  display_order: number;
  tenure_start: string | null;
  tenure_end: string | null;
  is_founder: boolean;
  is_featured_public: boolean;
  is_active: boolean;
  social_links: Record<string, unknown>;
};
type Payload = { organizations: Organization[]; story: Story | null; leaders: Leader[] };

type LeaderDraft = {
  id?: string;
  displayName: string;
  portraitUrl: string;
  roleTitle: string;
  shortBio: string;
  fullBio: string;
  ministry: string;
  displayOrder: number;
  isFounder: boolean;
  isFeaturedPublic: boolean;
  isActive: boolean;
};

const blankStory: Story = {
  title: 'Our Story & Heritage',
  subtitle: '',
  mission: '',
  vision: '',
  founding_story: '',
  founding_year: null,
  history_milestones: [],
  values: [],
  banner_image_url: null,
  is_published: false,
};
const blankLeader: LeaderDraft = {
  displayName: '',
  portraitUrl: '',
  roleTitle: '',
  shortBio: '',
  fullBio: '',
  ministry: '',
  displayOrder: 0,
  isFounder: false,
  isFeaturedPublic: true,
  isActive: true,
};

export function PublicDirectory({ api }: { api: ApiClient }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [story, setStory] = useState<Story>(blankStory);
  const [storyDraft, setStoryDraft] = useState<Story>(blankStory);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [leaderDraft, setLeaderDraft] = useState<LeaderDraft>(blankLeader);
  const [storyOpen, setStoryOpen] = useState(false);
  const [leaderOpen, setLeaderOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Leader | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStory, setSavingStory] = useState(false);
  const [savingLeader, setSavingLeader] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedOrganization = useMemo(
    () => organizations.find((item) => item.id === organizationId) ?? null,
    [organizations, organizationId],
  );

  const loadDirectory = async (orgId?: string) => {
    setLoading(true);
    setError('');
    try {
      const suffix = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : '';
      const data = await api.request<Payload>(`platform-public-directory${suffix}`);
      setOrganizations(data.organizations ?? []);
      const resolvedOrgId = orgId || organizationId || data.organizations?.find((item) => item.status === 'active')?.id || data.organizations?.[0]?.id || '';
      if (resolvedOrgId && resolvedOrgId !== organizationId) setOrganizationId(resolvedOrgId);
      if (orgId || resolvedOrgId === organizationId) {
        setStory(data.story ?? blankStory);
        setLeaders(data.leaders ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load public directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDirectory();
  }, [api]);

  useEffect(() => {
    if (!organizationId) return;
    void loadDirectory(organizationId);
  }, [organizationId]);

  async function uploadImage(file: File) {
    if (!organizationId) throw new Error('Select a church first.');
    const intent = await api.request<{ mediaPath: string; signedUploadUrl: string }>('platform-public-directory', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create_upload',
        organizationId,
        mimeType: file.type,
        sizeBytes: file.size,
        fileName: file.name,
      }),
    });
    const response = await fetch(intent.signedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!response.ok) throw new Error(`Image upload failed (${response.status}).`);
    return api.request<{ publicUrl: string; mediaPath: string }>('platform-public-directory', {
      method: 'POST',
      body: JSON.stringify({ action: 'complete_upload', organizationId, mediaPath: intent.mediaPath }),
    });
  }

  async function handleStoryImage(file?: File) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const result = await uploadImage(file);
      setStoryDraft((current) => ({ ...current, banner_image_url: result.publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload story image.');
    } finally {
      setUploading(false);
    }
  }

  async function handleLeaderImage(file?: File) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const result = await uploadImage(file);
      setLeaderDraft((current) => ({ ...current, portraitUrl: result.publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload portrait.');
    } finally {
      setUploading(false);
    }
  }

  const openStory = () => {
    setStoryDraft(story);
    setError('');
    setMessage('');
    setStoryOpen(true);
  };

  async function saveStory() {
    if (!organizationId) return;
    if (!storyDraft.title.trim()) {
      setError('Public story title is required.');
      return;
    }
    setSavingStory(true);
    setError('');
    setMessage('');
    try {
      const saved = await api.request<Story>('platform-public-directory', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'upsert_story',
          organizationId,
          title: storyDraft.title.trim(),
          subtitle: storyDraft.subtitle.trim(),
          mission: storyDraft.mission.trim(),
          vision: storyDraft.vision.trim(),
          foundingStory: storyDraft.founding_story.trim(),
          foundingYear: storyDraft.founding_year,
          historyMilestones: storyDraft.history_milestones,
          values: storyDraft.values,
          bannerImageUrl: storyDraft.banner_image_url,
          isPublished: storyDraft.is_published,
        }),
      });
      setStory(saved);
      setStoryOpen(false);
      setMessage('General Community church story saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save church story.');
    } finally {
      setSavingStory(false);
    }
  }

  function openLeader(leader?: Leader) {
    setError('');
    setMessage('');
    if (leader) {
      setLeaderDraft({
        id: leader.id,
        displayName: leader.display_name,
        portraitUrl: leader.portrait_url ?? '',
        roleTitle: leader.role_title,
        shortBio: leader.short_bio ?? '',
        fullBio: leader.full_bio ?? '',
        ministry: leader.ministry ?? '',
        displayOrder: leader.display_order ?? 0,
        isFounder: leader.is_founder,
        isFeaturedPublic: leader.is_featured_public,
        isActive: leader.is_active,
      });
    } else {
      setLeaderDraft(blankLeader);
    }
    setLeaderOpen(true);
  }

  async function saveLeader() {
    if (!organizationId) return;
    if (!leaderDraft.displayName.trim() || !leaderDraft.roleTitle.trim()) {
      setError('Public name and role title are required.');
      return;
    }

    setSavingLeader(true);
    setError('');
    setMessage('');
    try {
      const saved = await api.request<Leader>('platform-public-directory', {
        method: 'PATCH',
        body: JSON.stringify({
          action: leaderDraft.id ? 'update_leader' : 'create_leader',
          organizationId,
          leaderId: leaderDraft.id,
          displayName: leaderDraft.displayName.trim(),
          portraitUrl: leaderDraft.portraitUrl || null,
          roleTitle: leaderDraft.roleTitle.trim(),
          shortBio: leaderDraft.shortBio.trim(),
          fullBio: leaderDraft.fullBio.trim(),
          ministry: leaderDraft.ministry.trim() || null,
          displayOrder: leaderDraft.displayOrder,
          isFounder: leaderDraft.isFounder,
          isFeaturedPublic: leaderDraft.isFeaturedPublic,
          isActive: leaderDraft.isActive,
          socialLinks: {},
        }),
      });
      setLeaders((current) =>
        leaderDraft.id
          ? current.map((item) => item.id === saved.id ? saved : item)
          : [...current, saved].sort((a, b) => a.display_order - b.display_order),
      );
      setLeaderOpen(false);
      setLeaderDraft(blankLeader);
      setMessage(leaderDraft.id ? 'Leader profile updated.' : 'Leader profile added to the General Community directory.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save leader profile.');
    } finally {
      setSavingLeader(false);
    }
  }

  async function archiveLeader() {
    if (!organizationId || !archiveTarget) return;
    setError('');
    try {
      await api.request('platform-public-directory', {
        method: 'DELETE',
        body: JSON.stringify({ action: 'archive_leader', organizationId, leaderId: archiveTarget.id }),
      });
      setLeaders((current) => current.map((item) => item.id === archiveTarget.id ? { ...item, is_active: false } : item));
      setArchiveTarget(null);
      setMessage('Leader profile archived from the active public directory.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive leader profile.');
    }
  }

  return (
    <div className="admin-page-stack">
      {error && !storyOpen && !leaderOpen && !archiveTarget ? <div className="admin-inline-error" role="alert">{error}</div> : null}
      {message ? <div className="admin-status-message admin-status-success">{message}</div> : null}

      <Card
        title="Community directory"
        subtitle="Manage information intentionally published to visitors and the General Community. Expression leadership remains managed inside each Expression."
        headerAction={<Button variant="outline" size="sm" loading={loading} onClick={() => void loadDirectory(organizationId)}>Refresh</Button>}
      >
        <div className="admin-filter-bar">
          <SelectField
            label="Church organization"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            options={organizations.map((organization) => ({
              value: organization.id,
              label: `${organization.name} · ${organization.status}`,
            }))}
          />
          <div className="admin-filter-summary">
            <span className="admin-filter-summary-label">PUBLIC SCOPE</span>
            <strong>{selectedOrganization?.name ?? 'No church selected'}</strong>
            <span>{leaders.filter((leader) => leader.is_active).length} active central leader profile(s)</span>
          </div>
        </div>
      </Card>

      {selectedOrganization ? (
        <>
          <Card
            title="Public church story"
            subtitle="Only publish information that the church has actually configured and approved."
            headerAction={<Button variant="gold" size="sm" onClick={openStory}>Edit story</Button>}
          >
            <div className="admin-directory-story">
              <div className="admin-directory-banner">
                {story.banner_image_url ? <img src={story.banner_image_url} alt="" /> : <span>STORY</span>}
              </div>
              <div className="admin-directory-story-copy">
                <div className="admin-record-title-row">
                  <strong>{story.title || 'No public story configured'}</strong>
                  <Badge label={story.is_published ? 'PUBLISHED' : 'DRAFT'} variant={story.is_published ? 'active' : 'neutral'} />
                </div>
                <p>{story.subtitle || story.mission || 'Add the church story, mission, vision and heritage when it is ready for public presentation.'}</p>
                <div className="admin-capability-tags">
                  {story.mission ? <span className="active">Mission</span> : null}
                  {story.vision ? <span className="active">Vision</span> : null}
                  {story.founding_story ? <span className="active">Heritage</span> : null}
                  {story.founding_year ? <span className="active">Founded {story.founding_year}</span> : null}
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Central public leadership"
            subtitle="These profiles are public directory presentation only. They do not grant roles or Expression permissions."
            headerAction={<Button variant="gold" size="sm" onClick={() => openLeader()}>Add leader</Button>}
          >
            {leaders.length ? (
              <div className="admin-leader-grid">
                {leaders.map((leader) => (
                  <div key={leader.id} className={`admin-leader-card ${leader.is_active ? '' : 'archived'}`}>
                    <div className="admin-leader-photo">
                      {leader.portrait_url ? <img src={leader.portrait_url} alt="" /> : <span>{leader.display_name?.[0]?.toUpperCase() ?? 'L'}</span>}
                    </div>
                    <div className="admin-leader-copy">
                      <div className="admin-record-title-row">
                        <strong>{leader.display_name}</strong>
                        {leader.is_founder ? <Badge label="FOUNDER" variant="gold" /> : null}
                      </div>
                      <span>{leader.role_title}</span>
                      <p>{leader.short_bio || leader.ministry || 'No public bio configured.'}</p>
                      <div className="admin-record-title-row">
                        <Badge label={leader.is_featured_public ? 'PUBLIC' : 'HIDDEN'} variant={leader.is_featured_public ? 'active' : 'neutral'} />
                        <Badge label={leader.is_active ? 'ACTIVE' : 'ARCHIVED'} variant={leader.is_active ? 'active' : 'neutral'} />
                        <span className="admin-row-meta">Order {leader.display_order}</span>
                      </div>
                    </div>
                    <div className="admin-table-actions">
                      <Button variant="outline" size="sm" onClick={() => openLeader(leader)}>Edit</Button>
                      {leader.is_active ? <Button variant="danger" size="sm" onClick={() => { setError(''); setArchiveTarget(leader); }}>Archive</Button> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="admin-table-empty"><p>No central public leaders have been configured yet.</p></div>}
          </Card>
        </>
      ) : null}

      <Modal
        isOpen={storyOpen}
        onClose={() => { if (!savingStory && !uploading) setStoryOpen(false); }}
        title="Edit public church story"
        subtitle={selectedOrganization?.name}
        maxWidth="xl"
        footer={
          <>
            <Button variant="outline" disabled={savingStory || uploading} onClick={() => setStoryOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={savingStory} disabled={uploading} onClick={() => void saveStory()}>Save story</Button>
          </>
        }
      >
        <div className="admin-modal-form">
          {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
          <div className="admin-form-grid-two">
            <InputField label="Public title" value={storyDraft.title} onChange={(e) => setStoryDraft({ ...storyDraft, title: e.target.value })} required />
            <InputField label="Subtitle" value={storyDraft.subtitle} onChange={(e) => setStoryDraft({ ...storyDraft, subtitle: e.target.value })} />
          </div>
          <div className="admin-form-grid-two">
            <TextAreaField label="Mission" value={storyDraft.mission} onChange={(value) => setStoryDraft({ ...storyDraft, mission: value })} />
            <TextAreaField label="Vision" value={storyDraft.vision} onChange={(value) => setStoryDraft({ ...storyDraft, vision: value })} />
          </div>
          <TextAreaField label="Founding story" value={storyDraft.founding_story} onChange={(value) => setStoryDraft({ ...storyDraft, founding_story: value })} rows={6} />
          <div className="admin-form-grid-two">
            <InputField label="Founding year" type="number" value={storyDraft.founding_year ?? ''} onChange={(e) => setStoryDraft({ ...storyDraft, founding_year: e.target.value ? Number(e.target.value) : null })} placeholder="Optional" />
            <FileField label="Story banner" disabled={uploading} onChange={(file) => void handleStoryImage(file)} />
          </div>
          {storyDraft.banner_image_url ? <img src={storyDraft.banner_image_url} alt="Church story banner preview" className="admin-directory-image-preview banner" /> : null}
          <Toggle label="Publish in General Community" description="Makes this approved church story visible in the public directory." checked={storyDraft.is_published} onChange={(checked) => setStoryDraft({ ...storyDraft, is_published: checked })} />
        </div>
      </Modal>

      <Modal
        isOpen={leaderOpen}
        onClose={() => { if (!savingLeader && !uploading) setLeaderOpen(false); }}
        title={leaderDraft.id ? 'Edit central leader' : 'Add central leader'}
        subtitle={selectedOrganization?.name}
        maxWidth="xl"
        footer={
          <>
            <Button variant="outline" disabled={savingLeader || uploading} onClick={() => setLeaderOpen(false)}>Cancel</Button>
            <Button variant="gold" loading={savingLeader} disabled={uploading} onClick={() => void saveLeader()}>{leaderDraft.id ? 'Update leader' : 'Add leader'}</Button>
          </>
        }
      >
        <div className="admin-modal-form">
          {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}
          <div className="admin-form-grid-two">
            <InputField label="Full public name" value={leaderDraft.displayName} onChange={(e) => setLeaderDraft({ ...leaderDraft, displayName: e.target.value })} required />
            <InputField label="Role / title" value={leaderDraft.roleTitle} onChange={(e) => setLeaderDraft({ ...leaderDraft, roleTitle: e.target.value })} placeholder="Senior Pastor, Associate Pastor, Leader…" required />
            <InputField label="Ministry / responsibility" value={leaderDraft.ministry} onChange={(e) => setLeaderDraft({ ...leaderDraft, ministry: e.target.value })} />
            <InputField label="Display order" type="number" value={leaderDraft.displayOrder} onChange={(e) => setLeaderDraft({ ...leaderDraft, displayOrder: Number(e.target.value) || 0 })} />
          </div>
          <TextAreaField label="Short public bio" value={leaderDraft.shortBio} onChange={(value) => setLeaderDraft({ ...leaderDraft, shortBio: value })} />
          <TextAreaField label="Full biography" value={leaderDraft.fullBio} onChange={(value) => setLeaderDraft({ ...leaderDraft, fullBio: value })} rows={6} />
          <FileField label="Portrait" disabled={uploading} onChange={(file) => void handleLeaderImage(file)} />
          {leaderDraft.portraitUrl ? <img src={leaderDraft.portraitUrl} alt="Leader portrait preview" className="admin-directory-image-preview portrait" /> : null}
          <div className="admin-toggle-grid">
            <Toggle label="Founder" checked={leaderDraft.isFounder} onChange={(checked) => setLeaderDraft({ ...leaderDraft, isFounder: checked })} />
            <Toggle label="Show publicly" checked={leaderDraft.isFeaturedPublic} onChange={(checked) => setLeaderDraft({ ...leaderDraft, isFeaturedPublic: checked })} />
            <Toggle label="Active" checked={leaderDraft.isActive} onChange={(checked) => setLeaderDraft({ ...leaderDraft, isActive: checked })} />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        title="Archive public leader"
        subtitle={archiveTarget?.display_name}
        maxWidth="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => void archiveLeader()}>Archive leader</Button>
          </>
        }
      >
        <div className="admin-warning-callout">This removes the profile from the active public leadership directory without deleting its historical record.</div>
      </Modal>
    </div>
  );
}

function TextAreaField({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="admin-form-group">
      <span className="admin-form-label">{label}</span>
      <textarea className="admin-form-input admin-form-textarea" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FileField({ label, disabled, onChange }: { label: string; disabled?: boolean; onChange: (file?: File) => void }) {
  return (
    <label className="admin-form-group">
      <span className="admin-form-label">{label}</span>
      <input className="admin-file-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={(event) => onChange(event.target.files?.[0])} />
    </label>
  );
}
