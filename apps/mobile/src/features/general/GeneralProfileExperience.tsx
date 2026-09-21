import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, Button, EmptyState, Icon, ResourceError, Skeleton, SocialProfileHero } from '@/components';
import { PostCard } from '@/components/community/PostCard';
import type { PublicIdentityBadge } from '@/components/identity/PublicIdentityBadge';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useResource } from '@/hooks/use-resource';
import { setFloatingActionsHidden } from '@/features/ai/floatingActionsPreference';
import { useGeneralMinistryAccess } from './useGeneralMinistryAccess';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type ControlLink = {
  key: string;
  label: string;
  icon: string;
  route?: string;
  onPress?: () => void;
  danger?: boolean;
};

type PublicProfilePayload = {
  profile: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
    banner_url?: string | null;
    bio?: string | null;
    badges?: PublicIdentityBadge[];
  };
  counts: { followers: number; following: number };
  viewer: { isSelf: boolean; isFollowing: boolean; canMessage: boolean };
  posts?: any[];
};

function ControlRow({ item, close }: { item: ControlLink; close?: () => void }) {
  const { colors } = useTheme();
  const activate = () => {
    close?.();
    if (item.onPress) item.onPress();
    else if (item.route) router.push(item.route as any);
  };
  return (
    <Pressable
      onPress={activate}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      style={({ pressed }) => [
        styles.controlRow,
        { borderBottomColor: colors.borderSubtle },
        pressed && { backgroundColor: colors.bgSecondary },
      ]}
    >
      <View style={[styles.controlIcon, { backgroundColor: item.danger ? colors.liveSoft : colors.primarySoft }]}>
        <Icon name={item.icon as any} size={18} color={item.danger ? colors.live : colors.interactive} />
      </View>
      <Text style={[styles.controlLabel, { color: item.danger ? colors.live : colors.text }]}>{item.label}</Text>
      <Icon name="chevron-forward" size={15} color={item.danger ? colors.live : colors.textMuted} />
    </Pressable>
  );
}

function ControlGroup({
  title,
  items,
  close,
}: {
  title: string;
  items: ControlLink[];
  close?: () => void;
}) {
  const { colors } = useTheme();
  if (!items.length) return null;
  return (
    <View style={styles.controlGroup}>
      <Text style={[styles.controlGroupTitle, { color: colors.textMuted }]}>{title}</Text>
      <View style={[styles.controlCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        {items.map((item) => <ControlRow key={item.key} item={item} close={close} />)}
      </View>
    </View>
  );
}

function RoundAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.roundAction,
        { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon as any} size={18} color={colors.text} />
    </Pressable>
  );
}

