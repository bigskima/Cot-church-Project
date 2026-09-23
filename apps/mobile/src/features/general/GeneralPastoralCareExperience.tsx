import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Icon,
  InputField,
  ResourceError,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import type { LiveFollowUp, PrayerRequest } from '@/types/content';
import { toUserFacingErrorMessage } from '@/api';
import { useGeneralMinistryAccess } from './useGeneralMinistryAccess';

type Queue = 'prayer' | 'care' | 'testimony';
type RoutedPrayer = PrayerRequest & {
  organization_id?: string;
  branch_id?: string | null;
  public_approved_at?: string | null;
  is_publicly_visible?: boolean;
};
type CareFollowUp = LiveFollowUp & {
  source?: 'live' | 'ai';
  branch_id?: string | null;
  stream_title?: string | null;
  user_phone?: string | null;
  user_username?: string | null;
  user_avatar?: string | null;
  care_category?: string | null;
  severity?: 'support' | 'elevated' | 'urgent' | null;
  source_mode?: 'member_requested' | 'automatic_safety' | null;
  summary?: string | null;
  conversation_excerpt?: string | null;
  last_member_message?: string | null;
  requires_immediate_attention?: boolean;
  member_notified?: boolean;
};
type ProfileSummary = { id: string; display_name?: string | null; username?: string | null; avatar_url?: string | null };
type Testimony = {
  id: string;
  organization_id: string;
  branch_id: string | null;
  author_profile_id: string;
  title: string;
  testimony: string;
  occurred_on?: string | null;
  share_in_service_consent: boolean;
  status: 'draft' | 'submitted' | 'reviewing' | 'responded' | 'approved' | 'declined' | 'archived';
  invited_to_share: boolean;
  service_notes: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  author?: ProfileSummary | ProfileSummary[] | null;
};
type TestimonyResponse = {
  id: string;
  testimony_id: string;
  responder_profile_id: string;
  message: string;
  response_type: 'message' | 'share_invitation' | 'review_note' | 'status_update';
  created_at: string;
  responder?: ProfileSummary | ProfileSummary[] | null;
};
type TestimonyResource = { testimonies: Testimony[]; responses: TestimonyResponse[] };

