import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Chip, EmptyState, Icon, InputField, ScreenHeader, Skeleton } from '@/components';
import { DateTimeField } from '@/components/DateTimeField';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Scope = 'general' | 'expression';

export function PollComposerExperience({ scope, expressionId }: { scope: Scope; expressionId?: string }) {
  const { auth, context, mode, accessReady, hasCapability, hasOrganizationCapability } = useSession();
  const { colors } = useTheme();
  const membership = scope === 'expression'
    ? context?.expressions?.find((item) => item.id === expressionId && item.status === 'active')
    : undefined;
  const organizationId = scope === 'expression'
    ? membership?.organizationId ?? context?.organization?.id ?? ''
    : context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const branchId = scope === 'expression' ? expressionId ?? null : null;
  const accessToken = auth?.session.accessToken ?? null;
  const activeExpressionName = context?.expression?.id === expressionId ? context?.expression?.name : undefined;
  const expressionName = membership?.name ?? activeExpressionName ?? 'this Expression';
  const allowed = mode === 'authenticated' && (scope === 'general'
    ? hasOrganizationCapability('polls.manage')
    : Boolean(membership) && hasCapability('polls.manage'));

  const [step, setStep] = useState<1 | 2>(1);
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [closesAt, setClosesAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);

  const readyOptions = useMemo(() => options.map((item) => item.trim()).filter(Boolean), [options]);
  const backDestination = scope === 'general' ? '/general/participate' : `/expressions/${expressionId}/participate`;

  const continueToSettings = () => {
    setError('');
    if (!question.trim()) return setError('Enter the poll question before continuing.');
    if (readyOptions.length < 2) return setError('Add at least two poll options before continuing.');
    setStep(2);
  };

  const publish = async () => {
    if (!allowed || !organizationId) return;
    setSaving(true);
    setError('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const result = await supabase.rpc('create_community_poll', {
        target_organization_id: organizationId,
        target_branch_id: branchId,
        poll_question: question.trim(),
        poll_description: description.trim(),
        option_labels: readyOptions,
        allow_multiple: allowMultiple,
        close_at: closesAt?.toISOString() ?? null,
        poll_visibility: scope === 'general' ? 'public' : 'members',
      });
      if (result.error) throw new Error(result.error.message);
      setPublished(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to publish this poll.');
    } finally {
      setSaving(false);
    }
  };

  if (!accessReady) {
    return <View style={[styles.screen, { backgroundColor: colors.bg }]}><View style={styles.pad}><Skeleton height={130} count={3} borderRadius={radius.xl} /></View></View>;
  }

  if (mode !== 'authenticated' || !allowed) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }]}>
        <View style={styles.pad}>
          <EmptyState
            title="Poll publishing is restricted"
            message="Official polls can be created only by an authorized ministry role in this space."
            iconName="lock-closed-outline"
            actionLabel="Back to participation"
            onAction={() => router.replace(backDestination as any)}
          />
        </View>
      </View>
    );
  }

  if (published) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }]}>
        <View style={styles.successWrap}>
          <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.successIcon, { backgroundColor: colors.successSoft }]}><Icon name="checkmark-circle" size={30} color={colors.success} /></View>
            <Text style={[styles.successTitle, { color: colors.text }]}>Poll published</Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>The community can now vote from the participation area.</Text>
            <Button label="Back to participation" onPress={() => router.replace(backDestination as any)} fullWidth size="lg" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Create poll"
          kicker={scope === 'general' ? 'GENERAL COT' : 'EXPRESSION'}
          subtitle={scope === 'general' ? 'Publish an official poll to General COT.' : `Publish an official poll inside ${expressionName}.`}
          showBack
        />

        <View style={styles.progressRow}>
          <View style={[styles.progressStep, { backgroundColor: colors.interactive }]}><Text style={[styles.progressNumber, { color: colors.textInverse }]}>1</Text></View>
          <View style={[styles.progressLine, { backgroundColor: step === 2 ? colors.interactive : colors.borderSubtle }]} />
          <View style={[styles.progressStep, { backgroundColor: step === 2 ? colors.interactive : colors.bgSecondary, borderColor: colors.borderSubtle }]}><Text style={[styles.progressNumber, { color: step === 2 ? colors.textInverse : colors.textMuted }]}>2</Text></View>
          <View style={styles.progressCopy}><Text style={[styles.progressTitle, { color: colors.text }]}>{step === 1 ? 'Question & choices' : 'Voting settings'}</Text><Text style={[styles.progressHint, { color: colors.textMuted }]}>Step {step} of 2</Text></View>
        </View>

        {error ? <Pressable onPress={() => setError('')} style={[styles.errorCard, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={17} color={colors.live} /><Text style={[styles.errorText, { color: colors.live }]}>{error}</Text><Icon name="close" size={14} color={colors.live} /></Pressable> : null}

        {step === 1 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <InputField label="Question" value={question} onChangeText={setQuestion} placeholder="What should the community decide or respond to?" />
            <InputField label="Context (optional)" value={description} onChangeText={setDescription} multiline numberOfLines={3} placeholder="Add helpful context…" />
            <View style={styles.sectionLabelRow}><Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>OPTIONS</Text><Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{readyOptions.length} ready</Text></View>
            {options.map((option, index) => <InputField key={index} label={`Option ${index + 1}`} value={option} onChangeText={(value) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder={`Choice ${index + 1}`} />)}
            <View style={styles.inlineActions}>
              {options.length < 12 ? <Button label="Add option" onPress={() => setOptions((current) => [...current, ''])} variant="outline" size="sm" /> : null}
              {options.length > 2 ? <Button label="Remove last" onPress={() => setOptions((current) => current.slice(0, -1))} variant="outline" size="sm" /> : null}
            </View>
            <Button label="Continue" onPress={continueToSettings} icon={<Icon name="arrow-forward" size={17} color={colors.textInverse} />} fullWidth size="lg" />
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>{question}</Text>
            <Text style={[styles.reviewHint, { color: colors.textSecondary }]}>{readyOptions.length} options · choose how voting should work.</Text>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>VOTING MODE</Text>
            <View style={styles.inlineActions}><Chip label="One choice" selected={!allowMultiple} onPress={() => setAllowMultiple(false)} /><Chip label="Multiple choices" selected={allowMultiple} onPress={() => setAllowMultiple(true)} /></View>
            <DateTimeField label="Closing date (optional)" value={closesAt} onChange={setClosesAt} helperText="Leave empty if the poll should remain open until a leader closes it later." />
            <View style={styles.footerActions}><Button label="Back" onPress={() => { setError(''); setStep(1); }} variant="outline" size="lg" /><Button label="Publish poll" onPress={() => void publish()} loading={saving} size="lg" style={styles.publishButton} /></View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  pad: { flex: 1, padding: spacing.md },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs },
  progressStep: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progressNumber: { fontSize: 12, lineHeight: 15, fontWeight: '900' },
  progressLine: { width: 34, height: 2, borderRadius: 1 },
  progressCopy: { marginLeft: spacing.xs, flex: 1 },
  progressTitle: { fontSize: 12.5, lineHeight: 17, fontWeight: '800' },
  progressHint: { fontSize: 10.5, lineHeight: 14, marginTop: 1 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  sectionLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  sectionLabel: { fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.75 },
  sectionMeta: { fontSize: 10.5, lineHeight: 14, fontWeight: '700' },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  errorCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  reviewTitle: { fontSize: 20, lineHeight: 26, fontWeight: '900', letterSpacing: -0.35 },
  reviewHint: { fontSize: 12.5, lineHeight: 18 },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  publishButton: { flex: 1 },
  successWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  successCard: { width: '100%', maxWidth: 520, alignSelf: 'center', borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  successIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', textAlign: 'center' },
  successText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
