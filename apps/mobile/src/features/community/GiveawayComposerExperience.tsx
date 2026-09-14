import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, EmptyState, Icon, InputField, ScreenHeader, Skeleton } from '@/components';
import { DateTimeField } from '@/components/DateTimeField';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { getRuntimeSupabase } from '@/services/runtime-supabase';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Scope = 'general' | 'expression';

export function GiveawayComposerExperience({ scope, expressionId }: { scope: Scope; expressionId?: string }) {
  const { auth, context, mode, accessReady } = useSession();
  const { colors } = useTheme();
  const membership = scope === 'expression'
    ? context?.expressions?.find((item) => item.id === expressionId && item.status === 'active')
    : undefined;
  const organizationId = scope === 'expression'
    ? membership?.organizationId ?? ''
    : context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';
  const branchId = scope === 'expression' ? expressionId ?? null : null;
  const accessToken = auth?.session.accessToken ?? null;
  const expressionName = membership?.name ?? 'this Expression';
  const allowed = mode === 'authenticated' && Boolean(organizationId) && (scope === 'general' || Boolean(membership));
  const backDestination = scope === 'general' ? '/general/participate' : `/expressions/${expressionId}/participate`;

  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [prize, setPrize] = useState('');
  const [description, setDescription] = useState('');
  const [winnerCount, setWinnerCount] = useState('1');
  const [closesAt, setClosesAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);

  const continueToSettings = () => {
    setError('');
    if (!title.trim()) return setError('Add a giveaway title before continuing.');
    if (!prize.trim()) return setError('Describe exactly what the winner will receive.');
    setStep(2);
  };

  const publish = async () => {
    if (!allowed || !organizationId) return;
    const winners = Number(winnerCount);
    if (!Number.isInteger(winners) || winners < 1 || winners > 100) {
      setError('Winner count must be between 1 and 100.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const supabase = await getRuntimeSupabase(accessToken);
      const result = await supabase.rpc('create_community_giveaway', {
        target_organization_id: organizationId,
        target_branch_id: branchId,
        giveaway_title: title.trim(),
        giveaway_description: description.trim(),
        prize: prize.trim(),
        number_of_winners: winners,
        open_at: null,
        close_at: closesAt?.toISOString() ?? null,
        giveaway_visibility: scope === 'general' ? 'public' : 'members',
      });
      if (result.error) throw new Error(result.error.message);
      setPublished(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to open this giveaway.');
    } finally {
      setSaving(false);
    }
  };

  if (!accessReady) {
    return <View style={[styles.screen, { backgroundColor: colors.bg }]}><View style={styles.pad}><Skeleton height={130} count={3} borderRadius={radius.xl} /></View></View>;
  }

  if (!allowed) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }]}>
        <View style={styles.pad}>
          <EmptyState
            title={mode === 'authenticated' ? 'Giveaway hosting is unavailable here' : 'Sign in to host a giveaway'}
            message={mode === 'authenticated' ? 'Join this Expression before hosting a giveaway inside it.' : 'Giveaways are available to signed-in COT members.'}
            iconName={mode === 'authenticated' ? 'lock-closed-outline' : 'gift-outline'}
            actionLabel={mode === 'authenticated' ? 'Back to participation' : 'Sign in'}
            onAction={() => mode === 'authenticated'
              ? router.replace(backDestination as any)
              : router.push({ pathname: '/(auth)/login', params: { returnTo: `${backDestination}?tab=giveaways&compose=giveaway` } } as any)}
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
            <Text style={[styles.successTitle, { color: colors.text }]}>Giveaway opened</Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>Members can now enter. After the closing time, the host can draw eligible winners and record prize fulfillment.</Text>
            <Button label="View giveaways" onPress={() => router.replace({ pathname: backDestination as any, params: { tab: 'giveaways' } } as any)} fullWidth size="lg" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Host giveaway"
          kicker={scope === 'general' ? 'GENERAL COT' : 'EXPRESSION'}
          subtitle={scope === 'general' ? 'Open a public member giveaway in General COT.' : `Host a member giveaway inside ${expressionName}.`}
          showBack
        />

        <View style={styles.progressRow}>
          <View style={[styles.progressStep, { backgroundColor: colors.interactive }]}><Text style={[styles.progressNumber, { color: colors.textInverse }]}>1</Text></View>
          <View style={[styles.progressLine, { backgroundColor: step === 2 ? colors.interactive : colors.borderSubtle }]} />
          <View style={[styles.progressStep, { backgroundColor: step === 2 ? colors.interactive : colors.bgSecondary, borderColor: colors.borderSubtle }]}><Text style={[styles.progressNumber, { color: step === 2 ? colors.textInverse : colors.textMuted }]}>2</Text></View>
          <View style={styles.progressCopy}><Text style={[styles.progressTitle, { color: colors.text }]}>{step === 1 ? 'Prize & message' : 'Closing & winners'}</Text><Text style={[styles.progressHint, { color: colors.textMuted }]}>Step {step} of 2</Text></View>
        </View>

        {error ? <Pressable onPress={() => setError('')} style={[styles.errorCard, { backgroundColor: colors.liveSoft, borderColor: colors.live }]}><Icon name="alert-circle-outline" size={17} color={colors.live} /><Text style={[styles.errorText, { color: colors.live }]}>{error}</Text><Icon name="close" size={14} color={colors.live} /></Pressable> : null}

        {step === 1 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <InputField label="Giveaway title" value={title} onChangeText={setTitle} placeholder="Community appreciation giveaway" />
            <InputField label="Prize" value={prize} onChangeText={setPrize} multiline numberOfLines={3} placeholder="Describe exactly what the winner receives." />
            <InputField label="Description (optional)" value={description} onChangeText={setDescription} multiline numberOfLines={3} placeholder="Rules or a short note for participants." />
            <View style={[styles.infoCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="shield-checkmark-outline" size={17} color={colors.interactive} /><Text style={[styles.infoText, { color: colors.textSecondary }]}>No purchase or payment is required to enter. COT records entrants, the random draw and selected winners.</Text></View>
            <Button label="Continue" onPress={continueToSettings} icon={<Icon name="arrow-forward" size={17} color={colors.textInverse} />} fullWidth size="lg" />
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.reviewPrize, { backgroundColor: colors.primarySoft }]}><Text style={[styles.reviewKicker, { color: colors.interactive }]}>PRIZE</Text><Text style={[styles.reviewTitle, { color: colors.text }]}>{prize}</Text></View>
            <InputField label="Number of winners" value={winnerCount} onChangeText={(value) => setWinnerCount(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="1" />
            <DateTimeField label="Closing date (optional)" value={closesAt} onChange={setClosesAt} helperText="After this time, the host can draw winners. Leave empty if you want to close and draw later." />
            <View style={[styles.infoCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="gift-outline" size={17} color={colors.interactive} /><Text style={[styles.infoText, { color: colors.textSecondary }]}>Prize delivery remains with the host. After winners are drawn, mark each prize as fulfilled so the record is clear.</Text></View>
            <View style={styles.footerActions}><Button label="Back" onPress={() => { setError(''); setStep(1); }} variant="outline" size="lg" /><Button label="Open giveaway" onPress={() => void publish()} loading={saving} size="lg" style={styles.publishButton} /></View>
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
  errorCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  infoCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  infoText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  reviewPrize: { borderRadius: radius.lg, padding: spacing.md, gap: 3 },
  reviewKicker: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.75 },
  reviewTitle: { fontSize: 16, lineHeight: 22, fontWeight: '900' },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  publishButton: { flex: 1 },
  successWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  successCard: { width: '100%', maxWidth: 520, alignSelf: 'center', borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  successIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', textAlign: 'center' },
  successText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
