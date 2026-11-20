import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, BottomSheet, Button, Chip, EmptyState, Icon, InputField, ProgressiveFlow, type ProgressiveFlowStep, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useGeneralMinistryAccess } from './useGeneralMinistryAccess';

type RankingSettings = {
  id?: string;
  organization_id: string;
  branch_id: string | null;
  enabled: boolean;
  recency_weight: number | string;
  reaction_weight: number | string;
  comment_weight: number | string;
  followed_author_boost: number | string;
  continuation_boost: number | string;
  completed_penalty: number | string;
  repeat_author_penalty: number | string;
  freshness_half_life_hours: number | string;
  updated_at?: string;
};
type NumericField = 'recency_weight' | 'reaction_weight' | 'comment_weight' | 'followed_author_boost' | 'continuation_boost' | 'completed_penalty' | 'repeat_author_penalty' | 'freshness_half_life_hours';

const defaults: Record<NumericField, number> = { recency_weight: 6, reaction_weight: 1.25, comment_weight: 1.75, followed_author_boost: 3, continuation_boost: 2.5, completed_penalty: 1, repeat_author_penalty: 1.2, freshness_half_life_hours: 24 };
const engagementFields: Array<{ key: NumericField; title: string; help: string; min: number; max: number }> = [
  { key: 'recency_weight', title: 'Freshness', help: 'Give newer posts a stronger place near the top.', min: 0, max: 100 },
  { key: 'reaction_weight', title: 'Reactions', help: 'Give more visibility to posts that receive likes, prayers and other responses.', min: 0, max: 100 },
  { key: 'comment_weight', title: 'Comments', help: 'Give more visibility to posts that start meaningful conversations.', min: 0, max: 100 },
  { key: 'followed_author_boost', title: 'Followed people', help: 'Bring posts from people you follow a little closer to the top.', min: 0, max: 100 },
];
const continuityFields: Array<{ key: NumericField; title: string; help: string; min: number; max: number }> = [
  { key: 'continuation_boost', title: 'Continue watching', help: 'Help members return to a Reel or video they have not finished.', min: 0, max: 100 },
  { key: 'completed_penalty', title: 'Completed media penalty', help: 'Move videos and Reels a member has finished lower to make room for something new.', min: 0, max: 100 },
  { key: 'repeat_author_penalty', title: 'Creator diversity', help: 'Avoid showing too many posts from the same person in a row.', min: 0, max: 100 },
  { key: 'freshness_half_life_hours', title: 'Freshness half-life (hours)', help: 'Choose how long a new post keeps its freshness advantage. 24 hours gives it a stronger position for about a day.', min: 1, max: 8760 },
];
const allFields = [...engagementFields, ...continuityFields];
const STEPS: ProgressiveFlowStep[] = [
  { key: 'mode', label: 'Content order', hint: 'Choose recommended order or show the newest posts first.', icon: 'options-outline' },
  { key: 'relevance', label: 'Recent posts & activity', hint: 'Adjust how dates, likes and discussion affect what appears first.', icon: 'trending-up-outline' },
  { key: 'balance', label: 'Watching & variety', hint: 'Choose how unfinished videos and a mix of creators affect the order.', icon: 'git-compare-outline' },
  { key: 'review', label: 'Review changes', hint: 'Check how posts and videos will appear in General COT.', icon: 'checkmark-circle-outline' },
];

