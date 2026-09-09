import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Badge,
  Button,
  Icon,
  ResourceError,
  ScreenHeader,
  SectionHeader,
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

  const quickAction = (route: string, icon: string, label: string) => (
    <Pressable
      onPress={() => router.push(route as any)}
      style={({ pressed }) => [
        styles.quickAction,
        { backgroundColor: colors.bgSecondary },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={17} color={colors.text} />
      <Text style={[styles.quickActionText, { color: colors.text }]}>{label}</Text>
    </Pressable>
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
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 110 },
        ]}
      >
        <ScreenHeader
          title="You"
          subtitle="Your profile, spaces and account controls."
          kicker="PROFILE"
        />

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
          <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.memberBanner, { backgroundColor: colors.primarySoft }]}>
              {profile?.banner_url ? (
                <Image source={{ uri: profile.banner_url }} style={styles.memberBannerImage} resizeMode="cover" />
              ) : (
                <View style={styles.memberBannerFallback}>
                  <Icon name="image-outline" size={24} color={colors.interactive} />
                </View>
              )}
            </View>

            <View style={styles.memberHeader}>
              <View style={[styles.avatarHalo, { backgroundColor: colors.card, borderColor: colors.card }]}>
                <Avatar url={profile?.avatar_url} name={profile?.display_name} size="lg" />
              </View>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]}>
                  {profile?.display_name ?? 'Church Member'}
                </Text>
                {profile?.username ? (
                  <Text style={[styles.memberHandle, { color: colors.textSecondary }]} numberOfLines={1}>
                    @{profile.username}
                  </Text>
                ) : profile?.email ? (
                  <Text style={[styles.memberHandle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {profile.email}
                  </Text>
                ) : null}
                {organization?.name ? (
                  <View style={styles.memberContextRow}>
                    <Icon name="globe-outline" size={12} color={colors.interactive} />
                    <Text style={[styles.memberOrg, { color: colors.interactive }]} numberOfLines={1}>
                      {organization.name}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.profileQuickActions}>
              {quickAction('/general/settings', 'create-outline', 'Edit profile')}
              {quickAction('/general/tools', 'grid-outline', 'Tools & settings')}
            </View>
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
    paddingBottom: spacing.lg,
  },
  memberBanner: { width: '100%', aspectRatio: 3 / 1, overflow: 'hidden' },
  memberBannerImage: { width: '100%', height: '100%' },
  memberBannerFallback: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-start', padding: spacing.md },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: -28,
  },
  avatarHalo: { padding: 4, borderWidth: 3, borderRadius: radius.pill },
  memberInfo: { flex: 1, minWidth: 0, gap: 2, paddingTop: 22 },
  memberName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  memberHandle: { fontSize: 12.5 },
  memberContextRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  memberOrg: { fontSize: 11.5, fontWeight: '700', flexShrink: 1 },
  profileQuickActions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
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
