import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Chip,
  CompactRouteGrid,
  Icon,
  ScreenHeader,
  SectionHeader,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useFeatureControls } from '@/features/availability/useFeatureControls';

export default function GeneralToolsScreen() {
  const insets = useSafeAreaInsets();
  const {
    mode,
    accessReady,
    hasOrganizationCapability,
    hasPublicCapability,
  } = useSession();
  const { preference, setPreference, colors } = useTheme();
  const features = useFeatureControls();

  const hasPublicBroadcastAccess = hasPublicCapability('public.live_stream.create');
  const hasLeadershipAccess = mode === 'authenticated' && accessReady && (
    hasPublicBroadcastAccess ||
    hasOrganizationCapability('organization.leadership.manage') ||
    hasOrganizationCapability('posts.create') ||
    hasOrganizationCapability('posts.publish') ||
    hasOrganizationCapability('media.upload') ||
    hasOrganizationCapability('sermons.create') ||
    hasOrganizationCapability('sermons.manage') ||
    hasOrganizationCapability('events.create') ||
    hasOrganizationCapability('events.update') ||
    hasOrganizationCapability('polls.manage') ||
    hasOrganizationCapability('prayer.moderate') ||
    hasOrganizationCapability('giving.campaigns.manage') ||
    hasOrganizationCapability('giving.finance.read')
  );

  const createItems = mode === 'authenticated' ? [
    features.isEnabled('social_community_feed') && features.isEnabled('general_posting') ? {
      key: 'post',
      label: 'Post',
      icon: 'create-outline',
      description: 'Create a General COT post.',
      onPress: () => router.push({ pathname: '/general/community', params: { compose: 'post', intentId: String(Date.now()) } } as any),
    } : null,
    features.isEnabled('social_community_feed') && features.isEnabled('general_posting') && features.isEnabled('voice_posts') ? {
      key: 'voice',
      label: 'Voice',
      icon: 'mic-outline',
      description: 'Record and publish audio.',
      onPress: () => router.push({ pathname: '/general/community', params: { compose: 'audio', intentId: String(Date.now()) } } as any),
    } : null,
    features.isEnabled('social_community_feed') && features.isEnabled('general_posting') && features.isEnabled('reels') ? {
      key: 'reel',
      label: 'Reel',
      icon: 'flash-outline',
      description: 'Create a public Reel.',
      onPress: () => router.push('/general/studio/reel'),
    } : null,
    features.isEnabled('social_community_feed') && features.isEnabled('general_posting') && features.isEnabled('long_form_video') ? {
      key: 'video',
      label: 'Video',
      icon: 'videocam-outline',
      description: 'Publish a long-form video.',
      onPress: () => router.push('/general/studio/video'),
    } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; icon: string; description: string; onPress: () => void }> : [];

  const cotItems = [
    mode === 'authenticated' && features.isEnabled('direct_messages') ? {
      key: 'messages',
      label: 'Messages',
      icon: 'chatbubbles-outline',
      description: 'Private direct messages across COT.',
      onPress: () => router.push('/general/chat'),
    } : null,
    mode === 'authenticated' && features.isEnabled('groups') ? {
      key: 'groups',
      label: 'Groups',
      icon: 'people-circle-outline',
      description: 'Church-wide groups and discussions.',
      onPress: () => router.push('/general/groups' as any),
    } : null,
    features.isEnabled('live_streaming') && features.isEnabled('general_live') ? {
      key: 'live',
      label: 'Live',
      icon: 'radio-outline',
      description: 'Current and upcoming broadcasts.',
      onPress: () => router.push('/general/live' as any),
    } : null,
    features.isEnabled('library_books') ? {
      key: 'library',
      label: 'Library',
      icon: 'library-outline',
      description: 'Browse books, authors and continue reading.',
      onPress: () => router.push('/general/library' as any),
    } : null,
    features.isEnabled('devotionals') ? {
      key: 'devotional',
      label: 'Devotional',
      icon: 'sunny-outline',
      description: 'Open the daily devotional by year, month and day.',
      onPress: () => router.push('/general/devotional' as any),
    } : null,
    features.isEnabled('bible') ? {
      key: 'bible',
      label: 'Bible',
      icon: 'book-outline',
      description: 'Read, listen, search, save Scripture and follow reading plans.',
      onPress: () => router.push('/general/bible' as any),
    } : null,
    features.isEnabled('locations') ? {
      key: 'location',
      label: 'Location',
      icon: 'location-outline',
      description: 'Official church location.',
      onPress: () => router.push('/general/location' as any),
    } : null,
    mode === 'authenticated' && features.isEnabled('polls_giveaways') ? {
      key: 'participate',
      label: 'Polls',
      icon: 'stats-chart-outline',
      description: 'Polls and giveaways.',
      onPress: () => router.push('/general/participate' as any),
    } : null,
    mode === 'authenticated' && features.isEnabled('bookmarks') ? {
      key: 'saved',
      label: 'Saved',
      icon: 'bookmark-outline',
      description: 'Saved posts and media.',
      onPress: () => router.push('/general/saved'),
    } : null,
    features.isEnabled('prayer_request_ministry') ? {
      key: 'prayer',
      label: 'Prayer',
      icon: 'heart-outline',
      description: 'Prayer wall and private petitions.',
      onPress: () => router.push('/general/prayer'),
    } : null,
    features.isEnabled('giving') ? {
      key: 'giving',
      label: 'Giving',
      icon: 'gift-outline',
      description: 'Giving destinations and receipts.',
      onPress: () => router.push('/general/giving'),
    } : null,
    mode === 'authenticated' && features.isEnabled('expressions') ? {
      key: 'expressions',
      label: 'Expressions',
      icon: 'business-outline',
      description: 'Open or join Expression spaces.',
      onPress: () => router.push('/expressions'),
    } : null,
    mode === 'authenticated' && features.isEnabled('cot_assistant') ? {
      key: 'assistant',
      label: 'Assistant',
      icon: 'sparkles',
      description: 'COT Assistant.',
      onPress: () => router.push('/general/assistant'),
    } : null,
    mode === 'authenticated' && hasLeadershipAccess ? {
      key: 'ministry',
      label: 'Ministry',
      icon: 'construct-outline',
      description: 'Ministry tools available to your account.',
      onPress: () => router.push('/general/leadership'),
    } : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: string;
    description: string;
    onPress: () => void;
  }>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <ScreenHeader title="Tools" showBack compact />

        {mode === 'authenticated' ? (
          <View style={styles.section}>
            <SectionHeader title="Create" compact />
            <CompactRouteGrid
              compact
              items={createItems.map((item) => ({
                key: item.key,
                label: item.label,
                icon: item.icon,
                accessibilityLabel: `${item.label}. ${item.description}`,
                onPress: item.onPress,
              }))}
            />
          </View>
        ) : (
          <View style={[styles.signInCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.signInIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="person-add-outline" size={21} color={colors.interactive} />
            </View>
            <Text style={[styles.signInTitle, { color: colors.text }]}>Sign in for member tools</Text>
            <Button
              label="Sign in"
              variant="primary"
              size="sm"
              onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/tools' } } as any)}
            />
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title="COT" compact />
          <CompactRouteGrid
            compact
            items={cotItems.map((item) => ({
              key: item.key,
              label: item.label,
              icon: item.icon,
              accessibilityLabel: `${item.label}. ${item.description}`,
              onPress: item.onPress,
            }))}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Account" compact />
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            {mode === 'authenticated' ? (
              <>
                <Pressable onPress={() => router.push('/general/settings')} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
                  <View style={[styles.settingsIcon, { backgroundColor: colors.bgSecondary }]}><Icon name="person-circle-outline" size={19} color={colors.text} /></View>
                  <Text style={[styles.settingsTitle, { color: colors.text }]}>Profile & privacy</Text>
                  <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
                <View style={[styles.settingsDivider, { backgroundColor: colors.borderSubtle }]} />
                {features.isEnabled('notifications') && features.isEnabled('in_app_notifications') ? (
                  <>
                    <Pressable onPress={() => router.push('/general/notifications')} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
                      <View style={[styles.settingsIcon, { backgroundColor: colors.bgSecondary }]}><Icon name="notifications-outline" size={19} color={colors.text} /></View>
                      <Text style={[styles.settingsTitle, { color: colors.text }]}>Notifications</Text>
                      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                    <View style={[styles.settingsDivider, { backgroundColor: colors.borderSubtle }]} />
                  </>
                ) : null}
                <Pressable onPress={() => router.push('/general/notification-settings')} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
                  <View style={[styles.settingsIcon, { backgroundColor: colors.bgSecondary }]}><Icon name="options-outline" size={19} color={colors.text} /></View>
                  <Text style={[styles.settingsTitle, { color: colors.text }]}>Notification preferences</Text>
                  <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              </>
            ) : null}

            <View style={[styles.appearanceBlock, mode === 'authenticated' && { borderTopColor: colors.borderSubtle, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.appearanceHeading}>
                <View style={[styles.settingsIcon, { backgroundColor: colors.bgSecondary }]}><Icon name="color-palette-outline" size={19} color={colors.text} /></View>
                <Text style={[styles.settingsTitle, { color: colors.text }]}>Appearance</Text>
              </View>
              <View style={styles.themeRow}>
                <Chip label="System" selected={preference === 'system'} onPress={() => setPreference('system')} />
                <Chip label="Light" selected={preference === 'light'} onPress={() => setPreference('light')} />
                <Chip label="Dark" selected={preference === 'dark'} onPress={() => setPreference('dark')} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.md, gap: spacing.lg },
  section: { gap: spacing.sm },
  signInCard: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  signInIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  signInTitle: { flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: '800' },
  settingsCard: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  settingsRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  settingsIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingsTitle: { flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: '800' },
  settingsDivider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  appearanceBlock: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  appearanceHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingLeft: 46 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
});