function numberValue(value: number | string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function GeneralFeedRankingExperience() {
  const insets = useSafeAreaInsets();
  const { auth, context } = useSession();
  const { colors } = useTheme();
  const access = useGeneralMinistryAccess();
  const organizationId = access.organizationId;
  const accessToken = auth?.session.accessToken ?? null;
  const [editorOpen, setEditorOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [values, setValues] = useState<Record<NumericField, string>>(() => Object.fromEntries(allFields.map((field) => [field.key, String(defaults[field.key])])) as Record<NumericField, string>);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const resource = useResource<RankingSettings | null>(
    `general:feed-ranking:${organizationId || 'none'}`,
    async () => {
      if (!organizationId || !access.canManageSettings) return null;
      const supabase = await getRuntimeSupabase(accessToken);
      const result = await supabase.from('feed_ranking_settings').select('*').eq('organization_id', organizationId).is('branch_id', null).maybeSingle();
      if (result.error) throw new Error(result.error.message || 'Unable to load Home content settings.');
      return result.data as RankingSettings | null;
    },
  );

  useEffect(() => {
    const source = resource.data;
    setEnabled(source?.enabled ?? true);
    setValues(Object.fromEntries(allFields.map((field) => [field.key, String(numberValue(source?.[field.key], defaults[field.key]))])) as Record<NumericField, string>);
  }, [resource.data?.id, resource.data?.updated_at]);

  const validation = useMemo(() => {
    for (const field of allFields) {
      const parsed = Number(values[field.key]);
      if (!Number.isFinite(parsed) || parsed < field.min || parsed > field.max) return `${field.title} must be between ${field.min} and ${field.max}.`;
    }
    return '';
  }, [values]);

  const openEditor = () => { setError(''); setFeedback(''); setStep(0); setEditorOpen(true); };
  const closeEditor = () => { if (!saving) { setEditorOpen(false); setError(''); } };
  const save = async () => {
    if (!organizationId || !access.canManageSettings || validation) return setError(validation || 'Home content settings are not available right now.');
    setSaving(true); setError(''); setFeedback('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const result = await supabase.from('feed_ranking_settings').upsert({ organization_id: organizationId, branch_id: null, enabled, ...Object.fromEntries(allFields.map((field) => [field.key, Number(values[field.key])])), updated_by: context?.profile?.id ?? null }, { onConflict: 'organization_id,branch_id' }).select('*').single();
      if (result.error) throw new Error(result.error.message || 'Unable to save Home content settings. Please try again.');
      setEditorOpen(false); setFeedback('General COT Home content order saved.'); await resource.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to save Home content settings. Please try again.'); }
    finally { setSaving(false); }
  };

  const renderFields = (fields: typeof engagementFields) => <View style={styles.fieldStack}>{fields.map((field) => <View key={field.key} style={[styles.fieldCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><InputField label={field.title} value={values[field.key]} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value.replace(',', '.') }))} keyboardType="decimal-pad" placeholder={String(defaults[field.key])} /><Text style={[styles.fieldHelp, { color: colors.textMuted }]}>{field.help}</Text></View>)}</View>;

  const renderStep = () => {
    if (step === 0) return <View style={styles.stepBody}><Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CONTENT ORDER</Text><View style={styles.chips}><Chip label="Recommended order" selected={enabled} onPress={() => setEnabled(true)} /><Chip label="Newest first" selected={!enabled} onPress={() => setEnabled(false)} /></View><View style={[styles.explainCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}><Icon name="sparkles-outline" size={19} color={colors.interactive} /><Text style={[styles.explainText, { color: colors.textSecondary }]}>{enabled ? 'Recommended order balances recent posts, member responses and followed people. Sermons, events and announcements appear in their own sections.' : 'Posts, Reels and videos will appear from newest to oldest. Sermons, events and announcements stay in their own sections.'}</Text></View></View>;
    if (step === 1) return renderFields(engagementFields);
    if (step === 2) return <View style={styles.stepBody}>{renderFields(continuityFields)}<View style={[styles.explainCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="shield-checkmark-outline" size={19} color={colors.interactive} /><Text style={[styles.explainText, { color: colors.textSecondary }]}>These choices only change the order of content members can already see. They do not change privacy or moderation rules.</Text></View></View>;
    return <View style={[styles.reviewCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><View style={styles.reviewTop}><View style={[styles.reviewIcon, { backgroundColor: colors.primarySoft }]}><Icon name="options-outline" size={20} color={colors.interactive} /></View><Badge label={enabled ? 'RECOMMENDED' : 'NEWEST FIRST'} variant={enabled ? 'primary' : 'neutral'} /></View><Text style={[styles.reviewTitle, { color: colors.text }]}>General COT Home</Text><Text style={[styles.reviewCopy, { color: colors.textSecondary }]}>{enabled ? 'Posts and videos are ordered using the choices below.' : 'Posts, Reels and videos appear from newest to oldest.'}</Text>{enabled ? <View style={styles.reviewGrid}>{allFields.map((field) => <View key={field.key} style={styles.reviewRow}><Text style={[styles.reviewLabel, { color: colors.textMuted }]}>{field.title}</Text><Text style={[styles.reviewValue, { color: colors.text }]}>{values[field.key]}</Text></View>)}</View> : null}</View>;
  };

  if (!access.accessReady) return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.md }]}><View style={styles.body}><Skeleton height={120} count={3} /></View></View>;
  if (!access.canManageSettings) return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Home content settings unavailable" message="Only COT leaders with permission can change what appears first on General COT Home." iconName="lock-closed-outline" /></View>;

  const configured = resource.data;
  return <View style={[styles.screen, { backgroundColor: colors.bg }]}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}><ScreenHeader title="Home content order" kicker="MINISTRY TOOLS" subtitle="Choose what appears first on General COT Home." showBack rightAction={<Button label="Edit settings" onPress={openEditor} size="sm" />} /><View style={styles.body}>{feedback ? <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{feedback}</Text></View> : null}{resource.loading && !resource.data ? <Skeleton height={150} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : <><View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}><View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}><Icon name="analytics-outline" size={24} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.heroKicker, { color: colors.interactive }]}>CURRENT ORDER</Text><Text style={[styles.heroTitle, { color: colors.text }]}>{configured?.enabled === false ? 'Newest first' : 'Recommended order'}</Text><Text style={[styles.heroCopy, { color: colors.textMuted }]}>{configured?.updated_at ? `Last updated ${new Date(configured.updated_at).toLocaleString()}` : 'General COT is using the default order until you save your own choices.'}</Text></View><Badge label={configured ? 'CUSTOM' : 'DEFAULT'} variant={configured ? 'primary' : 'neutral'} /></View><SectionHeader title="Current settings" subtitle="See how General COT Home is currently arranged." /><View style={styles.snapshotGrid}>{allFields.map((field) => <View key={field.key} style={[styles.snapshotCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.snapshotLabel, { color: colors.textMuted }]}>{field.title}</Text><Text style={[styles.snapshotValue, { color: colors.text }]}>{numberValue(configured?.[field.key], defaults[field.key])}</Text></View>)}</View><View style={[styles.boundaryCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="shield-checkmark-outline" size={18} color={colors.interactive} /><Text style={[styles.boundaryText, { color: colors.textSecondary }]}>Expressions use General COT’s settings by default. Their leaders can choose a different order for their own community.</Text></View></>}</View></ScrollView><BottomSheet visible={editorOpen} onClose={closeEditor} title="Edit Home content order" subtitle="General COT Home settings" maxHeightPercent={96}>{error ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></View> : null}<ProgressiveFlow steps={STEPS} currentStep={step} onStepChange={setStep} onBack={step === 0 ? closeEditor : () => setStep((value) => Math.max(0, value - 1))} onNext={() => { setError(''); if (validation) setError(validation); else setStep((value) => Math.min(STEPS.length - 1, value + 1)); }} onComplete={() => void save()} canContinue={!validation} busy={saving} completeLabel="Save changes">{renderStep()}</ProgressiveFlow></BottomSheet></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 }, notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, noticeText: { flex: 1, fontSize: 11.5, fontWeight: '700' },
  hero: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, heroIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, heroKicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 }, heroTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.4 }, heroCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, snapshotCard: { width: '48%', flexGrow: 1, minWidth: 145, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, snapshotLabel: { fontSize: 9.5, lineHeight: 14, fontWeight: '700' }, snapshotValue: { fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 3 }, boundaryCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, boundaryText: { flex: 1, fontSize: 10.5, lineHeight: 16 },
  stepBody: { gap: spacing.md }, sectionLabel: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, explainCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, explainText: { flex: 1, fontSize: 10.5, lineHeight: 16 }, fieldStack: { gap: spacing.sm }, fieldCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, fieldHelp: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  reviewCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md }, reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, reviewIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, reviewTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900' }, reviewCopy: { fontSize: 11.5, lineHeight: 18 }, reviewGrid: { gap: 7 }, reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }, reviewLabel: { flex: 1, fontSize: 10.5 }, reviewValue: { fontSize: 11.5, fontWeight: '900' },
});
