import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, Button, Icon } from '@/components';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

type OnboardingPayload = {
  active: boolean;
  experience: {
    id: string;
    version: string;
    policyVersion: string;
    title: string;
    subtitle: string;
    policyTitle: string;
    policySummary: string;
    policyPoints: string[];
    updatedAt?: string;
  } | null;
  progress: {
    policyAcceptedAt: string | null;
    completedAt: string | null;
    updatedAt: string | null;
  } | null;
};

function safeReturnTo(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('://') || value.includes('onboarding') || value.includes('(auth)')) return '/general';
  return value;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { returnTo: requestedReturnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnTo(requestedReturnTo);
  const { mode, api } = useSession();
  const { colors } = useTheme();
  const [payload, setPayload] = React.useState<OnboardingPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    if (mode !== 'authenticated') return;
    setLoading(true);
    setError('');
    try {
      const next = await api.request<OnboardingPayload>('onboarding', { context: 'public' });
      if (!next.active || !next.experience || next.progress?.completedAt) {
        router.replace(returnTo as any);
        return;
      }
      setPayload(next);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load your COT welcome.');
    } finally {
      setLoading(false);
    }
  }, [api, mode, returnTo]);

  React.useEffect(() => {
    if (mode === 'visitor') {
      router.replace('/general');
      return;
    }
    if (mode === 'authenticated') void load();
  }, [load, mode]);

  const update = async (action: 'accept_policy' | 'complete') => {
    if (!payload?.experience) return;
    setBusy(true);
    setError('');
    try {
      const next = await api.request<OnboardingPayload>('onboarding', {
        method: 'POST',
        context: 'public',
        body: JSON.stringify({ action, experienceId: payload.experience.id }),
      });
      setPayload(next);
      if (action === 'complete') router.replace(returnTo as any);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save your welcome progress.');
    } finally {
      setBusy(false);
    }
  };

  if (loading || mode === 'restoring') {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.bg }]}>
        <BrandMark variant="auth" size={70} />
        <ActivityIndicator color={colors.interactive} />
        <Text style={[styles.centerText, { color: colors.textSecondary }]}>Opening your COT welcome…</Text>
      </View>
    );
  }

  if (error && !payload) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.bg }]}>
        <View style={[styles.stateIcon, { backgroundColor: colors.primarySoft }]}><Icon name="refresh-outline" size={26} color={colors.interactive} /></View>
        <Text style={[styles.stateTitle, { color: colors.text }]}>We couldn’t open your welcome</Text>
        <Text style={[styles.centerText, { color: colors.textSecondary }]}>{error}</Text>
        <Button label="Try again" onPress={() => void load()} />
      </View>
    );
  }

  if (!payload?.experience) return null;
  const accepted = Boolean(payload.progress?.policyAcceptedAt);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + 130 }]}>
        <View style={styles.brandRow}>
          <BrandMark variant="auth" size={50} />
          <View style={styles.brandCopy}>
            <Text style={[styles.brandEyebrow, { color: colors.interactive }]}>COT WELCOME</Text>
            <Text style={[styles.brandTitle, { color: colors.text }]}>{payload.experience.title}</Text>
          </View>
        </View>

        {!accepted ? (
          <>
            <Text style={[styles.intro, { color: colors.textSecondary }]}>{payload.experience.subtitle}</Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}><Icon name="shield-checkmark-outline" size={28} color={colors.interactive} /></View>
              <Text style={[styles.eyebrow, { color: colors.interactive }]}>COMMUNITY POLICY</Text>
              <Text style={[styles.heroTitle, { color: colors.text }]}>{payload.experience.policyTitle}</Text>
              <Text style={[styles.heroBody, { color: colors.textSecondary }]}>{payload.experience.policySummary}</Text>
              <View style={styles.points}>
                {payload.experience.policyPoints.map((point) => (
                  <View key={point} style={[styles.policyPoint, { borderColor: colors.borderSubtle }]}>
                    <View style={[styles.numberDot, { backgroundColor: colors.primarySoft }]}><Icon name="checkmark" size={13} color={colors.interactive} /></View>
                    <Text style={[styles.policyPointText, { color: colors.textSecondary }]}>{point}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}><Icon name="navigate-circle-outline" size={30} color={colors.interactive} /></View>
            <Text style={[styles.eyebrow, { color: colors.interactive }]}>READY TO ENTER</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>{payload.experience.title}</Text>
            <Text style={[styles.heroBody, { color: colors.textSecondary }]}>{payload.experience.subtitle}</Text>
            <View style={[styles.tourNote, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
              <Icon name="sparkles-outline" size={18} color={colors.interactive} />
              <Text style={[styles.tourNoteText, { color: colors.textSecondary }]}>Your interactive guide will use the real COT screens and controls after you enter the app. Expression guidance appears only after you open an Expression you belong to.</Text>
            </View>
          </View>
        )}

        {error ? <Text style={[styles.inlineError, { color: colors.live }]}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.glass, borderColor: colors.borderSubtle, paddingBottom: Math.max(insets.bottom, spacing.md) }, shadows.floating]}>
        {!accepted ? (
          <Button label="I understand · Continue" onPress={() => void update('accept_policy')} loading={busy} fullWidth size="lg" />
        ) : (
          <Button label="Open COT" onPress={() => void update('complete')} loading={busy} fullWidth size="lg" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 580, alignSelf: 'center', paddingHorizontal: spacing.xl },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  centerText: { ...typography.bodySmall, textAlign: 'center', maxWidth: 420 },
  stateIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  brandCopy: { flex: 1 },
  brandEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  brandTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900', letterSpacing: -0.45 },
  intro: { ...typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg },
  card: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xxl },
  heroIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: spacing.sm },
  heroTitle: { fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: -0.8, maxWidth: 480 },
  heroBody: { fontSize: 14, lineHeight: 22, marginTop: spacing.md },
  points: { gap: spacing.sm, marginTop: spacing.xl },
  policyPoint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  numberDot: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  policyPointText: { flex: 1, fontSize: 13, lineHeight: 19 },
  tourNote: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xl, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tourNoteText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
  inlineError: { fontSize: 12, lineHeight: 18, marginTop: spacing.md },
  footer: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, maxWidth: 560, alignSelf: 'center', borderWidth: 1, borderRadius: radius.xxl, padding: spacing.md },
});
