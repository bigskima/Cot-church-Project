import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  Icon,
  ResourceError,
  SectionHeader,
  SocialProfileHero,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    mode,
    context,
    contextStatus,
    contextError,
    accessReady,
    refreshContext,
    hasOrganizationCapability,
    hasPublicCapability,
    signOut,
  } = useSession();
  const { colors } = useTheme();

  const profile = context?.profile;
  const membershipOrganization = context?.organization ?? context?.organizations?.[0];
  const creatorOrganization = context?.creatorOrganizations?.[0];
  const organization = membershipOrganization ?? creatorOrganization;

  const isAuthorizedExpressionCreator = Boolean(
    mode === 'authenticated' &&
    context?.creatorOrganizations?.some((item) => item.id === organization?.id),
  );

  const hasPublicBroadcastAccess = hasPublicCapability('public.live_stream.create');
  const hasOrganizationPastoralLeadershipAccess =
    ((hasOrganizationCapability('prayer.moderate') &&
      (hasOrganizationCapability('prayer.pastoral.receive') || hasOrganizationCapability('prayer.team.receive'))) ||
      hasOrganizationCapability('pastoral.followups.receive'));

  const hasOrganizationCreatorAccess =
    hasOrganizationCapability('posts.create') ||
    hasOrganizationCapability('posts.publish') ||
    (hasOrganizationCapability('media.upload') &&
      (hasOrganizationCapability('reels.publish') || hasOrganizationCapability('videos.publish')));

  const hasOrganizationContentLeadershipAccess =
    hasOrganizationCreatorAccess ||
    hasOrganizationCapability('sermons.create') ||
    hasOrganizationCapability('sermons.manage') ||
    hasOrganizationCapability('events.create') ||
    hasOrganizationCapability('events.update');

  const hasOrganizationLeadershipAccess =
    hasOrganizationCapability('organization.leadership.manage') ||
    hasOrganizationContentLeadershipAccess ||
    hasOrganizationPastoralLeadershipAccess ||
    hasOrganizationCapability('giving.campaigns.manage') ||
    hasOrganizationCapability('giving.finance.read') ||
    isAuthorizedExpressionCreator;

  const hasLeadershipAccess = mode === 'authenticated' && accessReady && (
    hasPublicBroadcastAccess || hasOrganizationLeadershipAccess
  );

  const compactLink = (route: string, icon: string, title: string, subtitle: string) => (
    <Pressable
      onPress={() => router.push(route as any)}
      style={({ pressed }) => [
        styles.compactLink,
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
        shadows.sm,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.compactLinkIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={19} color={colors.interactive} />
      </View>
      <View style={styles.compactLinkCopy}>
        <Text style={[styles.compactLinkTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.compactLinkSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 0, paddingBottom: insets.bottom + 110 },
        ]}
      >
        {mode === 'visitor' ? (
          <View style={[styles.visitorCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.visitorIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Icon name="person-add" size={28} color={colors.interactive} />
            </View>
            <Text style={[styles.visitorTitle, { color: colors.text }]}>Your COT account</Text>
            <Text style={[styles.visitorSubtitle, { color: colors.textSecondary }]}>
              Browse General COT freely. Sign in when you want to create, message, save, join Expressions or manage your profile.
            </Text>
            <Button
              label="Sign in or create account"
              onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/profile' } } as any)}
              variant="primary"
              size="lg"
              style={{ width: '100%', marginTop: spacing.sm }}
            />
            <Button
              label="Browse tools"
              onPress={() => router.push('/general/tools')}
              variant="outline"
              size="md"
              style={{ width: '100%' }}
            />
          </View>
        ) : contextStatus === 'loading' && !context ? (
          <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <Skeleton height={120} />
            <Skeleton height={74} />
            <Skeleton height={42} />
          </View>
        ) : contextStatus === 'error' && !context ? (
          <ResourceError
            message={contextError || 'We couldn’t load your account right now.'}
            retry={refreshContext}
          />
        ) : (
          <View style={styles.fullBleedProfile}>
            <SocialProfileHero
              displayName={profile?.display_name ?? 'Church Member'}
              username={profile?.username}
              avatarUrl={profile?.avatar_url}
              bannerUrl={profile?.banner_url}
              badges={((profile as any)?.badges ?? [])}
              contextLabel={organization?.name ?? null}
              actions={
                <Button
                  label="Edit profile"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push('/general/settings')}
                />
              }
            />
          </View>
        )}

        {mode === 'authenticated' ? (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Quick access" subtitle="Your most-used General COT destinations" />
            <View style={styles.quickGrid}>
              {compactLink('/general/chat', 'chatbubbles-outline', 'Messages', 'Private direct conversations across COT')}
              {compactLink('/general/notifications', 'notifications-outline', 'Notifications', 'Invitations, replies and account activity')}
              {compactLink('/general/saved', 'bookmark-outline', 'Saved', 'Everything you kept for later')}
              {compactLink('/expressions', 'business-outline', 'Expressions', 'Your private church spaces')}
            </View>
          </View>
        ) : null}

        {mode === 'authenticated' && !accessReady ? (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Ministry" subtitle="Getting your ministry tools ready" />
            <Skeleton height={86} />
          </View>
        ) : hasLeadershipAccess ? (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Ministry" subtitle="Only tools available to your account appear here" />
            <Pressable
              onPress={() => router.push('/general/leadership')}
              style={({ pressed }) => [
                styles.leadershipBanner,
                { backgroundColor: colors.card, borderColor: colors.interactive },
                shadows.md,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.leadershipIconWrap, { backgroundColor: colors.primarySoft }]}>
                <Icon name="construct-outline" size={22} color={colors.interactive} />
              </View>
              <View style={styles.leadershipContent}>
                <View style={styles.leadershipTitleRow}>
                  <Text style={[styles.leadershipTitle, { color: colors.text }]}>Ministry tools</Text>
                  <Badge label="MINISTRY" variant="primary" />
                </View>
                <Text style={[styles.leadershipSub, { color: colors.textSecondary }]}>
                  Open your church-wide ministry workspace
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionWrap}>
          <Pressable
            onPress={() => router.push('/general/tools')}
            style={({ pressed }) => [
              styles.allToolsCard,
              { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.allToolsCopy}>
              <Text style={[styles.allToolsTitle, { color: colors.text }]}>General COT tools & settings</Text>
              <Text style={[styles.allToolsSubtitle, { color: colors.textSecondary }]}>
                Prayer, Giving, COT Assistant, creation tools, appearance and account settings are organized here.
              </Text>
            </View>
            <View style={[styles.allToolsIcon, { backgroundColor: colors.card }]}>
              <Icon name="arrow-forward" size={18} color={colors.interactive} />
            </View>
          </Pressable>
        </View>

        {mode === 'authenticated' ? (
          <View style={styles.sectionWrap}>
            <Button label="Sign out" onPress={() => signOut()} variant="destructive" size="lg" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.md, gap: spacing.xl },
  visitorCard: {
    padding: spacing.xl,
    borderRadius: radius.xxl,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  visitorIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  visitorTitle: { ...typography.h2, textAlign: 'center' },
  visitorSubtitle: { ...typography.bodySmall, textAlign: 'center', lineHeight: 18 },
  memberCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  fullBleedProfile: { marginHorizontal: -spacing.md },
  quickAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: spacing.sm,
  },
  quickActionText: { fontSize: 11.5, fontWeight: '800' },
  sectionWrap: { gap: spacing.sm },
  quickGrid: { gap: spacing.sm },
  compactLink: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
  },
  compactLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactLinkCopy: { flex: 1, minWidth: 0 },
  compactLinkTitle: { fontSize: 13.5, fontWeight: '800' },
  compactLinkSubtitle: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  leadershipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  leadershipIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadershipContent: { flex: 1, gap: 2 },
  leadershipTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leadershipTitle: { fontSize: 15, fontWeight: '800' },
  leadershipSub: { fontSize: 11, lineHeight: 16 },
  allToolsCard: {
    minHeight: 86,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  allToolsCopy: { flex: 1, minWidth: 0 },
  allToolsTitle: { fontSize: 14, fontWeight: '900' },
  allToolsSubtitle: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  allToolsIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
});
