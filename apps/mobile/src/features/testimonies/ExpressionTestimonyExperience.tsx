import React, { useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
import { DateTimeField, formatDateOnly } from '@/components/DateTimeField';
import { ScripturePreviewCard } from '@/components/bible/ScriptureReferenceText';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type ProfileSummary = { id: string; display_name?: string | null; username?: string | null; avatar_url?: string | null };
type Testimony = {
  id: string;
  organization_id: string;
  branch_id: string;
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character));
}

function pdfHtml(testimony: Testimony, responses: TestimonyResponse[], expressionName: string) {
  const author = oneProfile(testimony.author);
  const responseHtml = responses.length
    ? responses.map((response) => {
        const responder = oneProfile(response.responder);
        return `<div class="response"><strong>${escapeHtml(responder?.display_name || 'Expression team')}</strong><span>${new Date(response.created_at).toLocaleString()}</span><p>${escapeHtml(response.message).replace(/\n/g, '<br/>')}</p></div>`;
      }).join('')
    : '<p class="muted">No responses recorded yet.</p>';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    body{font-family:Arial,sans-serif;padding:36px;color:#171717;line-height:1.55} h1{font-size:26px;margin:0 0 4px} h2{font-size:15px;margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:6px} .meta{color:#666;font-size:12px}.box{background:#f6f6f6;padding:16px;border-radius:10px}.response{margin:12px 0;padding:12px;border:1px solid #ddd;border-radius:8px}.response span{display:block;color:#777;font-size:10px;margin-top:2px}.muted{color:#777}.footer{margin-top:32px;font-size:10px;color:#777}
  </style></head><body>
    <div class="meta">${escapeHtml(expressionName)} · Private testimony record</div>
    <h1>${escapeHtml(testimony.title)}</h1>
    <div class="meta">Documented by ${escapeHtml(author?.display_name || 'Expression member')} · ${new Date(testimony.created_at).toLocaleString()}</div>
    ${testimony.occurred_on ? `<div class="meta">Occurred on ${escapeHtml(testimony.occurred_on)}</div>` : ''}
    <h2>Testimony</h2><div class="box">${escapeHtml(testimony.testimony).replace(/\n/g, '<br/>')}</div>
    <h2>Service sharing</h2><p>Member consent: ${testimony.share_in_service_consent ? 'Yes' : 'No'}<br/>Invited to share: ${testimony.invited_to_share ? 'Yes' : 'No'}${testimony.service_notes ? `<br/>Notes: ${escapeHtml(testimony.service_notes)}` : ''}</p>
    <h2>Responses</h2>${responseHtml}
    <div class="footer">Generated from the private COT Expression testimony workflow. This PDF contains ministry information and should be handled according to the Expression's access policy.</div>
  </body></html>`;
}

export default function ExpressionTestimonyExperience({ managed = false }: { managed?: boolean }) {
  const insets = useSafeAreaInsets();
  const { auth, context, hasCapability, mode } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.expressions?.find((item) => item.id === expression?.id)?.organizationId ?? '';
  const profileId = context?.profile?.id ?? '';
  const accessToken = auth?.session.accessToken ?? null;
  const canReview = Boolean(expression?.id) && (hasCapability('testimonies.review') || hasCapability('testimonies.manage'));
  const canManage = Boolean(expression?.id) && hasCapability('testimonies.manage');

  const [composerOpen, setComposerOpen] = useState(false);
  const [selected, setSelected] = useState<Testimony | null>(null);
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [occurredOn, setOccurredOn] = useState<Date | null>(null);
  const [consent, setConsent] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const resource = useResource<TestimonyResource>(
    `expression:testimonies:${expression?.id ?? 'none'}:${canReview}:${mode}`,
    async () => {
      if (mode !== 'authenticated' || !expression?.id || !organizationId) return { testimonies: [], responses: [] };
      const supabase = await getRuntimeSupabase(accessToken);
      const testimonyResult = await supabase
        .from('testimonies')
        .select('id,organization_id,branch_id,author_profile_id,title,testimony,occurred_on,share_in_service_consent,status,invited_to_share,service_notes,reviewed_by,reviewed_at,created_at,updated_at,author:profiles!testimonies_author_profile_id_fkey(id,display_name,username,avatar_url)')
        .eq('organization_id', organizationId)
        .eq('branch_id', expression.id)
        .order('created_at', { ascending: false });
      if (testimonyResult.error) throw new Error(testimonyResult.error.message || 'Unable to load testimonies.');
      const testimonies = (testimonyResult.data ?? []) as unknown as Testimony[];
      const ids = testimonies.map((item) => item.id);
      if (!ids.length) return { testimonies, responses: [] };
      const responseResult = await supabase
        .from('testimony_responses')
        .select('id,testimony_id,responder_profile_id,message,response_type,created_at,responder:profiles!testimony_responses_responder_profile_id_fkey(id,display_name,username,avatar_url)')
        .in('testimony_id', ids)
        .order('created_at', { ascending: true });
      if (responseResult.error) throw new Error(responseResult.error.message || 'Unable to load testimony responses.');
      return { testimonies, responses: (responseResult.data ?? []) as unknown as TestimonyResponse[] };
    },
  );

  const testimonies = resource.data?.testimonies ?? [];
  const own = useMemo(() => testimonies.filter((item) => item.author_profile_id === profileId), [profileId, testimonies]);
  const reviewQueue = useMemo(() => testimonies.filter((item) => item.author_profile_id !== profileId), [profileId, testimonies]);
  const selectedResponses = useMemo(() => (resource.data?.responses ?? []).filter((item) => item.testimony_id === selected?.id), [resource.data?.responses, selected?.id]);

  const submit = async () => {
    if (!expression?.id || !organizationId || !profileId) return;
    if (!title.trim() || !story.trim()) return setErrorMsg('Add a title and document the testimony.');
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const { error } = await supabase.from('testimonies').insert({
        organization_id: organizationId,
        branch_id: expression.id,
        author_profile_id: profileId,
        title: title.trim(),
        testimony: story.trim(),
        occurred_on: occurredOn ? formatDateOnly(occurredOn) : null,
        share_in_service_consent: consent,
        status: 'submitted',
      });
      if (error) throw new Error(error.message || 'Unable to submit testimony.');
      setComposerOpen(false); setTitle(''); setStory(''); setOccurredOn(null); setConsent(false);
      setSuccessMsg('Your testimony has been documented privately for the Expression ministry team.');
      resource.refresh();
    } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Unable to submit testimony.'); }
    finally { setSaving(false); }
  };

  const respond = async (type: TestimonyResponse['response_type'] = 'message') => {
    if (!selected || !profileId || !canReview || !responseText.trim()) return;
    setSaving(true); setErrorMsg('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const { error } = await supabase.from('testimony_responses').insert({ testimony_id: selected.id, responder_profile_id: profileId, message: responseText.trim(), response_type: type });
      if (error) throw new Error(error.message || 'Unable to send testimony response.');
      if (canManage) {
        const patch: Record<string, unknown> = { status: 'responded', reviewed_by: profileId, reviewed_at: new Date().toISOString() };
        if (type === 'share_invitation') patch.invited_to_share = true;
        if (serviceNotes.trim()) patch.service_notes = serviceNotes.trim();
        const update = await supabase.from('testimonies').update(patch).eq('id', selected.id);
        if (update.error) throw new Error(update.error.message || 'Unable to update testimony workflow.');
      }
      setResponseText(''); setServiceNotes(''); setSuccessMsg(type === 'share_invitation' ? 'Invitation to share in service recorded and sent in this testimony thread.' : 'Response added to the testimony thread.');
      await resource.refresh();
    } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Unable to respond.'); }
    finally { setSaving(false); }
  };

  const changeStatus = async (status: Testimony['status']) => {
    if (!selected || !canManage || !profileId) return;
    setSaving(true); setErrorMsg('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const { error } = await supabase.from('testimonies').update({ status, reviewed_by: profileId, reviewed_at: new Date().toISOString(), service_notes: serviceNotes.trim() || selected.service_notes }).eq('id', selected.id);
      if (error) throw new Error(error.message || 'Unable to update testimony status.');
      setSelected({ ...selected, status, service_notes: serviceNotes.trim() || selected.service_notes });
      setSuccessMsg(`Testimony marked ${status}.`);
      resource.refresh();
    } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Unable to update testimony status.'); }
    finally { setSaving(false); }
  };

  const exportPdf = async (item: Testimony) => {
    try {
      setErrorMsg('');
      const html = pdfHtml(item, (resource.data?.responses ?? []).filter((response) => response.testimony_id === item.id), expression?.name ?? 'Expression');
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }
      const result = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: `Testimony: ${item.title}` });
      else setSuccessMsg('The testimony PDF was generated on this device.');
    } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Unable to export testimony PDF.'); }
  };

  if (mode !== 'authenticated' || !expression?.id) {
    return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Enter an Expression" message="Dedicated testimony documentation is private to Expression members." iconName="document-text-outline" /></View>;
  }

  const listToShow = managed && canReview ? reviewQueue : own;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: managed ? spacing.sm : insets.top + spacing.sm, paddingBottom: managed ? insets.bottom + spacing.xl : insets.bottom + 110 }]}
        refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
      >
        {!managed ? <ScreenHeader title="Testimonies" kicker="EXPRESSION" subtitle="Document a testimony privately and continue the conversation with the ministry team in the same record." showBack rightAction={<Button label="Document" onPress={() => setComposerOpen(true)} size="sm" />} /> : null}
        <View style={styles.body}>
          {successMsg ? <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{successMsg}</Text></View> : null}
          {errorMsg ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{errorMsg}</Text></View> : null}

          {!managed ? <View style={[styles.privacy, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}><Icon name="lock-closed-outline" size={19} color={colors.interactive} /><View style={styles.flex}><Text style={[styles.privacyTitle, { color: colors.text }]}>Private ministry documentation</Text><Text style={[styles.privacyText, { color: colors.textSecondary }]}>This testimony stays inside this Expression. It is visible to you and authorized testimony reviewers, and is not posted to General COT automatically.</Text></View></View> : null}

          <SectionHeader title={managed && canReview ? 'Review queue' : 'My documented testimonies'} badge={listToShow.length} subtitle={managed && canReview ? 'Respond, invite for physical sharing and record the ministry decision' : 'Open a testimony to view responses or export it as PDF'} actionLabel={!managed ? 'New' : undefined} onAction={!managed ? () => setComposerOpen(true) : undefined} />
          {resource.loading && !resource.data ? <Skeleton height={132} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : listToShow.length ? listToShow.map((item) => {
            const author = oneProfile(item.author);
            const responseCount = (resource.data?.responses ?? []).filter((response) => response.testimony_id === item.id).length;
            return (
              <Pressable key={item.id} onPress={() => { setSelected(item); setServiceNotes(item.service_notes || ''); }} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
                <View style={styles.cardTop}>{managed ? <Avatar url={author?.avatar_url ?? undefined} name={author?.display_name || 'Member'} size="sm" /> : <View style={[styles.docIcon, { backgroundColor: colors.primarySoft }]}><Icon name="document-text-outline" size={18} color={colors.interactive} /></View>}<View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{managed ? `${author?.display_name || 'Expression member'} · ` : ''}{new Date(item.created_at).toLocaleDateString()} · {responseCount} response{responseCount === 1 ? '' : 's'}</Text></View><Badge label={item.status.toUpperCase()} variant={item.status === 'approved' ? 'success' : item.status === 'declined' ? 'neutral' : 'active'} /></View>
                <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={4}>{item.testimony}</Text>
                <ScripturePreviewCard text={item.testimony} compact />
                <View style={styles.cardFlags}>{item.share_in_service_consent ? <Badge label="OPEN TO SHARE" variant="primary" /> : <Badge label="PRIVATE RECORD" variant="neutral" />}{item.invited_to_share ? <Badge label="INVITED TO SERVICE" variant="active" /> : null}</View>
              </Pressable>
            );
          }) : <EmptyState title={managed && canReview ? 'No testimonies waiting here' : 'No documented testimonies yet'} message={managed && canReview ? 'Submitted testimonies will appear here for the authorized ministry team.' : 'Document a testimony here when you want the Expression team to receive it privately.'} iconName="document-text-outline" actionLabel={!managed ? 'Document testimony' : undefined} onAction={!managed ? () => setComposerOpen(true) : undefined} />}
        </View>
      </ScrollView>

      <BottomSheet visible={composerOpen} onClose={() => { if (!saving) setComposerOpen(false); }} title="Document testimony" subtitle={`Private to ${expression.name} testimony workflow`} maxHeightPercent={94}>
        <View style={styles.form}>
          <InputField label="Title" value={title} onChangeText={setTitle} placeholder="What happened?" />
          <InputField label="Testimony" value={story} onChangeText={setStory} multiline numberOfLines={10} placeholder="Document the testimony in your own words…" />
          <DateTimeField label="When it happened (optional)" value={occurredOn} onChange={setOccurredOn} includeTime={false} minYear={1900} maxYear={new Date().getFullYear()} />
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>IF THE TEAM ASKS YOU TO SHARE PHYSICALLY</Text>
          <View style={styles.chips}><Chip label="I can consider sharing" selected={consent} onPress={() => setConsent(true)} /><Chip label="Keep documented only" selected={!consent} onPress={() => setConsent(false)} /></View>
          <Text style={[styles.helper, { color: colors.textMuted }]}>This is consent to be asked, not an automatic public publication. The ministry team can respond here before anything is shared.</Text>
          <Button label="Submit testimony" onPress={() => void submit()} loading={saving} size="lg" fullWidth />
        </View>
      </BottomSheet>

      <BottomSheet visible={Boolean(selected)} onClose={() => { if (!saving) { setSelected(null); setResponseText(''); } }} title={selected?.title || 'Testimony'} subtitle={selected ? `Status: ${selected.status}` : undefined} maxHeightPercent={96}>
        {selected ? <ScrollView contentContainerStyle={styles.detail} showsVerticalScrollIndicator={false}>
          <Text style={[styles.detailText, { color: colors.text }]}>{selected.testimony}</Text>
          <ScripturePreviewCard text={selected.testimony} compact />
          <View style={styles.cardFlags}><Badge label={selected.share_in_service_consent ? 'MEMBER OPEN TO SHARING' : 'DOCUMENTED ONLY'} variant={selected.share_in_service_consent ? 'primary' : 'neutral'} />{selected.invited_to_share ? <Badge label="INVITED TO SERVICE" variant="active" /> : null}</View>
          <Button label="Export PDF" onPress={() => void exportPdf(selected)} variant="outline" size="sm" />

          <SectionHeader title="Conversation" badge={selectedResponses.length} subtitle="Responses stay mapped to this testimony" />
          {selectedResponses.length ? selectedResponses.map((response) => { const responder = oneProfile(response.responder); return <View key={response.id} style={[styles.response, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><View style={styles.responseTop}><Avatar url={responder?.avatar_url ?? undefined} name={responder?.display_name || 'Expression team'} size="xs" /><View style={styles.flex}><Text style={[styles.responseName, { color: colors.text }]}>{responder?.display_name || 'Expression team'}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{new Date(response.created_at).toLocaleString()} · {response.response_type.replace('_', ' ')}</Text></View></View><Text style={[styles.responseText, { color: colors.textSecondary }]}>{response.message}</Text></View>; }) : <Text style={[styles.helper, { color: colors.textMuted }]}>No response has been added yet.</Text>}

          {canReview && selected.author_profile_id !== profileId ? <View style={[styles.staffBox, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>RESPOND TO THE DOCUMENTer</Text>
            <InputField label="Response" value={responseText} onChangeText={setResponseText} multiline numberOfLines={4} placeholder="Reply privately to this testimony…" />
            {canManage ? <InputField label="Service notes (optional)" value={serviceNotes} onChangeText={setServiceNotes} multiline numberOfLines={3} placeholder="Record follow-up or live-service arrangements…" /> : null}
            <View style={styles.actions}><Button label="Send response" onPress={() => void respond('message')} loading={saving} size="sm" /><Button label="Ask to share in service" onPress={() => void respond('share_invitation')} loading={saving} variant="outline" size="sm" /></View>
            {canManage ? <><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>WORKFLOW STATUS</Text><View style={styles.chips}><Chip label="Reviewing" selected={selected.status === 'reviewing'} onPress={() => void changeStatus('reviewing')} /><Chip label="Approved" selected={selected.status === 'approved'} onPress={() => void changeStatus('approved')} /><Chip label="Declined" selected={selected.status === 'declined'} onPress={() => void changeStatus('declined')} /><Chip label="Archived" selected={selected.status === 'archived'} onPress={() => void changeStatus('archived')} /></View></> : null}
          </View> : null}
        </ScrollView> : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg }, scroll: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, noticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' }, privacy: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, privacyTitle: { fontSize: 12, fontWeight: '800' }, privacyText: { fontSize: 11, lineHeight: 17, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, docIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, cardTitle: { fontSize: 14, lineHeight: 19, fontWeight: '900' }, meta: { fontSize: 10.5, lineHeight: 14, marginTop: 2 }, cardBody: { fontSize: 12, lineHeight: 18 }, cardFlags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  form: { gap: spacing.md }, fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, helper: { fontSize: 11, lineHeight: 17 },
  detail: { gap: spacing.md, paddingBottom: spacing.xl }, detailText: { fontSize: 14, lineHeight: 22 }, response: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }, responseTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, responseName: { fontSize: 11.5, fontWeight: '800' }, responseText: { fontSize: 12, lineHeight: 18 }, staffBox: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