export default function GeneralProfileExperience() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { api, mode, context, contextStatus, contextError, refreshContext, signOut } = useSession();
  const ministry = useGeneralMinistryAccess();
  const [controlsOpen, setControlsOpen] = React.useState(false);
  const [floatingRestored, setFloatingRestored] = React.useState(false);
  const wide = width >= 980;

  const sessionProfile = context?.profile;
  const username = sessionProfile?.username?.trim().replace(/^@/, '').toLowerCase() ?? '';
  const organization = context?.organization ?? context?.organizations?.[0] ?? context?.creatorOrganizations?.[0];

  const publicProfile = useResource<PublicProfilePayload | null>(
    `account:public-profile:${username || 'none'}:${mode}`,
    (signal) => mode === 'authenticated' && username
      ? api.request<PublicProfilePayload>(
          `public-profile?username=${encodeURIComponent(username)}`,
          { signal, context: 'public', feedback: false },
        )
      : Promise.resolve(null),
  );

  const profile = publicProfile.data?.profile ?? sessionProfile;
  const displayName = profile?.display_name?.trim() || 'Church Member';
  const posts = publicProfile.data?.posts ?? [];
  const counts = publicProfile.data?.counts ?? { followers: 0, following: 0 };

  const restoreFloatingMenu = async () => {
    await setFloatingActionsHidden(false);
    setFloatingRestored(true);
    setTimeout(() => setFloatingRestored(false), 1800);
  };

  const openPublicProfile = () => {
    if (!username) return;
    router.push({ pathname: '/general/member/[username]', params: { username } } as any);
  };

  const profileControls: ControlLink[] = [
    { key: 'public-profile', label: 'View public profile', icon: 'person-outline', onPress: openPublicProfile },
    { key: 'edit-profile', label: 'Edit profile', icon: 'create-outline', route: '/general/settings' },
  ];
  const cotControls: ControlLink[] = [
    { key: 'bible', label: 'Bible & reading plans', icon: 'book-outline', route: '/general/bible' },
    { key: 'messages', label: 'Messages', icon: 'chatbubbles-outline', route: '/general/chat' },
    { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', route: '/general/notifications' },
    { key: 'saved', label: 'Saved', icon: 'bookmark-outline', route: '/general/saved' },
    { key: 'expressions', label: 'My Expressions', icon: 'people-circle-outline', route: '/expressions' },
  ];
  const participationControls: ControlLink[] = [
    { key: 'prayer', label: 'Prayer', icon: 'heart-outline', route: '/general/prayer' },
    { key: 'giving', label: 'Giving', icon: 'gift-outline', route: '/general/giving' },
    { key: 'events', label: 'Events', icon: 'calendar-outline', route: '/general/events' },
    { key: 'assistant', label: 'COT Assistant', icon: 'sparkles-outline', route: '/general/assistant' },
  ];
  const appControls: ControlLink[] = [
    { key: 'tour', label: 'App tour', icon: 'navigate-circle-outline', route: '/general/tour' },
    { key: 'tools', label: 'General COT tools', icon: 'grid-outline', route: '/general/tools' },
    { key: 'floating', label: floatingRestored ? 'Floating controls restored' : 'Restore floating controls', icon: floatingRestored ? 'checkmark-circle-outline' : 'move-outline', onPress: () => void restoreFloatingMenu() },
  ];
  const ministryControls: ControlLink[] = ministry.accessReady && ministry.hasAnyMinistryAccess
    ? [{ key: 'ministry', label: 'Ministry tools', icon: 'shield-checkmark-outline', route: '/general/leadership' }]
    : [];
  const accountControls: ControlLink[] = [
    { key: 'signout', label: 'Sign out', icon: 'log-out-outline', danger: true, onPress: () => void signOut() },
  ];

  const controls = (close?: () => void) => (
    <View style={styles.controlStack}>
      <ControlGroup title="PROFILE" items={profileControls} close={close} />
      <ControlGroup title="YOUR COT" items={cotControls} close={close} />
      <ControlGroup title="PARTICIPATE" items={participationControls} close={close} />
      <ControlGroup title="APP" items={appControls} close={close} />
      <ControlGroup title="MINISTRY" items={ministryControls} close={close} />
      <ControlGroup title="ACCOUNT" items={accountControls} close={close} />
    </View>
  );

  if (mode === 'visitor') {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={[styles.visitorCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
          <View style={[styles.visitorIcon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="person-add-outline" size={28} color={colors.interactive} />
          </View>
          <Text style={[styles.visitorTitle, { color: colors.text }]}>Your COT profile starts here.</Text>
          <Text style={[styles.visitorCopy, { color: colors.textMuted }]}>
            Sign in to see your public profile, posts, messages, saved content and account controls together.
          </Text>
          <Button label="Sign in or create account" onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/profile' } } as any)} />
          <Button label="Explore General COT" variant="outline" onPress={() => router.push('/general')} />
        </View>
      </View>
    );
  }

  const mainProfile = (
    <View style={styles.mainInner}>
      {contextStatus === 'loading' && !context ? (
        <View style={styles.loadingStack}>
          <Skeleton height={235} borderRadius={0} />
          <Skeleton height={54} />
          <Skeleton height={190} count={2} />
        </View>
      ) : contextStatus === 'error' && !context ? (
        <ResourceError message={contextError || 'We couldn’t load your account right now.'} retry={refreshContext} />
      ) : (
        <>
          <View style={styles.heroWrap}>
            <SocialProfileHero
              displayName={displayName}
              username={profile?.username}
              avatarUrl={profile?.avatar_url}
              bannerUrl={profile?.banner_url}
              bio={(profile as any)?.bio ?? null}
              badges={((profile as any)?.badges ?? [])}
              contextLabel={organization?.name ?? null}
              followers={counts.followers}
              following={counts.following}
              onFollowers={() => username && router.push({ pathname: '/general/member-connections', params: { username, type: 'followers' } } as any)}
              onFollowing={() => username && router.push({ pathname: '/general/member-connections', params: { username, type: 'following' } } as any)}
              actions={
                <>
                  <RoundAction icon="notifications-outline" label="Notifications" onPress={() => router.push('/general/notifications')} />
                  {!wide ? <RoundAction icon="menu-outline" label="Account controls" onPress={() => setControlsOpen(true)} /> : null}
                  <Button label="Public view" variant="outline" size="sm" onPress={openPublicProfile} />
                  <Button label="Edit profile" variant="outline" size="sm" onPress={() => router.push('/general/settings')} />
                </>
              }
            />
          </View>

          <View style={[styles.postsHeader, { borderBottomColor: colors.borderSubtle }]}>
            <View>
              <Text style={[styles.postsTitle, { color: colors.text }]}>Posts</Text>
              <Text style={[styles.postsSubtitle, { color: colors.textMuted }]}>What people see on your public COT profile.</Text>
            </View>
            <View style={[styles.postsCount, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.postsCountText, { color: colors.interactive }]}>{posts.length}</Text>
            </View>
          </View>

          {publicProfile.loading && !publicProfile.data ? (
            <View style={styles.postSkeletons}><Skeleton height={190} count={3} /></View>
          ) : publicProfile.error && !publicProfile.data ? (
            <View style={styles.profileError}>
              <ResourceError message={publicProfile.error} retry={publicProfile.refresh} />
            </View>
          ) : posts.length ? (
            <View style={styles.posts}>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  authorName={displayName}
                  authorHandle={profile?.username}
                  authorAvatar={profile?.avatar_url ?? null}
                  canEngage={mode === 'authenticated'}
                  onPress={() => router.push(`/general/post/${post.id}` as any)}
                  onPressAuthor={openPublicProfile}
                  onDeleted={() => publicProfile.refresh()}
                  allowExternalShare
                  variant="feed"
                  showContext={false}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyPosts}>
              <EmptyState
                title="No public posts yet"
                message="Posts you publish to General COT will appear here as part of your public profile."
                iconName="newspaper-outline"
              />
            </View>
          )}
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {wide ? (
        <View style={styles.wideShell}>
          <ScrollView
            style={styles.mainScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.mainScrollContent, { paddingBottom: insets.bottom + 80 }]}
          >
            {mainProfile}
          </ScrollView>
          <View style={[styles.sidebar, { borderLeftColor: colors.borderSubtle, paddingTop: Math.max(insets.top, spacing.md) }]}>
            <View style={styles.sidebarHeading}>
              <Text style={[styles.sidebarKicker, { color: colors.interactive }]}>ACCOUNT</Text>
              <Text style={[styles.sidebarTitle, { color: colors.text }]}>Your controls</Text>
              <Text style={[styles.sidebarCopy, { color: colors.textMuted }]}>Profile controls stay beside your public page instead of taking over the feed.</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.sidebarScroll, { paddingBottom: insets.bottom + spacing.xl }]}>
              {controls()}
            </ScrollView>
          </View>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.mobileScroll, { paddingBottom: insets.bottom + 110 }]}
        >
          {mainProfile}
        </ScrollView>
      )}

      <BottomSheet
        visible={!wide && controlsOpen}
        onClose={() => setControlsOpen(false)}
        title="Your COT"
        subtitle="Profile, app and account controls."
        maxHeightPercent={90}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mobileControls}>
          {controls(() => setControlsOpen(false))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  wideShell: { flex: 1, flexDirection: 'row', width: '100%', maxWidth: 1220, alignSelf: 'center' },
  mainScroll: { flex: 1 },
  mainScrollContent: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  mobileScroll: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  mainInner: { width: '100%' },
  heroWrap: { width: '100%' },
  loadingStack: { gap: spacing.md, paddingBottom: spacing.lg },
  roundAction: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  postsHeader: { minHeight: 70, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  postsTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.35 },
  postsSubtitle: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  postsCount: { minWidth: 32, height: 28, paddingHorizontal: 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  postsCountText: { fontSize: 11, fontWeight: '900' },
  posts: { width: '100%' },
  postSkeletons: { padding: spacing.md, gap: spacing.sm },
  profileError: { padding: spacing.md },
  emptyPosts: { padding: spacing.lg },
  sidebar: { width: 306, borderLeftWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, backgroundColor: 'transparent' },
  sidebarHeading: { paddingBottom: spacing.md, gap: 2 },
  sidebarKicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.1 },
  sidebarTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.4 },
  sidebarCopy: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  sidebarScroll: { paddingBottom: spacing.xl },
  controlStack: { gap: spacing.md },
  controlGroup: { gap: 6 },
  controlGroupTitle: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9, paddingHorizontal: 3 },
  controlCard: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  controlRow: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  controlIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  controlLabel: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: '800' },
  mobileControls: { paddingBottom: spacing.xl },
  visitorCard: { width: '100%', maxWidth: 540, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, gap: spacing.md },
  visitorIcon: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  visitorTitle: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.6 },
  visitorCopy: { fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
