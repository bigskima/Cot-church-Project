import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

type GuideStep = {
  eyebrow: string;
  title: string;
  body: string;
  icon: string;
  points: string[];
};

function safeReturnTo(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('://') || value.includes('onboarding') || value.includes('(auth)')) {
    return '/(tabs)/home';
  }
  return value;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { returnTo: requestedReturnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnTo(requestedReturnTo);
  const { mode, context, permissions, api } = useSession();
  const { colors } = useTheme();
  const [payload, setPayload] = React.useState<OnboardingPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [stepIndex, setStepIndex] = React.useState(0);

  const hasExpressions = Boolean(context?.expressions?.length);
  const hasLeadership = permissions.includes('*') || permissions.some((permission) =>
    ['posts.create', 'reels.create', 'videos.create', 'media.upload', 'studio.access', 'streams.broadcast', 'sermons.manage', 'events.create', 'roles.assign', 'organization.leadership.manage', 'expression.leadership.manage'].includes(permission),
  );

  const guideSteps = React.useMemo<GuideStep[]>(() => {
    const steps: GuideStep[] = [
      {
        eyebrow: 'PUBLIC COT',
        title: 'Start with the public church experience',
        body: 'Home, Discover and Reels remain open for public church media and discovery. Signing in adds interaction without hiding the public experience.',
        icon: 'globe-outline',
        points: ['Home brings together current church content.', 'Discover helps you search sermons, leaders, media and Expressions.', 'Reels keeps short-form media immersive and easy to browse.'],
      },
      {
        eyebrow: 'COMMUNITY',
        title: 'Your account unlocks real interaction',
        body: 'Use your signed-in identity to react, comment, save, pray and respond to invitations. Your identity stays separate from any leadership permission.',
        icon: 'people-outline',
        points: ['Community is the general church conversation surface.', 'Notifications carry invitations and important updates.', 'Profile is your identity and personal church workspace.'],
      },
      hasExpressions
        ? {
            eyebrow: 'YOUR EXPRESSIONS',
            title: 'Expression spaces open only when you enter them',
            body: 'You belong to one or more Expressions. Their private content and tools stay out of the public feed until you deliberately enter that Expression.',
            icon: 'grid-outline',
            points: ['Choose an Expression from your profile or Expression entry point.', 'Leaving an Expression returns you to General COT.', 'Expression membership never changes what remains public.'],
          }
        : {
            eyebrow: 'EXPRESSIONS',
            title: 'Join an Expression when you are invited',
            body: 'Expression spaces work like private church channels. Until you join and enter one, its internal content and tools stay hidden.',
            icon: 'grid-outline',
            points: ['Public Expression profiles may still be discoverable.', 'Invite or membership approval unlocks the private space.', 'General COT continues to work even without an Expression.'],
          },
      hasLeadership
        ? {
            eyebrow: 'YOUR RESPONSIBILITIES',
            title: 'Leadership tools appear only where you have authority',
            body: 'Your account currently has scoped ministry or creator permissions. The You area exposes only the tools your backend permissions allow.',
            icon: 'shield-checkmark-outline',
            points: ['Creator Studio is permission-gated.', 'Expression and church leadership scopes remain separate.', 'Platform Administration is still a separate authority surface.'],
          }
        : {
            eyebrow: 'YOU',
            title: 'Keep personal controls under You',
            body: 'Your profile keeps account settings, prayer, giving, saved activity and future member tools away from the public content screens.',
            icon: 'person-circle-outline',
            points: ['Use Settings for identity and privacy controls.', 'Use Notifications for invitations and updates.', 'New permissions appear automatically when church leadership grants them.'],
          },
    ];
    return steps;
  }, [hasExpressions, hasLeadership]);

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
      setError(value instanceof Error ? value.message : 'Unable to load your welcome guide.');
    } finally {
      setLoading(false);
    }
  }, [api, mode, returnTo]);

  React.useEffect(() => {
    if (mode === 'visitor') {
      router.replace('/(tabs)/home');
      return;
    }
    if (mode === 'authenticated') void load();
  }, [mode, load]);

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
      setError(value instanceof Error ? value.message : 'Unable to save your onboarding progress.');
    } finally {
      setBusy(false);
    }
  };

  if (loading || mode === 'restoring') {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.bg }]}>
        <BrandMark variant="auth" size={70} />
        <ActivityIndicator color={colors.interactive} />
        <Text style={[styles.centerText, { color: colors.textSecondary }]}>Preparing your COT welcome…</Text>
      </View>
    );
  }

  if (error && !payload) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.bg }]}>
        <View style={[styles.stateIcon, { backgroundColor: colors.primarySoft }]}><Icon name="refresh-outline" size={26} color={colors.interactive} /></View>
        <Text style={[styles.stateTitle, { color: colors.text }]}>We couldn’t open your welcome guide</Text>
        <Text style={[styles.centerText, { color: colors.textSecondary }]}>{error}</Text>
        <Button label="Try again" onPress={() => void load()} />
      </View>
    );
  }

  if (!payload?.experience) return null;
  const policyAccepted = Boolean(payload.progress?.policyAcceptedAt);
  const currentStep = guideSteps[Math.min(stepIndex, guideSteps.length - 1)];
  const progress = policyAccepted ? (stepIndex + 1) / guideSteps.length : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 120 }]}
      >
        <View style={styles.brandRow}>
          <BrandMark variant="auth" size={48} />
          <View style={styles.brandCopy}>
            <Text style={[styles.brandEyebrow, { color: colors.interactive }]}>COT WELCOME</Text>
            <Text style={[styles.brandTitle, { color: colors.text }]}>{payload.experience.title}</Text>
          </View>
        </View>

        {policyAccepted ? (
          <>
            <View style={[styles.progressTrack, { backgroundColor: colors.bgSecondary }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.interactive, width: `${Math.max(8, progress * 100)}%` }]} />
            </View>

            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name={currentStep.icon} size={30} color={colors.interactive} />
              </View>
              <Text style={[styles.eyebrow, { color: colors.interactive }]}>{currentStep.eyebrow}</Text>
              <Text style={[styles.heroTitle, { color: colors.text }]}>{currentStep.title}</Text>
              <Text style={[styles.heroBody, { color: colors.textSecondary }]}>{currentStep.body}</Text>

              <View style={styles.points}>
                {currentStep.points.map((point) => (
                  <View key={point} style={[styles.pointRow, { backgroundColor: colors.bgSecondary }]}>
                    <View style={[styles.pointIcon, { backgroundColor: colors.primarySoft }]}><Icon name="checkmark" size={14} color={colors.interactive} /></View>
                    <Text style={[styles.pointText, { color: colors.textSecondary }]}>{point}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.stepDots}>
              {guideSteps.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.stepDot,
                    { backgroundColor: index === stepIndex ? colors.interactive : colors.borderSubtle },
                    index === stepIndex && styles.stepDotActive,
                  ]}
                />
              ))}
            </View>

            {error ? <Text style={[styles.inlineError, { color: colors.live }]}>{error}</Text> : null}
          </>
        ) : (
          <>
            <Text style={[styles.intro, { color: colors.textSecondary }]}>{payload.experience.subtitle}</Text>
            <View style={[styles.policyCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="shield-checkmark-outline" size={28} color={colors.interactive} />
              </View>
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
            {error ? <Text style={[styles.inlineError, { color: colors.live }]}>{error}</Text> : null}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.glass, borderColor: colors.borderSubtle, paddingBottom: Math.max(insets.bottom, spacing.md) }, shadows.floating]}>
        {!policyAccepted ? (
          <Button label="I understand · Continue" onPress={() => void update('accept_policy')} loading={busy} fullWidth size="lg" />
        ) : (
          <>
            <View style={styles.footerActions}>
              <Button
                label="Back"
                variant="secondary"
                onPress={() => setStepIndex((value) => Math.max(0, value - 1))}
                disabled={stepIndex === 0 || busy}
                style={styles.secondaryAction}
              />
              {stepIndex < guideSteps.length - 1 ? (
                <Button label="Next" onPress={() => setStepIndex((value) => Math.min(guideSteps.length - 1, value + 1))} disabled={busy} style={styles.primaryAction} />
              ) : (
                <Button label="Enter COT" onPress={() => void update('complete')} loading={busy} style={styles.primaryAction} />
              )}
            </View>
            {stepIndex < guideSteps.length - 1 ? (
              <Pressable onPress={() => void update('complete')} disabled={busy} style={styles.skipButton} accessibilityRole="button">
                <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip tour and enter COT</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: spacing.xl },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  centerText: { ...typography.bodySmall, textAlign: 'center', maxWidth: 420 },
  stateIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  brandCopy: { flex: 1 },
  brandEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  brandTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  intro: { ...typography.bodySmall, lineHeight: 20, marginBottom: spacing.lg },
  progressTrack: { height: 5, borderRadius: 999, overflow: 'hidden', marginBottom: spacing.xl },
  progressFill: { height: '100%', borderRadius: 999 },
  heroCard: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xxl },
  policyCard: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xxl },
  heroIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: spacing.sm },
  heroTitle: { fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: -0.8, maxWidth: 460 },
  heroBody: { fontSize: 14, lineHeight: 22, marginTop: spacing.md },
  points: { gap: spacing.sm, marginTop: spacing.xl },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md },
  pointIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, fontSize: 13, lineHeight: 19 },
  policyPoint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  numberDot: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  policyPointText: { flex: 1, fontSize: 13, lineHeight: 20 },
  stepDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: spacing.xl },
  stepDot: { width: 7, height: 7, borderRadius: 4 },
  stepDotActive: { width: 24 },
  inlineError: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: spacing.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  footerActions: { width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', gap: spacing.sm },
  secondaryAction: { flex: 0.38 },
  primaryAction: { flex: 0.62 },
  skipButton: { alignSelf: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  skipText: { fontSize: 12, fontWeight: '700' },
});
