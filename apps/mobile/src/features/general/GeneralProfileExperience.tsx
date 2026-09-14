import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Icon, ResourceError, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useGeneralMinistryAccess } from './useGeneralMinistryAccess';

type HubLink = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
};

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionTitleWrap}>
      {eyebrow ? <Text style={[styles.sectionEyebrow, { color: colors.interactive }]}>{eyebrow}</Text> : null}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

function HubCard({ item }: { item: HubLink }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(item.route as any)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.hubCard,
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
        shadows.sm,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.hubIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={item.icon as any} size={20} color={colors.interactive} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.hubTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.hubSubtitle, { color: colors.textMuted }]} numberOfLines={2}>{item.subtitle}</Text>
      </View>
      <View style={[styles.hubArrow, { backgroundColor: colors.bgSecondary }]}>
        <Icon name="arrow-forward" size={14} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

function RoundAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.roundAction, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}>
      <Icon name={icon as any} size={18} color={colors.text} />
    </Pressable>
  );
}

export default function GeneralProfileExperience() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const {
    mode,
    context,
    contextStatus,
    contextError,
    refreshContext,
    signOut,
  } = useSession();
  const ministry = useGeneralMinistryAccess();

  const profile = context?.profile;
  const organization = context?.organization ?? context?.organizations?.[0] ?? context?.creatorOrganizations?.[0];
  const displayName = profile?.display_name?.trim() || 'Church Member';
  const firstName = displayName.split(/\s+/).filter(Boolean)[0] || 'there';

  const everydayLinks: HubLink[] = [
    { key: 'messages', title: 'Messages', subtitle: 'Direct conversations across COT', icon: 'chatbubbles-outline', route: '/general/chat' },
    { key: 'notifications', title: 'Notifications', subtitle: 'General and Expression updates, kept scoped', icon: 'notifications-outline', route: '/general/notifications' },
    { key: 'saved', title: 'Saved', subtitle: 'Sermons, posts and media you kept', icon: 'bookmark-outline', route: '/general/saved' },
    { key: 'expressions', title: 'My Expressions', subtitle: 'Move into your private church communities', icon: 'people-circle-outline', route: '/expressions' },
  ];

  const participationLinks: HubLink[] = [
    { key: 'prayer', title: 'Prayer', subtitle: 'Pray, submit a request or revisit prayer activity', icon: 'heart-outline', route: '/general/prayer' },
    { key: 'giving', title: 'Giving', subtitle: 'Give and review your giving activity', icon: 'gift-outline', route: '/general/giving' },
    { key: 'events', title: 'Events', subtitle: 'Upcoming gatherings and church moments', icon: 'calendar-outline', route: '/general/events' },
    { key: 'assistant', title: 'COT Assistant', subtitle: 'Ask for help understanding COT content', icon: 'sparkles-outline', route: '/general/assistant' },
  ];

  if (mode === 'visitor') {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 120 }]}>
          <View style={styles.pageHeading}>
            <View><Text style={[styles.pageEyebrow, { color: colors.interactive }]}>YOUR COT</Text><Text style={[styles.pageTitle, { color: colors.text }]}>You</Text></View>
            <RoundAction icon="settings-outline" label="Open General COT tools" onPress={() => router.push('/general/tools')} />
          </View>
          <View style={[styles.visitorHero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.heroOrbLarge, { backgroundColor: colors.primarySoft }]} />
            <View style={[styles.visitorIcon, { backgroundColor: colors.primarySoft }]}><Icon name="person-add-outline" size={28} color={colors.interactive} /></View>
            <Text style={[styles.visitorTitle, { color: colors.text }]}>Make COT yours.</Text>
            <Text style={[styles.visitorCopy, { color: colors.textSecondary }]}>General COT stays open for browsing. Sign in when you want your profile, messages, saved content, giving, prayer history and Expressions in one place.</Text>
            <View style={styles.visitorActions}>
              <Button label="Sign in or create account" onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/profile' } } as any)} size="lg" />
              <Button label="Explore General COT" onPress={() => router.push('/general/explore')} variant="outline" size="lg" />
            </View>
          </View>
          <SectionTitle eyebrow="DISCOVER" title="You can still explore" subtitle="These public areas remain available before you sign in." />
          <View style={styles.grid}>{participationLinks.slice(2).map((item) => <HubCard key={item.key} item={item} />)}</View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 126 }]}>
        <View style={styles.pageHeading}>
          <View style={styles.flex}>
            <Text style={[styles.pageEyebrow, { color: colors.interactive }]}>YOUR COT</Text>
            <Text style={[styles.pageTitle, { color: colors.text }]}>You</Text>
            <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>Profile, participation and ministry access without digging through settings.</Text>
          </View>
          <View style={styles.topActions}>
            <RoundAction icon="notifications-outline" label="Notifications" onPress={() => router.push('/general/notifications')} />
            <RoundAction icon="settings-outline" label="Settings" onPress={() => router.push('/general/settings')} />
          </View>
        </View>

        {contextStatus === 'loading' && !context ? (
          <View style={styles.loadingStack}><Skeleton height={220} borderRadius={radius.xxl} /><Skeleton height={84} count={4} /></View>
        ) : contextStatus === 'error' && !context ? (
          <ResourceError message={contextError || 'We couldn’t load your account right now.'} retry={refreshContext} />
        ) : (
          <>
            <View style={[styles.identityCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <View style={[styles.identityBanner, { backgroundColor: colors.primarySoft }]}>
                {profile?.banner_url ? <Image source={{ uri: profile.banner_url }} style={styles.identityBannerImage} resizeMode="cover" /> : <><View style={[styles.heroOrbLarge, { backgroundColor: colors.primarySoftStrong }]} /><View style={[styles.heroOrbSmall, { backgroundColor: colors.card }]} /></>}
              </View>
              <View style={styles.identityBody}>
                <View style={styles.identityMainRow}>
                  <View style={[styles.avatarFrame, { backgroundColor: colors.card, borderColor: colors.card }]}><Avatar url={profile?.avatar_url} name={displayName} size="lg" /></View>
                  <View style={styles.identityCopy}>
                    <Text style={[styles.welcome, { color: colors.textMuted }]}>Good to see you, {firstName}.</Text>
                    <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
                    {profile?.username ? <Text style={[styles.memberHandle, { color: colors.textSecondary }]} numberOfLines={1}>@{profile.username}</Text> : null}
                  </View>
                  <Pressable onPress={() => router.push('/general/settings')} style={({ pressed }) => [styles.editButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]} accessibilityRole="button">
                    <Icon name="create-outline" size={16} color={colors.text} /><Text style={[styles.editText, { color: colors.text }]}>Edit</Text>
                  </Pressable>
                </View>
                <View style={styles.identityMetaRow}>
                  {organization?.name ? <View style={[styles.metaPill, { backgroundColor: colors.bgSecondary }]}><Icon name="globe-outline" size={12} color={colors.interactive} /><Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{organization.name}</Text></View> : null}
                  {ministry.hasAnyMinistryAccess ? <View style={[styles.metaPill, { backgroundColor: colors.primarySoft }]}><Icon name="shield-checkmark-outline" size={12} color={colors.interactive} /><Text style={[styles.metaTextStrong, { color: colors.interactive }]}>Ministry access</Text></View> : null}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <SectionTitle eyebrow="EVERYDAY" title="Your COT" subtitle="The things you are most likely to come back for." />
              <View style={styles.grid}>{everydayLinks.map((item) => <HubCard key={item.key} item={item} />)}</View>
            </View>

            <View style={styles.section}>
              <SectionTitle eyebrow="PARTICIPATE" title="Prayer, giving and gatherings" subtitle="Move into an action without searching through the app." />
              <View style={styles.grid}>{participationLinks.map((item) => <HubCard key={item.key} item={item} />)}</View>
            </View>

            {!ministry.accessReady ? (
              <View style={styles.section}><SectionTitle eyebrow="MINISTRY" title="Preparing your workspace" /><Skeleton height={142} borderRadius={radius.xxl} /></View>
            ) : ministry.hasAnyMinistryAccess ? (
              <View style={styles.section}>
                <SectionTitle eyebrow="MINISTRY" title="Your ministry workspace" subtitle="Creation, care, people and finance tools appear according to your live permissions." />
                <Pressable onPress={() => router.push('/general/leadership')} accessibilityRole="button" style={({ pressed }) => [styles.ministryCard, { backgroundColor: colors.card, borderColor: colors.interactive }, shadows.md, pressed && styles.pressed]}>
                  <View style={styles.ministryTopRow}>
                    <View style={[styles.ministryIcon, { backgroundColor: colors.primarySoft }]}><Icon name="shield-checkmark-outline" size={24} color={colors.interactive} /></View>
                    <View style={styles.flex}>
                      <View style={styles.ministryTitleRow}><Text style={[styles.ministryTitle, { color: colors.text }]}>Open Ministry Workspace</Text><Badge label="ROLE AWARE" variant="primary" /></View>
                      <Text style={[styles.ministrySubtitle, { color: colors.textSecondary }]}>Only the areas your current role can use are shown.</Text>
                    </View>
                    <View style={[styles.hubArrow, { backgroundColor: colors.bgSecondary }]}><Icon name="arrow-forward" size={15} color={colors.interactive} /></View>
                  </View>
                  <View style={styles.focusRow}>{ministry.focusAreas.map((area) => <View key={area} style={[styles.focusChip, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Text style={[styles.focusText, { color: colors.textSecondary }]}>{area}</Text></View>)}</View>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.section}>
              <SectionTitle eyebrow="ACCOUNT" title="Preferences and controls" />
              <View style={styles.accountCard}>
                <HubCard item={{ key: 'profile-settings', title: 'Profile & account', subtitle: 'Identity, birthday, profile media and account details', icon: 'person-circle-outline', route: '/general/settings' }} />
                <HubCard item={{ key: 'tools', title: 'General COT tools', subtitle: 'Appearance, creation tools and secondary utilities', icon: 'grid-outline', route: '/general/tools' }} />
              </View>
              <Pressable onPress={() => signOut()} style={({ pressed }) => [styles.signOut, { borderColor: colors.borderSubtle }, pressed && styles.pressed]} accessibilityRole="button">
                <Icon name="log-out-outline" size={17} color={colors.live} /><Text style={[styles.signOutText, { color: colors.live }]}>Sign out</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 940, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.xl },
  flex: { flex: 1, minWidth: 0 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pageEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.1 },
  pageTitle: { fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.9, marginTop: 1 },
  pageSubtitle: { fontSize: 11.5, lineHeight: 17, marginTop: 3, maxWidth: 560 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  roundAction: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  loadingStack: { gap: spacing.md },
  identityCard: { borderWidth: 1, borderRadius: radius.xxl, overflow: 'hidden' },
  identityBanner: { height: 120, overflow: 'hidden', position: 'relative' },
  identityBannerImage: { width: '100%', height: '100%' },
  heroOrbLarge: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -130, right: -40, opacity: 0.82 },
  heroOrbSmall: { position: 'absolute', width: 96, height: 96, borderRadius: 48, top: 48, right: 118, opacity: 0.45 },
  identityBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  identityMainRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: -34 },
  avatarFrame: { width: 76, height: 76, borderRadius: 24, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1, minWidth: 0, paddingBottom: 3 },
  welcome: { fontSize: 10.5, fontWeight: '700' },
  memberName: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.5, marginTop: 1 },
  memberHandle: { fontSize: 11.5, marginTop: 1 },
  editButton: { minHeight: 40, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  editText: { fontSize: 10.5, fontWeight: '800' },
  identityMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  metaPill: { minHeight: 28, borderRadius: radius.pill, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  metaText: { fontSize: 10.5, fontWeight: '700', flexShrink: 1 },
  metaTextStrong: { fontSize: 10.5, fontWeight: '900' },
  section: { gap: spacing.md },
  sectionTitleWrap: { gap: 2 },
  sectionEyebrow: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 1.05 },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.45 },
  sectionSubtitle: { fontSize: 11, lineHeight: 16, maxWidth: 620 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hubCard: { flexGrow: 1, width: '47%', minWidth: 250, minHeight: 80, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hubIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hubTitle: { fontSize: 13.5, lineHeight: 18, fontWeight: '900' },
  hubSubtitle: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  hubArrow: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ministryCard: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md },
  ministryTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ministryIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  ministryTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  ministryTitle: { fontSize: 16.5, lineHeight: 21, fontWeight: '900', letterSpacing: -0.3 },
  ministrySubtitle: { fontSize: 10.8, lineHeight: 16, marginTop: 2 },
  focusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  focusChip: { minHeight: 28, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  focusText: { fontSize: 9.5, fontWeight: '800' },
  accountCard: { gap: spacing.sm },
  signOut: { alignSelf: 'flex-start', minHeight: 42, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 7 },
  signOutText: { fontSize: 11.5, fontWeight: '800' },
  visitorHero: { minHeight: 300, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, overflow: 'hidden', justifyContent: 'flex-end', gap: spacing.sm },
  visitorIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  visitorTitle: { fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.8 },
  visitorCopy: { fontSize: 12.5, lineHeight: 19, maxWidth: 620 },
  visitorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
});
