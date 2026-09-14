import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Icon,
  InputField,
  ResourceError,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Scope = 'general' | 'expression';
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
type RankingResource = {
  scoped: RankingSettings | null;
  organization: RankingSettings | null;
};

type NumericField =
  | 'recency_weight'
  | 'reaction_weight'
  | 'comment_weight'
  | 'followed_author_boost'
  | 'continuation_boost'
  | 'completed_penalty'
  | 'repeat_author_penalty'
  | 'freshness_half_life_hours';

const defaults: Record<NumericField, number> = {
  recency_weight: 6,
  reaction_weight: 1.25,
  comment_weight: 1.75,
  followed_author_boost: 3,
  continuation_boost: 2.5,
  completed_penalty: 1,
  repeat_author_penalty: 1.2,
  freshness_half_life_hours: 24,
};

const fields: Array<{ key: NumericField; title: string; help: string; min: number; max: number }> = [
  { key: 'recency_weight', title: 'Freshness', help: 'How much newer content should rise before engagement and relationship signals are considered.', min: 0, max: 100 },
  { key: 'reaction_weight', title: 'Reactions', help: 'Boost from likes, prayer, celebration and other reactions. Popularity uses a logarithmic curve to prevent runaway dominance.', min: 0, max: 100 },
  { key: 'comment_weight', title: 'Comments', help: 'Boost from visible discussion. This is also logarithmic so one viral thread cannot own the feed forever.', min: 0, max: 100 },
  { key: 'followed_author_boost', title: 'Followed people', help: 'Extra relevance when the signed-in viewer follows the content author.', min: 0, max: 100 },
  { key: 'continuation_boost', title: 'Continue watching', help: 'Extra relevance for unfinished Reel/video playback so people can continue what they started.', min: 0, max: 100 },
  { key: 'completed_penalty', title: 'Completed content penalty', help: 'Reduces media already completed by the viewer so Home does not repeatedly resurface it.', min: 0, max: 100 },
  { key: 'repeat_author_penalty', title: 'Repeat-author diversity', help: 'Reduces consecutive dominance by the same creator while keeping strong content eligible.', min: 0, max: 100 },
  { key: 'freshness_half_life_hours', title: 'Freshness half-life (hours)', help: 'How quickly the freshness advantage decays. 24 means a one-day-old item retains roughly half its freshness signal.', min: 1, max: 8760 },
];

