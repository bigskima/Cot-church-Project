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
  { key: 'recency_weight', title: 'Freshness', help: 'How strongly newer content should rise.', min: 0, max: 100 },
  { key: 'reaction_weight', title: 'Reactions', help: 'Boost from likes, prayer, celebration and other reactions.', min: 0, max: 100 },
  { key: 'comment_weight', title: 'Comments', help: 'Boost from meaningful visible discussion.', min: 0, max: 100 },
  { key: 'followed_author_boost', title: 'Followed people', help: 'Extra relevance when the viewer follows the author.', min: 0, max: 100 },
];
const continuityFields: Array<{ key: NumericField; title: string; help: string; min: number; max: number }> = [
  { key: 'continuation_boost', title: 'Continue watching', help: 'Resurface unfinished Reel or video playback.', min: 0, max: 100 },
  { key: 'completed_penalty', title: 'Completed media penalty', help: 'Reduce media a viewer already finished.', min: 0, max: 100 },
  { key: 'repeat_author_penalty', title: 'Creator diversity', help: 'Reduce consecutive dominance by one creator.', min: 0, max: 100 },
  { key: 'freshness_half_life_hours', title: 'Freshness half-life (hours)', help: 'How quickly freshness advantage decays.', min: 1, max: 8760 },
];
const allFields = [...engagementFields, ...continuityFields];
const STEPS: ProgressiveFlowStep[] = [
  { key: 'mode', label: 'Mode', hint: 'Choose ranked discovery or a recent-only stream.', icon: 'options-outline' },
  { key: 'relevance', label: 'Relevance', hint: 'Tune freshness, engagement and relationship signals.', icon: 'trending-up-outline' },
  { key: 'balance', label: 'Balance', hint: 'Tune continuation, completion and creator diversity.', icon: 'git-compare-outline' },
  { key: 'review', label: 'Review', hint: 'Confirm the church-wide Home ranking policy.', icon: 'checkmark-circle-outline' },
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
      if (result.error) throw new Error(result.error.message || 'Unable to load Home ranking controls.');
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
    if (!organizationId || !access.canManageSettings || validation) return setError(validation || 'Home ranking management is unavailable.');
    setSaving(true); setError(''); setFeedback('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const result = await supabase.from('feed_ranking_settings').upsert({ organization_id: organizationId, branch_id: null, enabled, ...Object.fromEntries(allFields.map((field) => [field.key, Number(values[field.key])])), updated_by: context?.profile?.id ?? null }, { onConflict: 'organization_id,branch_id' }).select('*').single();
      if (result.error) throw new Error(result.error.message || 'Unable to save Home ranking controls.');
      setEditorOpen(false); setFeedback('General COT Home ranking controls saved.'); await resource.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to save Home ranking controls.'); }
    finally { setSaving(false); }
  };

  const renderFields = (fields: typeof engagementFields) => <View style={styles.fieldStack}>{fields.map((field) => <View key={field.key} style={[styles.fieldCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><InputField label={field.title} value={values[field.key]} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value.replace(',', '.') }))} keyboardType="decimal-pad" placeholder={String(defaults[field.key])} /><Text style={[styles.fieldHelp, { color: colors.textMuted }]}>{field.help}</Text></View>)}</View>;

  const renderStep = () => {
    if (step === 0) return <View style={styles.stepBody}><Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>HOME STREAM MODE</Text><View style={styles.chips}><Chip label="Ranked discovery" selected={enabled} onPress={() => setEnabled(true)} /><Chip label="Recent only" selected={!enabled} onPress={() => setEnabled(false)} /></View><View style={[styles.explainCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}><Icon name="sparkles-outline" size={19} color={colors.interactive} /><Text style={[styles.explainText, { color: colors.textSecondary }]}>{enabled ? 'The ordinary post, Reel and video stream uses transparent weights. Sermons, events and announcements remain separate discovery layers.' : 'The layered Home remains, but ordinary community media is ordered by recency rather than weighted relevance.'}</Text></View></View>;
    if (step === 1) return renderFields(engagementFields);
    if (step === 2) return <View style={styles.stepBody}>{renderFields(continuityFields)}<View style={[styles.explainCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="shield-checkmark-outline" size={19} color={colors.interactive} /><Text style={[styles.explainText, { color: colors.textSecondary }]}>These weights only order content the viewer is already allowed to see. They never bypass visibility, membership or moderation.</Text></View></View>;
    return <View style={[styles.reviewCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><View style={styles.reviewTop}><View style={[styles.reviewIcon, { backgroundColor: colors.primarySoft }]}><Icon name="options-outline" size={20} color={colors.interactive} /></View><Badge label={enabled ? 'RANKED' : 'RECENT ONLY'} variant={enabled ? 'primary' : 'neutral'} /></View><Text style={[styles.reviewTitle, { color: colors.text }]}>General COT Home</Text><Text style={[styles.reviewCopy, { color: colors.textSecondary }]}>{enabled ? 'Explainable relevance ranking is enabled with the signal values below.' : 'Ordinary stream items will use recency ordering.'}</Text>{enabled ? <View style={styles.reviewGrid}>{allFields.map((field) => <View key={field.key} style={styles.reviewRow}><Text style={[styles.reviewLabel, { color: colors.textMuted }]}>{field.title}</Text><Text style={[styles.reviewValue, { color: colors.text }]}>{values[field.key]}</Text></View>)}</View> : null}</View>;
  };

  if (!access.accessReady) return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.md }]}><View style={styles.body}><Skeleton height={120} count={3} /></View></View>;
  if (!access.canManageSettings) return <View style={[styles.screen, styles.center, { backgroundColor: colors.bg }]}><EmptyState title="Home controls unavailable" message="Only authorized General COT administrators can tune feed ranking." iconName="lock-closed-outline" /></View>;

  const configured = resource.data;
  return <View style={[styles.screen, { backgroundColor: colors.bg }]}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}><ScreenHeader title="Home feed controls" kicker="MINISTRY · SETTINGS" subtitle="Tune transparent General COT discovery defaults without redeploying the app." showBack rightAction={<Button label="Edit controls" onPress={openEditor} size="sm" />} /><View style={styles.body}>{feedback ? <View style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{feedback}</Text></View> : null}{resource.loading && !resource.data ? <Skeleton height={150} count={3} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : <><View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}><View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}><Icon name="analytics-outline" size={24} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.heroKicker, { color: colors.interactive }]}>CURRENT HOME POLICY</Text><Text style={[styles.heroTitle, { color: colors.text }]}>{configured?.enabled === false ? 'Recent-only stream' : 'Ranked discovery'}</Text><Text style={[styles.heroCopy, { color: colors.textMuted }]}>{configured?.updated_at ? `Last updated ${new Date(configured.updated_at).toLocaleString()}` : 'Using platform defaults until you save an explicit policy.'}</Text></View><Badge label={configured ? 'CONFIGURED' : 'DEFAULTS'} variant={configured ? 'primary' : 'neutral'} /></View><SectionHeader title="Current signals" subtitle="A readable snapshot of the General Home policy" /><View style={styles.snapshotGrid}>{allFields.map((field) => <View key={field.key} style={[styles.snapshotCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}><Text style={[styles.snapshotLabel, { color: colors.textMuted }]}>{field.title}</Text><Text style={[styles.snapshotValue, { color: colors.text }]}>{numberValue(configured?.[field.key], defaults[field.key])}</Text></View>)}</View><View style={[styles.boundaryCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="shield-checkmark-outline" size={18} color={colors.interactive} /><Text style={[styles.boundaryText, { color: colors.textSecondary }]}>Home ranking is explainable and permission-safe. Expressions with no override can inherit these defaults without duplicating configuration.</Text></View></>}</View></ScrollView><BottomSheet visible={editorOpen} onClose={closeEditor} title="Edit Home controls" subtitle="General COT · Ranking policy" maxHeightPercent={96}>{error ? <View style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></View> : null}<ProgressiveFlow steps={STEPS} currentStep={step} onStepChange={setStep} onBack={step === 0 ? closeEditor : () => setStep((value) => Math.max(0, value - 1))} onNext={() => { setError(''); if (validation) setError(validation); else setStep((value) => Math.min(STEPS.length - 1, value + 1)); }} onComplete={() => void save()} canContinue={!validation} busy={saving} completeLabel="Save Home policy">{renderStep()}</ProgressiveFlow></BottomSheet></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.md, gap: spacing.lg }, flex: { flex: 1, minWidth: 0 }, notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, noticeText: { flex: 1, fontSize: 11.5, fontWeight: '700' },
  hero: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, heroIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, heroKicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 }, heroTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.4 }, heroCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, snapshotCard: { width: '48%', flexGrow: 1, minWidth: 145, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, snapshotLabel: { fontSize: 9.5, lineHeight: 14, fontWeight: '700' }, snapshotValue: { fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 3 }, boundaryCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, boundaryText: { flex: 1, fontSize: 10.5, lineHeight: 16 },
  stepBody: { gap: spacing.md }, sectionLabel: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, explainCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, explainText: { flex: 1, fontSize: 10.5, lineHeight: 16 }, fieldStack: { gap: spacing.sm }, fieldCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, fieldHelp: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  reviewCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md }, reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, reviewIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, reviewTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900' }, reviewCopy: { fontSize: 11.5, lineHeight: 18 }, reviewGrid: { gap: 7 }, reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }, reviewLabel: { flex: 1, fontSize: 10.5 }, reviewValue: { fontSize: 11.5, fontWeight: '900' },
});
