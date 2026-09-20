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
  CompactRouteGrid,
  Icon,
  ScreenHeader,
  SectionHeader,
} from '@/components';
import { radius, spacing } from '@/design-system/tokens';

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
    {
      title: 'Giveaway',
      description: 'Host a member giveaway and record the selected winners.',
      iconName: 'gift-outline',
      action: () => router.push({ pathname: '/general/participate', params: { tab: 'giveaways', compose: 'giveaway' } } as any),
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
      description: 'Create gatherings with calendar/time selection and optional event banners.',
      iconName: 'calendar-outline',
      badge: 'EVENTS',
      route: routeFor('/general/leadership/events-manage', '/leadership/events'),
      enabled: generalWorkspace ? (hasOrganizationCapability('events.create') || hasOrganizationCapability('events.update')) : (hasCapability('events.create') || hasCapability('events.update')),
    },
    {
      title: 'Announcements',
      description: 'Draft, schedule and publish official church updates with optional flyers.',
      iconName: 'megaphone-outline',
      badge: 'UPDATES',
      route: routeFor('/general/leadership/announcements-manage', '/general/leadership/announcements-manage'),
      enabled: generalWorkspace ? hasOrganizationCapability('announcements.manage') : hasCapability('announcements.manage'),
    },
    {
      title: 'Polls',
      description: 'Publish official community polls and review participation.',
      iconName: 'stats-chart-outline',
      badge: 'ENGAGE',
      route: routeFor('/general/participate?tab=polls&compose=poll', '/general/participate?tab=polls&compose=poll'),
      enabled: generalWorkspace ? hasOrganizationCapability('polls.manage') : hasCapability('polls.manage'),
    },
    {
      title: 'Feed Ranking',
      description: 'Adjust how General COT Home prioritizes and presents content.',
      iconName: 'analytics-outline',
      badge: 'HOME',
      route: routeFor('/general/leadership/feed-ranking', '/general/leadership/feed-ranking'),
      enabled: generalWorkspace ? hasOrganizationCapability('feed.ranking.manage') : hasCapability('feed.ranking.manage'),
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
      title: 'Church Profile',
      description: 'Manage Our Story, Quick Facts, church location and Our Leaders.',
      iconName: 'business-outline',
      badge: 'CHURCH',
      route: '/general/church-story?manage=1',
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
        <ScreenHeader title="Create" showBack compact />

        <View style={styles.body}>
          {signedIn ? (
            <View style={styles.createSection}>
              <SectionHeader title="Create" compact />
              <CompactRouteGrid
                compact
                items={creationActions.map((item) => ({
                  key: item.title,
                  label: item.title,
                  icon: item.iconName,
                  accessibilityLabel: `${item.title}. ${item.description}`,
                  onPress: item.action,
                }))}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/studio' } } as any)}
              style={({ pressed }) => [styles.signInCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
            >
              <Icon name="person-circle-outline" size={24} color={colors.interactive} />
              <Text style={[styles.signInTitle, { color: colors.text }]}>Sign in to create</Text>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )}

          {leadershipModules.length ? (
            <View style={styles.modulesSection}>
              <SectionHeader title="Ministry" badge={leadershipModules.length} compact />
              <CompactRouteGrid
                compact
                items={leadershipModules.map((module) => ({
                  key: module.title,
                  label: module.title,
                  icon: module.iconName,
                  badge: module.badge,
                  accessibilityLabel: `${module.title}. ${module.description}`,
                  onPress: () => router.push(module.route as any),
                }))}
              />
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
  body: { paddingHorizontal: spacing.md, gap: spacing.lg },
  createSection: { gap: spacing.sm },
  modulesSection: { gap: spacing.sm },
  signInCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md },
  signInTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
});
