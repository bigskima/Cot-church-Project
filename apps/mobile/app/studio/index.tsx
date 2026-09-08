import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import {
  Icon,
  LeadershipModuleCard,
  ScreenHeader,
  SectionHeader,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';

export default function CreatorStudioScreen({ forcedScope }: { forcedScope?: 'general' } = {}) {
  const insets = useSafeAreaInsets();
  const { context, mode, hasCapability, hasOrganizationCapability, hasPublicCapability } = useSession();
  const generalWorkspace = forcedScope === 'general';
  const expression = generalWorkspace ? undefined : context?.expression;
  const signedIn = mode === 'authenticated';
  const expressionCreatorOrganizationId = context?.organization?.id ?? context?.creatorOrganizations?.[0]?.id ?? '';
  const canCreateExpression = Boolean(
    expressionCreatorOrganizationId &&
    context?.creatorOrganizations?.some((item) => item.id === expressionCreatorOrganizationId),
  );
  const canModerateGeneralPrayer =
    hasOrganizationCapability('prayer.moderate') &&
    (hasOrganizationCapability('prayer.pastoral.receive') || hasOrganizationCapability('prayer.team.receive'));
  const canModerateExpressionPrayer =
    Boolean(expression?.id) &&
    hasCapability('prayer.moderate') &&
    (hasCapability('prayer.pastoral.receive') || hasCapability('prayer.team.receive'));
  const canAccessPastoral =
    canModerateGeneralPrayer ||
    canModerateExpressionPrayer ||
    hasOrganizationCapability('pastoral.followups.receive') ||
    (Boolean(expression?.id) && hasCapability('pastoral.followups.receive'));
  const { colors } = useTheme();

  if (!generalWorkspace && expression?.id) {
    return <Redirect href={`/expressions/${expression.id}/manage/studio` as any} />;
  }
  if (!generalWorkspace && !forcedScope) {
    return <Redirect href="/general/studio" />;
  }

  const routeFor = (generalRoute: string, legacyRoute: string) =>
    generalWorkspace ? generalRoute : legacyRoute;

  const openComposer = (compose: 'post' | 'audio') => {
    router.push({
      pathname: '/general/community',
      params: { compose, intentId: String(Date.now()) },
    } as any);
  };

  const creationActions = signedIn ? [
    {
      title: 'Post',
      description: 'Text, photos, video or uploaded audio.',
      iconName: 'create-outline',
      action: () => openComposer('post'),
    },
    {
      title: 'Voice',
      description: 'Record from your microphone and publish the audio.',
      iconName: 'mic-outline',
      action: () => openComposer('audio'),
    },
    {
      title: 'Reel',
      description: 'Create a vertical video for public discovery.',
      iconName: 'flash-outline',
      action: () => router.push('/general/studio/reel' as any),
    },
    {
      title: 'Video',
      description: 'Publish a long-form Watch video.',
      iconName: 'videocam-outline',
      action: () => router.push('/general/studio/video' as any),
    },
  ] : [];

  const leadershipModules = [
    {
      title: 'Sermons',
      description: 'Create sermon drafts, manage teachings and publish when ready.',
      iconName: 'book-outline',
      badge: 'MEDIA',
      route: routeFor('/general/leadership/sermons-manage', '/leadership/sermons'),
      enabled: generalWorkspace ? (hasOrganizationCapability('sermons.create') || hasOrganizationCapability('sermons.manage')) : (hasCapability('sermons.create') || hasCapability('sermons.manage')),
    },
    {
      title: 'Events',
      description: 'Create and manage church gatherings and events.',
      iconName: 'calendar-outline',
      badge: 'EVENTS',
      route: routeFor('/general/leadership/events-manage', '/leadership/events'),
      enabled: generalWorkspace ? (hasOrganizationCapability('events.create') || hasOrganizationCapability('events.update')) : (hasCapability('events.create') || hasCapability('events.update')),
    },
    {
      title: 'Live Media Studio',
      description: 'Create and manage live broadcasts available to you.',
      iconName: 'radio-outline',
      badge: 'BROADCAST',
      route: routeFor('/general/leadership/media-studio', '/leadership/media-studio'),
      enabled: hasPublicCapability('public.live_stream.create') || (Boolean(expression?.id) && hasCapability('streams.broadcast')),
    },
    {
      title: 'Pastoral Care',
      description: 'Review confidential prayer requests and care follow-ups.',
      iconName: 'heart-outline',
      badge: 'PASTORAL',
      route: routeFor('/general/leadership/pastoral-triage', '/leadership/pastoral-triage'),
      enabled: canAccessPastoral,
    },
    {
      title: 'Giving Setup',
      description: 'Manage giving destinations, purposes and transfer accounts.',
      iconName: 'gift-outline',
      badge: 'GIVING',
      route: routeFor('/general/leadership/giving-manage', '/(tabs)/profile/leadership/giving-manage'),
      enabled: generalWorkspace ? hasOrganizationCapability('giving.campaigns.manage') : hasCapability('giving.campaigns.manage'),
    },
    {
      title: 'Giving Reports',
      description: 'Review giving totals and refunds by currency.',
      iconName: 'analytics-outline',
      badge: 'FINANCE',
      route: routeFor('/general/leadership/giving-finance', '/(tabs)/profile/leadership/giving-finance'),
      enabled: generalWorkspace ? hasOrganizationCapability('giving.finance.read') : hasCapability('giving.finance.read'),
    },
    {
      title: 'Expressions',
      description: 'Create and manage Expressions available to your account.',
      iconName: 'people-outline',
      badge: 'COMMUNITY',
      route: routeFor('/general/leadership/expressions-manage', '/leadership/expressions'),
      enabled: canCreateExpression,
    },
    {
      title: 'Church Leadership',
      description: 'Manage church-wide leaders and public leadership presentation.',
      iconName: 'business-outline',
      badge: 'CHURCH',
      route: routeFor('/general/leadership/church-leadership', '/(tabs)/profile/leadership/church-leadership'),
      enabled: hasOrganizationCapability('organization.leadership.manage'),
    },
  ].filter((module) => module.enabled);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <ScreenHeader
          title="Create"
          kicker="GENERAL COT"
          subtitle="Publish to the church-wide public community."
          showBack
        />

        <View style={styles.body}>
          <View style={[styles.publicNotice, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }]}>
            <View style={[styles.publicNoticeIcon, { backgroundColor: colors.card }]}>
              <Icon name="globe-outline" size={20} color={colors.interactive} />
            </View>
            <View style={styles.publicNoticeCopy}>
              <Text style={[styles.publicNoticeTitle, { color: colors.text }]}>General COT is public</Text>
              <Text style={[styles.publicNoticeText, { color: colors.textSecondary }]}>
                Posts, Reels, videos and voice recordings created here can be seen across the public COT experience.
              </Text>
            </View>
          </View>

          {signedIn ? (
            <View style={styles.createSection}>
              <SectionHeader title="Create something" subtitle="Choose a format — no ministry role is required." />
              <View style={styles.createGrid}>
                {creationActions.map((item) => (
                  <Pressable
                    key={item.title}
                    onPress={item.action}
                    style={({ pressed }) => [
                      styles.createCard,
                      { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                      shadows.sm,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Create ${item.title}`}
                  >
                    <View style={[styles.createIcon, { backgroundColor: item.title === 'Reel' ? colors.liveSoft : colors.primarySoft }]}>
                      <Icon name={item.iconName} size={24} color={item.title === 'Reel' ? colors.live : colors.interactive} />
                    </View>
                    <Text style={[styles.createTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.createDescription, { color: colors.textMuted }]}>{item.description}</Text>
                    <View style={styles.createArrow}>
                      <Icon name="arrow-forward" size={15} color={colors.textMuted} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/studio' } } as any)}
              style={({ pressed }) => [
                styles.signInCard,
                { backgroundColor: colors.card, borderColor: colors.borderSubtle },
                pressed && styles.pressed,
              ]}
            >
              <Icon name="person-circle-outline" size={28} color={colors.interactive} />
              <View style={styles.signInCopy}>
                <Text style={[styles.signInTitle, { color: colors.text }]}>Sign in to create</Text>
                <Text style={[styles.signInText, { color: colors.textMuted }]}>Public content creation is available to every signed-in account.</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )}

          {leadershipModules.length ? (
            <View style={styles.modulesSection}>
              <SectionHeader
                title="More tools"
                badge={leadershipModules.length}
                subtitle="Ministry tools appear only when they are available to your account."
              />
              {leadershipModules.map((module) => (
                <LeadershipModuleCard
                  key={module.title}
                  title={module.title}
                  description={module.description}
                  iconName={module.iconName}
                  badge={module.badge}
                  onPress={() => router.push(module.route as any)}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.md, gap: spacing.xl },
  publicNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  publicNoticeIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  publicNoticeCopy: { flex: 1, gap: 2 },
  publicNoticeTitle: { fontSize: 14, fontWeight: '800' },
  publicNoticeText: { fontSize: 11.5, lineHeight: 17 },
  createSection: { gap: spacing.sm },
  createGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  createCard: { width: '48.5%', minHeight: 174, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.xs, position: 'relative' },
  createIcon: { width: 46, height: 46, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  createTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.35 },
  createDescription: { fontSize: 11.5, lineHeight: 17, paddingRight: spacing.sm },
  createArrow: { position: 'absolute', right: spacing.md, bottom: spacing.md },
  modulesSection: { gap: spacing.xs },
  signInCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg },
  signInCopy: { flex: 1, gap: 2 },
  signInTitle: { fontSize: 15, fontWeight: '800' },
  signInText: { fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
});