function numberValue(value: number | string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function FeedRankingSettingsExperience({ scope, expressionId }: { scope: Scope; expressionId?: string }) {
  const { auth, context, hasCapability, hasOrganizationCapability, mode } = useSession();
  const { colors } = useTheme();
  const organizationId = scope === 'expression'
    ? context?.expressions?.find((item) => item.id === expressionId)?.organizationId ?? context?.organization?.id ?? ''
    : context?.organization?.id ?? context?.organizations?.[0]?.id ?? '';
  const branchId = scope === 'expression' ? expressionId ?? null : null;
  const accessToken = auth?.session.accessToken ?? null;
  const canManage = mode === 'authenticated' && (scope === 'expression' ? hasCapability('feed.ranking.manage') : hasOrganizationCapability('feed.ranking.manage'));

  const resource = useResource<RankingResource>(
    `feed-ranking:${scope}:${organizationId || 'none'}:${branchId ?? 'general'}:${mode}`,
    async () => {
      if (!organizationId || !canManage) return { scoped: null, organization: null };
      const supabase = await getRuntimeSupabase(accessToken);
      const [scopedResult, organizationResult] = await Promise.all([
        supabase
          .from('feed_ranking_settings')
          .select('*')
          .eq('organization_id', organizationId)
          .is('branch_id', branchId)
          .maybeSingle(),
        branchId
          ? supabase.from('feed_ranking_settings').select('*').eq('organization_id', organizationId).is('branch_id', null).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (scopedResult.error) throw new Error(scopedResult.error.message || 'Unable to load feed ranking settings.');
      if (organizationResult.error) throw new Error(organizationResult.error.message || 'Unable to load General COT ranking defaults.');
      return {
        scoped: scopedResult.data as RankingSettings | null,
        organization: organizationResult.data as RankingSettings | null,
      };
    },
  );

  const inherited = scope === 'expression' && !resource.data?.scoped;
  const effective = resource.data?.scoped ?? resource.data?.organization;
  const [enabled, setEnabled] = useState(true);
  const [values, setValues] = useState<Record<NumericField, string>>(() => Object.fromEntries(fields.map((item) => [item.key, String(defaults[item.key])])) as Record<NumericField, string>);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const source = effective;
    setEnabled(source?.enabled ?? true);
    setValues(Object.fromEntries(fields.map((item) => [item.key, String(numberValue(source?.[item.key], defaults[item.key]))])) as Record<NumericField, string>);
  }, [effective?.id, effective?.updated_at, inherited]);

  const validation = useMemo(() => {
    for (const field of fields) {
      const parsed = Number(values[field.key]);
      if (!Number.isFinite(parsed) || parsed < field.min || parsed > field.max) {
        return `${field.title} must be between ${field.min} and ${field.max}.`;
      }
    }
    return '';
  }, [values]);

  const save = async () => {
    if (!organizationId || !canManage || validation) return setError(validation || 'Ranking management is unavailable.');
    setSaving(true); setError(''); setFeedback('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const record = {
        organization_id: organizationId,
        branch_id: branchId,
        enabled,
        ...Object.fromEntries(fields.map((item) => [item.key, Number(values[item.key])])),
        updated_by: context?.profile?.id ?? null,
      };
      const result = await supabase
        .from('feed_ranking_settings')
        .upsert(record, { onConflict: 'organization_id,branch_id' })
        .select('*')
        .single();
      if (result.error) throw new Error(result.error.message || 'Unable to save ranking settings.');
      setFeedback(scope === 'expression' ? 'Expression feed ranking override saved.' : 'General COT feed ranking settings saved.');
      resource.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save feed ranking settings.');
    } finally { setSaving(false); }
  };

  const restoreInheritance = async () => {
    if (scope !== 'expression' || !organizationId || !branchId || !resource.data?.scoped) return;
    setSaving(true); setError(''); setFeedback('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const result = await supabase.from('feed_ranking_settings').delete().eq('organization_id', organizationId).eq('branch_id', branchId);
      if (result.error) throw new Error(result.error.message || 'Unable to restore General COT defaults.');
      setFeedback('This Expression now inherits the General COT ranking weights.');
      resource.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to restore inherited ranking settings.');
    } finally { setSaving(false); }
  };

  if (!canManage) {
    return <EmptyState title="Feed ranking controls unavailable" message="Only authorized COT or Expression administrators can tune feed ranking." iconName="lock-closed-outline" />;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {feedback ? <Pressable onPress={() => setFeedback('')} style={[styles.notice, { backgroundColor: colors.successSoft, borderColor: colors.success }]}><Icon name="checkmark-circle-outline" size={18} color={colors.success} /><Text style={[styles.noticeText, { color: colors.success }]}>{feedback}</Text></Pressable> : null}
      {error ? <Pressable onPress={() => setError('')} style={[styles.notice, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={18} color={colors.live} /><Text style={[styles.noticeText, { color: colors.live }]}>{error}</Text></Pressable> : null}

      <View style={[styles.infoCard, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
        <Icon name="analytics-outline" size={21} color={colors.interactive} />
        <View style={styles.flex}>
          <View style={styles.infoTop}><Text style={[styles.infoTitle, { color: colors.text }]}>Explainable ranking</Text>{inherited ? <Badge label="INHERITING GENERAL" variant="neutral" /> : <Badge label="CUSTOM" variant="primary" />}</View>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>COT does not use a hidden AI model here. Home combines freshness, real reactions/comments, relationship signals, continuation and creator diversity. Specialty sections such as sermons, events and announcements remain layered separately.</Text>
        </View>
      </View>

      {resource.loading && !resource.data ? <Skeleton height={92} count={5} /> : resource.error && !resource.data ? <ResourceError message={resource.error} retry={resource.refresh} /> : (
        <>
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <SectionHeader title="Ranking mode" subtitle={scope === 'expression' ? 'Expression-specific override or inherited General COT weights' : 'Church-wide default weights'} />
            <View style={styles.chips}>
              <Chip label="Ranked" selected={enabled} onPress={() => setEnabled(true)} />
              <Chip label="Recent only" selected={!enabled} onPress={() => setEnabled(false)} />
            </View>
            <Text style={[styles.helper, { color: colors.textMuted }]}>Turning ranking off keeps the layered Home layout but orders the ordinary post/Reel/video stream by recency.</Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <SectionHeader title="Signals & weights" subtitle="Higher values make a signal matter more. Changes affect Home ordering without an app deployment." />
            {fields.map((field) => (
              <View key={field.key} style={styles.fieldBlock}>
                <InputField
                  label={field.title}
                  value={values[field.key]}
                  onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value.replace(',', '.') }))}
                  keyboardType="decimal-pad"
                  placeholder={String(defaults[field.key])}
                />
                <Text style={[styles.helper, { color: colors.textMuted }]}>{field.help}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.boundary, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <Icon name="shield-checkmark-outline" size={18} color={colors.interactive} />
            <Text style={[styles.boundaryText, { color: colors.textSecondary }]}>Ranking never bypasses visibility, membership or moderation rules. It only orders content the viewer is already allowed to see.</Text>
          </View>

          <View style={styles.actions}>
            {scope === 'expression' && resource.data?.scoped ? <Button label="Use General defaults" onPress={() => void restoreInheritance()} variant="outline" disabled={saving} /> : null}
            <Button label={scope === 'expression' && inherited ? 'Create Expression override' : 'Save ranking'} onPress={() => void save()} loading={saving} disabled={Boolean(validation)} />
          </View>
          {validation ? <Text style={[styles.validation, { color: colors.live }]}>{validation}</Text> : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 100, gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  notice: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  infoCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  infoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  infoTitle: { fontSize: 15, fontWeight: '900' },
  infoText: { fontSize: 11.5, lineHeight: 18, marginTop: 4 },
  sectionCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fieldBlock: { gap: 4 },
  helper: { fontSize: 10.5, lineHeight: 16 },
  boundary: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  boundaryText: { flex: 1, fontSize: 11, lineHeight: 17 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  validation: { fontSize: 11, lineHeight: 16, textAlign: 'right', fontWeight: '700' },
});