function oneProfile(value?: ProfileSummary | ProfileSummary[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function GeneralPastoralCareExperience() {
  const insets = useSafeAreaInsets();
  const { api, auth, context } = useSession();
  const { colors } = useTheme();
  const access = useGeneralMinistryAccess();
  const organizationId = access.organizationId;
  const profileId = context?.profile?.id ?? '';
  const accessToken = auth?.session.accessToken ?? null;
  const availableQueues = useMemo<Queue[]>(() => [
    ...(access.canManagePrayer ? ['prayer' as const] : []),
    ...(access.canReceivePastoralFollowups ? ['care' as const] : []),
    ...(access.canReviewTestimonies ? ['testimony' as const] : []),
  ], [access.canManagePrayer, access.canReceivePastoralFollowups, access.canReviewTestimonies]);
  const [queue, setQueue] = useState<Queue>(availableQueues[0] ?? 'prayer');
  const activeQueue = availableQueues.includes(queue) ? queue : availableQueues[0] ?? 'prayer';
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTestimony, setSelectedTestimony] = useState<Testimony | null>(null);
  const [responseText, setResponseText] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');

  const prayerQuery = (() => {
    const query = new URLSearchParams({ view: 'moderation', scope: 'general' });
    if (organizationId) query.set('organizationId', organizationId);
    return `prayer-requests?${query.toString()}`;
  })();

  const prayers = useResource<RoutedPrayer[]>(
    `general:pastoral:prayers:${organizationId || 'none'}`,
    (signal) => access.canManagePrayer ? api.request<RoutedPrayer[]>(prayerQuery, { signal }) : Promise.resolve([]),
  );
  const followups = useResource<CareFollowUp[]>(
    `general:pastoral:followups:${organizationId || 'none'}`,
    (signal) => access.canReceivePastoralFollowups ? api.request<CareFollowUp[]>('pastoral-followups?scope=general', { signal }) : Promise.resolve([]),
  );
  const testimonies = useResource<TestimonyResource>(
    `general:pastoral:testimonies:${organizationId || 'none'}:${access.canReviewTestimonies}`,
    async () => {
      if (!access.canReviewTestimonies || !organizationId) return { testimonies: [], responses: [] };
      const supabase = await getRuntimeSupabase(accessToken);
      const testimonyResult = await supabase
        .from('testimonies')
        .select('id,organization_id,branch_id,author_profile_id,title,testimony,occurred_on,share_in_service_consent,status,invited_to_share,service_notes,reviewed_by,reviewed_at,created_at,updated_at,author:profiles!testimonies_author_profile_id_fkey(id,display_name,username,avatar_url)')
        .eq('organization_id', organizationId)
        .is('branch_id', null)
        .order('created_at', { ascending: false });
      if (testimonyResult.error) throw new Error(testimonyResult.error.message || 'Unable to load testimonies.');
      const rows = (testimonyResult.data ?? []) as unknown as Testimony[];
      const ids = rows.map((item) => item.id);
      if (!ids.length) return { testimonies: rows, responses: [] };
      const responseResult = await supabase
        .from('testimony_responses')
        .select('id,testimony_id,responder_profile_id,message,response_type,created_at,responder:profiles!testimony_responses_responder_profile_id_fkey(id,display_name,username,avatar_url)')
        .in('testimony_id', ids)
        .order('created_at', { ascending: true });
      if (responseResult.error) throw new Error(responseResult.error.message || 'Unable to load testimony responses.');
      return { testimonies: rows, responses: (responseResult.data ?? []) as unknown as TestimonyResponse[] };
    },
  );

  const prayerList = prayers.data ?? [];
  const careList = followups.data ?? [];
  const testimonyList = useMemo(() => (testimonies.data?.testimonies ?? []).filter((item) => item.status !== 'draft'), [testimonies.data?.testimonies]);
  const selectedResponses = useMemo(() => (testimonies.data?.responses ?? []).filter((item) => item.testimony_id === selectedTestimony?.id), [selectedTestimony?.id, testimonies.data?.responses]);

  const refreshAll = async () => {
    await Promise.allSettled([prayers.refresh(), followups.refresh(), testimonies.refresh()]);
  };

  const updatePrayer = async (id: string, patch: { status?: 'praying' | 'answered' | 'archived'; approvePublic?: boolean }) => {
    setWorkingId(id); setError(''); setSuccess('');
    try {
      await api.request('prayer-requests', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
      setSuccess(patch.approvePublic === true ? 'Prayer approved for the public wall.' : patch.approvePublic === false ? 'Prayer removed from the public wall.' : patch.status === 'answered' ? 'Prayer marked answered.' : 'Prayer status updated.');
      prayers.refresh();
    } catch (value) {
      setError(toUserFacingErrorMessage(value, 'We couldn’t update this prayer request.'));
    } finally { setWorkingId(null); }
  };

  const updateFollowup = async (id: string, status: 'contacted' | 'resolved' | 'closed', source: 'live' | 'ai' = 'live') => {
    setWorkingId(id); setError(''); setSuccess('');
    try {
      await api.request('pastoral-followups', { method: 'PATCH', body: JSON.stringify({ id, status, source }) });
      setSuccess(status === 'resolved' ? 'Care follow-up resolved.' : 'Care follow-up updated.');
      followups.refresh();
    } catch (value) {
      setError(toUserFacingErrorMessage(value, 'We couldn’t update this care follow-up.'));
    } finally { setWorkingId(null); }
  };

  const respondToTestimony = async (responseType: TestimonyResponse['response_type'] = 'message') => {
    if (!selectedTestimony || !profileId || !responseText.trim() || !access.canReviewTestimonies) return;
    setWorkingId(selectedTestimony.id); setError(''); setSuccess('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const inserted = await supabase.from('testimony_responses').insert({
        testimony_id: selectedTestimony.id,
        responder_profile_id: profileId,
        message: responseText.trim(),
        response_type: responseType,
      });
      if (inserted.error) throw new Error(inserted.error.message || 'Unable to respond to testimony.');
      const patch: Record<string, unknown> = {
        status: 'responded',
        reviewed_by: profileId,
        reviewed_at: new Date().toISOString(),
      };
      if (responseType === 'share_invitation') patch.invited_to_share = true;
      if (serviceNotes.trim()) patch.service_notes = serviceNotes.trim();
      const updated = await supabase.from('testimonies').update(patch).eq('id', selectedTestimony.id).is('branch_id', null);
      if (updated.error) throw new Error(updated.error.message || 'Unable to update testimony workflow.');
      setResponseText('');
      setSuccess(responseType === 'share_invitation' ? 'Invitation to share was recorded and sent in the testimony thread.' : 'Response added to the testimony thread.');
      await testimonies.refresh();
      setSelectedTestimony((current) => current ? { ...current, status: 'responded', invited_to_share: current.invited_to_share || responseType === 'share_invitation', service_notes: serviceNotes.trim() || current.service_notes } : current);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to respond to testimony.');
    } finally { setWorkingId(null); }
  };

  const changeTestimonyStatus = async (status: Testimony['status']) => {
    if (!selectedTestimony || !profileId || !access.canReviewTestimonies) return;
    setWorkingId(selectedTestimony.id); setError(''); setSuccess('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const updated = await supabase.from('testimonies').update({
        status,
        reviewed_by: profileId,
        reviewed_at: new Date().toISOString(),
        service_notes: serviceNotes.trim() || selectedTestimony.service_notes,
      }).eq('id', selectedTestimony.id).is('branch_id', null);
      if (updated.error) throw new Error(updated.error.message || 'Unable to update testimony status.');
      setSelectedTestimony({ ...selectedTestimony, status, service_notes: serviceNotes.trim() || selectedTestimony.service_notes });
      setSuccess(`Testimony marked ${status}.`);
      testimonies.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update testimony.');
    } finally { setWorkingId(null); }
  };

  if (!access.accessReady) {
    return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.md }]}><View style={styles.body}><Skeleton height={110} count={3} /></View></View>;
  }

  if (!access.canManageCare) {
    return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}><ScreenHeader title="Pastoral Care" kicker="MINISTRY" showBack /><View style={styles.body}><EmptyState title="Pastoral workspace unavailable" message="Prayer, testimony and follow-up queues appear only for the ministry roles assigned to them." iconName="lock-closed-outline" /></View></View>;
  }

  const counts: Record<Queue, number> = { prayer: prayerList.length, care: careList.length, testimony: testimonyList.length };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={prayers.refreshing || followups.refreshing || testimonies.refreshing} onRefresh={() => void refreshAll()} tintColor={colors.interactive} />}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}
      >
        <ScreenHeader title="Pastoral Care" kicker="MINISTRY · CARE" subtitle="Prayer, care responses and testimonies are separated into focused queues while remaining in one church-wide workspace." showBack />
        <View style={styles.body}>
          {success ? <Pressable onPress={() => setSuccess('')} style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{success}</Text></Pressable> : null}
          {error ? <Pressable onPress={() => setError('')} style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></Pressable> : null}

          <View style={[styles.queueTabs, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            {availableQueues.map((item) => <Chip key={item} label={item === 'prayer' ? 'Prayer' : item === 'care' ? 'Follow-ups' : 'Testimonies'} icon={item === 'prayer' ? 'heart-outline' : item === 'care' ? 'people-outline' : 'sparkles-outline'} count={counts[item]} selected={activeQueue === item} onPress={() => setQueue(item)} />)}
          </View>

          {activeQueue === 'prayer' ? (
            <View style={styles.section}>
              <SectionHeader title="Prayer inbox" badge={prayerList.length} subtitle="Confidential petitions routed to your General COT prayer role" />
              {prayers.loading && !prayers.data ? <Skeleton height={150} count={2} /> : prayers.error && !prayers.data ? <ResourceError message={prayers.error} retry={prayers.refresh} /> : prayerList.length ? prayerList.map((item) => {
                const wallIntent = item.privacy === 'public_approved';
                const approved = item.is_publicly_visible === true;
                const busy = workingId === item.id;
                return <View key={item.id} style={[styles.caseCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <View style={styles.caseTop}><Badge label={item.privacy === 'pastoral_only' ? 'CONFIDENTIAL' : item.privacy === 'prayer_team' ? 'PRAYER TEAM' : approved ? 'ON PRAYER WALL' : 'WALL REVIEW'} variant={item.privacy === 'pastoral_only' ? 'prayer' : 'primary'} /><Text style={[styles.date, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text></View>
                  <Text style={[styles.caseTitle, { color: colors.text }]}>{item.title}</Text>
                  {item.request || item.description ? <Text style={[styles.caseBody, { color: colors.textSecondary }]}>{item.request || item.description}</Text> : null}
                  {wallIntent ? <View style={[styles.inlinePanel, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Text style={[styles.inlineText, { color: colors.textSecondary }]}>The member allowed public-wall consideration. Ministry approval still controls whether it appears.</Text><Button label={approved ? 'Remove from wall' : 'Approve for wall'} onPress={() => void updatePrayer(item.id, { approvePublic: !approved })} variant={approved ? 'outline' : 'secondary'} size="sm" loading={busy} /></View> : null}
                  <View style={[styles.caseFooter, { borderTopColor: colors.borderSubtle }]}><Text style={[styles.statusText, { color: colors.textMuted }]}>Status · <Text style={{ color: colors.interactive, fontWeight: '800' }}>{item.status || 'submitted'}</Text></Text><View style={styles.actions}><Button label="Praying" onPress={() => void updatePrayer(item.id, { status: 'praying' })} variant="outline" size="sm" loading={busy} /><Button label="Answered" onPress={() => void updatePrayer(item.id, { status: 'answered' })} size="sm" loading={busy} /></View></View>
                </View>;
              }) : <EmptyState title="Prayer inbox is clear" message="New General COT petitions routed to your role will appear here." iconName="heart-outline" />}
            </View>
          ) : null}

          {activeQueue === 'care' ? (
            <View style={styles.section}>
              <SectionHeader title="Care follow-ups" badge={careList.length} subtitle="Altar responses, counselling requests, live-service follow-ups and confidential COT AI care alerts" />
              {followups.loading && !followups.data ? <Skeleton height={140} count={2} /> : followups.error && !followups.data ? <ResourceError message={followups.error} retry={followups.refresh} /> : careList.length ? careList.map((item) => {
                const busy = workingId === item.id;
                return <View key={item.id} style={[styles.caseCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                  <View style={styles.caseTop}><Badge label={item.source === 'ai' ? `COT AI · ${(item.severity || 'support').toUpperCase()}` : item.type.replaceAll('_', ' ').toUpperCase()} variant={item.requires_immediate_attention ? 'warning' : 'primary'} /><Text style={[styles.date, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleDateString()}</Text></View>
                  <Text style={[styles.caseTitle, { color: colors.text }]}>{item.user_name || 'Church participant'}</Text>
                  {item.user_username ? <Text style={[styles.metaText, { color: colors.textMuted }]}>@{item.user_username}</Text> : null}
                  {item.source === 'ai' && item.summary ? <Text style={[styles.caseBody, { color: colors.textSecondary }]}>{item.summary}</Text> : null}
                  {item.source === 'ai' && item.last_member_message ? <View style={[styles.inlinePanel, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Text style={[styles.fieldLabel, { color: colors.textMuted }]}>LATEST MEMBER MESSAGE</Text><Text style={[styles.caseBody, { color: colors.text }]}>{item.last_member_message}</Text></View> : null}
                  {item.stream_title ? <Text style={[styles.caseBody, { color: colors.textSecondary }]}>From {item.stream_title}</Text> : null}
                  {item.user_phone ? <Text style={[styles.contactText, { color: colors.interactive }]}>{item.user_phone}</Text> : null}
                  {item.private_note ? <Text style={[styles.caseBody, { color: colors.textSecondary }]}>{item.private_note}</Text> : null}
                  <View style={[styles.caseFooter, { borderTopColor: colors.borderSubtle }]}><Text style={[styles.statusText, { color: colors.textMuted }]}>Status · <Text style={{ color: colors.interactive, fontWeight: '800' }}>{item.status}</Text></Text><View style={styles.actions}><Button label="Contacted" onPress={() => void updateFollowup(item.id, 'contacted', item.source || 'live')} variant="outline" size="sm" loading={busy} /><Button label="Resolved" onPress={() => void updateFollowup(item.id, 'resolved', item.source || 'live')} size="sm" loading={busy} /></View></View>
                </View>;
              }) : <EmptyState title="No care follow-ups" message="General COT follow-up requests and confidential COT AI care alerts routed to your ministry role will appear here." iconName="people-outline" />}
            </View>
          ) : null}

          {activeQueue === 'testimony' ? (
            <View style={styles.section}>
              <SectionHeader title="Testimony review" badge={testimonyList.length} subtitle="Review, respond and coordinate physical sharing without mixing testimony into the public feed" />
              {testimonies.loading && !testimonies.data ? <Skeleton height={150} count={2} /> : testimonies.error && !testimonies.data ? <ResourceError message={testimonies.error} retry={testimonies.refresh} /> : testimonyList.length ? testimonyList.map((item) => {
                const author = oneProfile(item.author);
                const responseCount = (testimonies.data?.responses ?? []).filter((response) => response.testimony_id === item.id).length;
                return <Pressable key={item.id} onPress={() => { setSelectedTestimony(item); setServiceNotes(item.service_notes || ''); setResponseText(''); }} style={({ pressed }) => [styles.caseCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}>
                  <View style={styles.authorRow}><Avatar url={author?.avatar_url ?? undefined} name={author?.display_name || 'Church member'} size="sm" /><View style={styles.flex}><Text style={[styles.authorName, { color: colors.text }]}>{author?.display_name || 'Church member'}</Text><Text style={[styles.date, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleString()}</Text></View><Badge label={item.status.toUpperCase()} variant={item.status === 'approved' ? 'success' : item.status === 'declined' || item.status === 'archived' ? 'neutral' : 'primary'} /></View>
                  <Text style={[styles.caseTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.caseBody, { color: colors.textSecondary }]} numberOfLines={5}>{item.testimony}</Text>
                  <View style={styles.testimonyMeta}><Text style={[styles.metaText, { color: colors.textMuted }]}>{responseCount} response{responseCount === 1 ? '' : 's'}</Text>{item.share_in_service_consent ? <Text style={[styles.metaText, { color: colors.interactive }]}>Member allows service sharing</Text> : null}{item.invited_to_share ? <Text style={[styles.metaText, { color: colors.success }]}>Invited to share</Text> : null}</View>
                </Pressable>;
              }) : <EmptyState title="No testimonies waiting" message="General COT testimonies submitted for ministry review will appear here." iconName="sparkles-outline" />}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <BottomSheet visible={Boolean(selectedTestimony)} onClose={() => { if (!workingId) { setSelectedTestimony(null); setResponseText(''); setServiceNotes(''); } }} title={selectedTestimony?.title || 'Testimony'} subtitle="General COT · Private ministry review" maxHeightPercent={96}>
        {selectedTestimony ? <View style={styles.testimonySheet}>
          <View style={[styles.privacyPanel, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}><Icon name="lock-closed-outline" size={18} color={colors.interactive} /><Text style={[styles.inlineText, { color: colors.textSecondary }]}>This testimony is private. Respond here, and share it publicly only when the member has given permission.</Text></View>
          <Text style={[styles.sheetStory, { color: colors.text }]}>{selectedTestimony.testimony}</Text>
          {selectedTestimony.occurred_on ? <Text style={[styles.metaText, { color: colors.textMuted }]}>Occurred · {selectedTestimony.occurred_on}</Text> : null}
          <View style={styles.responseStack}>{selectedResponses.map((response) => { const responder = oneProfile(response.responder); return <View key={response.id} style={[styles.responseCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><View style={styles.responseTop}><Text style={[styles.responseName, { color: colors.text }]}>{responder?.display_name || 'Ministry team'}</Text><Text style={[styles.date, { color: colors.textMuted }]}>{new Date(response.created_at).toLocaleString()}</Text></View><Text style={[styles.caseBody, { color: colors.textSecondary }]}>{response.message}</Text>{response.response_type === 'share_invitation' ? <Badge label="SHARE INVITATION" variant="primary" /> : null}</View>; })}</View>
          <InputField label="Private response" value={responseText} onChangeText={setResponseText} multiline numberOfLines={4} placeholder="Write a response to the member…" />
          <InputField label="Service / ministry notes" value={serviceNotes} onChangeText={setServiceNotes} multiline numberOfLines={3} placeholder="Internal coordination notes…" />
          <View style={styles.actions}><Button label="Send response" onPress={() => void respondToTestimony('message')} disabled={!responseText.trim()} loading={workingId === selectedTestimony.id} variant="outline" size="sm" />{selectedTestimony.share_in_service_consent ? <Button label="Invite to share" onPress={() => void respondToTestimony('share_invitation')} disabled={!responseText.trim()} loading={workingId === selectedTestimony.id} size="sm" /> : null}</View>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>WORKFLOW STATUS</Text>
          <View style={styles.statusChips}><Chip label="Reviewing" selected={selectedTestimony.status === 'reviewing'} onPress={() => void changeTestimonyStatus('reviewing')} /><Chip label="Approved" selected={selectedTestimony.status === 'approved'} onPress={() => void changeTestimonyStatus('approved')} /><Chip label="Declined" selected={selectedTestimony.status === 'declined'} onPress={() => void changeTestimonyStatus('declined')} /><Chip label="Archived" selected={selectedTestimony.status === 'archived'} onPress={() => void changeTestimonyStatus('archived')} /></View>
        </View> : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, noticeText: { flex: 1, fontSize: 11.5, lineHeight: 17, fontWeight: '700' },
  queueTabs: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.xs, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, section: { gap: spacing.sm },
  caseCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, caseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, date: { fontSize: 9.5, lineHeight: 14 }, caseTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' }, caseBody: { fontSize: 11.5, lineHeight: 18 }, contactText: { fontSize: 12.5, fontWeight: '800' },
  inlinePanel: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm }, inlineText: { flex: 1, fontSize: 10.5, lineHeight: 16 }, caseFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: spacing.sm }, statusText: { fontSize: 10.5 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'flex-end' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, authorName: { fontSize: 12.5, fontWeight: '900' }, testimonyMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, metaText: { fontSize: 9.5, lineHeight: 14, fontWeight: '700' }, pressed: { opacity: 0.84 },
  testimonySheet: { gap: spacing.md }, privacyPanel: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, sheetStory: { fontSize: 14, lineHeight: 22 }, responseStack: { gap: spacing.sm }, responseCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.xs }, responseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, responseName: { fontSize: 11.5, fontWeight: '900' }, fieldLabel: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 }, statusChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
