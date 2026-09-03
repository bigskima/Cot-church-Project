import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api';

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
  displayName: '', portraitUrl: '', roleTitle: '', shortBio: '', fullBio: '', ministry: '',
  displayOrder: 0, isFounder: false, isFeaturedPublic: true, isActive: true,
};

export function PublicDirectory({ api }: { api: ApiClient }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [story, setStory] = useState<Story>(blankStory);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [leaderDraft, setLeaderDraft] = useState<LeaderDraft>(blankLeader);
  const [loading, setLoading] = useState(true);
  const [savingStory, setSavingStory] = useState(false);
  const [savingLeader, setSavingLeader] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedOrganization = useMemo(() => organizations.find((item) => item.id === organizationId), [organizations, organizationId]);

  useEffect(() => {
    api.request<Payload>('platform-public-directory')
      .then((data) => {
        setOrganizations(data.organizations ?? []);
        const first = data.organizations?.find((item) => item.status === 'active') ?? data.organizations?.[0];
        if (first) setOrganizationId(first.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load public directory'))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    setError('');
    api.request<Payload>(`platform-public-directory?organizationId=${encodeURIComponent(organizationId)}`)
      .then((data) => {
        setOrganizations(data.organizations ?? []);
        setStory(data.story ?? blankStory);
        setLeaders(data.leaders ?? []);
        setLeaderDraft(blankLeader);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load public directory'))
      .finally(() => setLoading(false));
  }, [api, organizationId]);

  async function uploadImage(file: File) {
    if (!organizationId) throw new Error('Select an organization first.');
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
    setUploading(true); setError('');
    try {
      const result = await uploadImage(file);
      setStory((current) => ({ ...current, banner_image_url: result.publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload story image');
    } finally { setUploading(false); }
  }

  async function handleLeaderImage(file?: File) {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const result = await uploadImage(file);
      setLeaderDraft((current) => ({ ...current, portraitUrl: result.publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload portrait');
    } finally { setUploading(false); }
  }

  async function saveStory(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    setSavingStory(true); setError(''); setMessage('');
    try {
      const saved = await api.request<Story>('platform-public-directory', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'upsert_story', organizationId,
          title: story.title, subtitle: story.subtitle, mission: story.mission, vision: story.vision,
          foundingStory: story.founding_story, foundingYear: story.founding_year,
          historyMilestones: story.history_milestones, values: story.values,
          bannerImageUrl: story.banner_image_url, isPublished: story.is_published,
        }),
      });
      setStory(saved); setMessage('General Community church story saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save church story'); }
    finally { setSavingStory(false); }
  }

  function editLeader(leader: Leader) {
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
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  async function saveLeader(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    setSavingLeader(true); setError(''); setMessage('');
    try {
      const saved = await api.request<Leader>('platform-public-directory', {
        method: 'PATCH',
        body: JSON.stringify({
          action: leaderDraft.id ? 'update_leader' : 'create_leader',
          organizationId, leaderId: leaderDraft.id,
          displayName: leaderDraft.displayName, portraitUrl: leaderDraft.portraitUrl || null,
          roleTitle: leaderDraft.roleTitle, shortBio: leaderDraft.shortBio,
          fullBio: leaderDraft.fullBio, ministry: leaderDraft.ministry || null,
          displayOrder: leaderDraft.displayOrder, isFounder: leaderDraft.isFounder,
          isFeaturedPublic: leaderDraft.isFeaturedPublic, isActive: leaderDraft.isActive,
          socialLinks: {},
        }),
      });
      setLeaders((current) => leaderDraft.id ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.display_order - b.display_order));
      setLeaderDraft(blankLeader);
      setMessage(leaderDraft.id ? 'Leader profile updated.' : 'Leader profile added to the General Community directory.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save leader profile'); }
    finally { setSavingLeader(false); }
  }

  async function archiveLeader(id: string) {
    if (!organizationId || !window.confirm('Archive this public leader profile?')) return;
    setError('');
    try {
      await api.request('platform-public-directory', {
        method: 'DELETE',
        body: JSON.stringify({ action: 'archive_leader', organizationId, leaderId: id }),
      });
      setLeaders((current) => current.map((item) => item.id === id ? { ...item, is_active: false } : item));
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to archive leader profile'); }
  }

  return (
    <div className="public-directory">
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">GENERAL COMMUNITY PUBLIC PRESENCE</span>
            <h2>Church Story & Central Leadership</h2>
            <p>Manage information intentionally published to visitors and the General Community. Expression leadership is managed inside each Expression and is not controlled here.</p>
          </div>
          <select className="search" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {organization.status}</option>)}
          </select>
        </div>
        {error && <div className="error">{error}</div>}
        {message && <div className="pill green" style={{ padding: '8px 14px', margin: '12px 0' }}>{message}</div>}
        {loading ? <div className="loading">Loading public directory…</div> : null}
      </section>

      {!loading && selectedOrganization ? (
        <>
          <section className="panel">
            <div className="panel-title"><div><span className="eyebrow">PUBLIC CHURCH STORY</span><h2>{selectedOrganization.name}</h2><p>Only publish information that the church has actually configured and approved.</p></div></div>
            <form onSubmit={saveStory} style={{ display: 'grid', gap: 14 }}>
              <div className="grid">
                <label><strong>Public title</strong><input className="search" style={{ width: '100%', marginTop: 6 }} value={story.title} onChange={(e) => setStory({ ...story, title: e.target.value })} required /></label>
                <label><strong>Subtitle</strong><input className="search" style={{ width: '100%', marginTop: 6 }} value={story.subtitle} onChange={(e) => setStory({ ...story, subtitle: e.target.value })} /></label>
              </div>
              <div className="grid">
                <label><strong>Mission</strong><textarea className="search" style={{ width: '100%', minHeight: 110, marginTop: 6 }} value={story.mission} onChange={(e) => setStory({ ...story, mission: e.target.value })} /></label>
                <label><strong>Vision</strong><textarea className="search" style={{ width: '100%', minHeight: 110, marginTop: 6 }} value={story.vision} onChange={(e) => setStory({ ...story, vision: e.target.value })} /></label>
              </div>
              <label><strong>Founding story</strong><textarea className="search" style={{ width: '100%', minHeight: 170, marginTop: 6 }} value={story.founding_story} onChange={(e) => setStory({ ...story, founding_story: e.target.value })} /></label>
              <div className="grid">
                <label><strong>Founding year (optional)</strong><input type="number" className="search" style={{ width: '100%', marginTop: 6 }} value={story.founding_year ?? ''} onChange={(e) => setStory({ ...story, founding_year: e.target.value ? Number(e.target.value) : null })} /></label>
                <label><strong>Story banner</strong><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => void handleStoryImage(e.target.files?.[0])} style={{ display: 'block', marginTop: 10 }} /></label>
              </div>
              {story.banner_image_url ? <img src={story.banner_image_url} alt="Church story banner preview" style={{ maxWidth: 420, maxHeight: 220, objectFit: 'cover', borderRadius: 12 }} /> : null}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={story.is_published} onChange={(e) => setStory({ ...story, is_published: e.target.checked })} /> <strong>Publish this story in General Community</strong></label>
              <div><button className="admin-btn-primary" type="submit" disabled={savingStory || uploading}>{savingStory ? 'Saving…' : 'Save Church Story'}</button></div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-title"><div><span className="eyebrow">CENTRAL PUBLIC LEADERSHIP</span><h2>Pastors & Leaders</h2><p>These profiles belong to the General Community directory only. They do not grant roles or permissions.</p></div></div>
            {leaders.length ? (
              <div className="grid">
                {leaders.map((leader) => (
                  <article key={leader.id} className="panel" style={{ margin: 0, opacity: leader.is_active ? 1 : 0.55 }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      {leader.portrait_url ? <img src={leader.portrait_url} alt="" style={{ width: 64, height: 64, borderRadius: 999, objectFit: 'cover' }} /> : <div style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--panel-strong)' }} />}
                      <div style={{ flex: 1 }}><strong>{leader.display_name}</strong><div>{leader.role_title}</div><small>{leader.is_featured_public ? 'Public' : 'Hidden'} · order {leader.display_order}</small></div>
                    </div>
                    <p>{leader.short_bio}</p>
                    <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => editLeader(leader)}>Edit</button>{leader.is_active ? <button type="button" onClick={() => void archiveLeader(leader.id)}>Archive</button> : null}</div>
                  </article>
                ))}
              </div>
            ) : <div className="alert-notice">No central public leaders have been configured yet.</div>}
          </section>

          <section className="panel">
            <div className="panel-title"><div><span className="eyebrow">{leaderDraft.id ? 'EDIT CENTRAL PROFILE' : 'ADD CENTRAL PROFILE'}</span><h2>{leaderDraft.id ? 'Update Pastor / Leader' : 'Add Pastor / Leader'}</h2></div></div>
            <form onSubmit={saveLeader} style={{ display: 'grid', gap: 14 }}>
              <div className="grid">
                <label><strong>Full public name</strong><input className="search" style={{ width: '100%', marginTop: 6 }} value={leaderDraft.displayName} onChange={(e) => setLeaderDraft({ ...leaderDraft, displayName: e.target.value })} required /></label>
                <label><strong>Role / title</strong><input className="search" style={{ width: '100%', marginTop: 6 }} placeholder="Senior Pastor, Associate Pastor, Leader…" value={leaderDraft.roleTitle} onChange={(e) => setLeaderDraft({ ...leaderDraft, roleTitle: e.target.value })} required /></label>
              </div>
              <div className="grid">
                <label><strong>Ministry / responsibility</strong><input className="search" style={{ width: '100%', marginTop: 6 }} value={leaderDraft.ministry} onChange={(e) => setLeaderDraft({ ...leaderDraft, ministry: e.target.value })} /></label>
                <label><strong>Display order</strong><input type="number" className="search" style={{ width: '100%', marginTop: 6 }} value={leaderDraft.displayOrder} onChange={(e) => setLeaderDraft({ ...leaderDraft, displayOrder: Number(e.target.value) || 0 })} /></label>
              </div>
              <label><strong>Short public bio</strong><textarea className="search" style={{ width: '100%', minHeight: 90, marginTop: 6 }} value={leaderDraft.shortBio} onChange={(e) => setLeaderDraft({ ...leaderDraft, shortBio: e.target.value })} /></label>
              <label><strong>Full biography</strong><textarea className="search" style={{ width: '100%', minHeight: 150, marginTop: 6 }} value={leaderDraft.fullBio} onChange={(e) => setLeaderDraft({ ...leaderDraft, fullBio: e.target.value })} /></label>
              <label><strong>Portrait</strong><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => void handleLeaderImage(e.target.files?.[0])} style={{ display: 'block', marginTop: 10 }} /></label>
              {leaderDraft.portraitUrl ? <img src={leaderDraft.portraitUrl} alt="Leader portrait preview" style={{ width: 110, height: 110, borderRadius: 999, objectFit: 'cover' }} /> : null}
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <label><input type="checkbox" checked={leaderDraft.isFounder} onChange={(e) => setLeaderDraft({ ...leaderDraft, isFounder: e.target.checked })} /> Founder</label>
                <label><input type="checkbox" checked={leaderDraft.isFeaturedPublic} onChange={(e) => setLeaderDraft({ ...leaderDraft, isFeaturedPublic: e.target.checked })} /> Show publicly</label>
                <label><input type="checkbox" checked={leaderDraft.isActive} onChange={(e) => setLeaderDraft({ ...leaderDraft, isActive: e.target.checked })} /> Active</label>
              </div>
              <div style={{ display: 'flex', gap: 10 }}><button className="admin-btn-primary" type="submit" disabled={savingLeader || uploading}>{savingLeader ? 'Saving…' : leaderDraft.id ? 'Update Leader' : 'Add Leader'}</button>{leaderDraft.id ? <button type="button" onClick={() => setLeaderDraft(blankLeader)}>Cancel</button> : null}</div>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}
