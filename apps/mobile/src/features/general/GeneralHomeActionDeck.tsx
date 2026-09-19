import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Icon } from '@/components';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Props = { onComposePost: () => void; onComposeVoice: () => void };
type QuickAction = { key: string; label: string; icon: string; route: string };
type CreateChoice = { key: string; label: string; icon: string; onPress: () => void };

export function GeneralHomeActionDeck({ onComposePost, onComposeVoice }: Props) {
  const { colors } = useTheme();
  const { mode, context, hasOrganizationCapability, hasPublicCapability } = useSession();
  const [composerExpanded, setComposerExpanded] = useState(false);
  const authenticated = mode === 'authenticated';

  const quickActions = useMemo<QuickAction[]>(() => [
    { key: 'sermons', label: 'Sermons', icon: 'book-outline', route: '/general/sermons' },
    { key: 'events', label: 'Events', icon: 'calendar-outline', route: '/general/events' },
    { key: 'prayer', label: 'Prayer', icon: 'heart-outline', route: '/general/prayer' },
    { key: 'giving', label: 'Giving', icon: 'gift-outline', route: '/general/giving' },
  ], []);

  const hasMinistryAccess = authenticated && (
    hasOrganizationCapability('sermons.create') || hasOrganizationCapability('sermons.manage') ||
    hasOrganizationCapability('events.create') || hasOrganizationCapability('events.update') ||
    hasOrganizationCapability('announcements.manage') || hasOrganizationCapability('prayer.moderate') ||
    hasOrganizationCapability('pastoral.followups.receive') || hasOrganizationCapability('roles.read') ||
    hasOrganizationCapability('giving.campaigns.manage') || hasOrganizationCapability('organization.leadership.manage') ||
    hasPublicCapability('public.live_stream.create')
  );

  const createChoices = useMemo<CreateChoice[]>(() => [
    { key: 'post', label: 'Post', icon: 'create-outline', onPress: onComposePost },
    { key: 'voice', label: 'Voice', icon: 'mic-outline', onPress: onComposeVoice },
    { key: 'reel', label: 'Reel', icon: 'flash-outline', onPress: () => router.push('/general/studio/reel' as any) },
    { key: 'video', label: 'Video', icon: 'videocam-outline', onPress: () => router.push('/general/studio/video' as any) },
  ], [onComposePost, onComposeVoice]);

  const openCreate = (action: () => void) => {
    setComposerExpanded(false);
    action();
  };

  return (
    <TourAnchor targetKey="general.home.actions">
      <View style={styles.root}>
        <TourAnchor targetKey="general.home.feed">
          <View style={[styles.composerShell, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={styles.composerMain}>
              <Avatar
                url={context?.profile?.avatar_url}
                name={context?.profile?.display_name || 'COT member'}
                size="sm"
              />

              <Pressable
                onPress={() => authenticated ? setComposerExpanded((value) => !value) : router.push('/(auth)/login' as any)}
                style={({ pressed }) => [styles.prompt, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={authenticated ? 'Share with General COT' : 'Sign in to join General COT'}
              >
                <Text style={[styles.promptText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {authenticated ? 'Share something with General COT…' : 'Sign in to join the conversation'}
                </Text>
              </Pressable>

              {authenticated ? (
                <Pressable
                  onPress={() => setComposerExpanded((value) => !value)}
                  style={({ pressed }) => [
                    styles.plusButton,
                    { backgroundColor: composerExpanded ? colors.interactive : colors.primarySoft },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: composerExpanded }}
                  accessibilityLabel={composerExpanded ? 'Close create options' : 'Open create options'}
                >
                  <Icon name={composerExpanded ? 'close' : 'add'} size={22} color={composerExpanded ? '#FFFFFF' : colors.interactive} />
                </Pressable>
              ) : null}

              {hasMinistryAccess ? (
                <Pressable
                  onPress={() => router.push('/general/leadership' as any)}
                  style={({ pressed }) => [styles.ministryButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Open Ministry tools"
                >
                  <Icon name="shield-checkmark-outline" size={17} color={colors.interactive} />
                </Pressable>
              ) : null}
            </View>

            {authenticated && composerExpanded ? (
              <View style={[styles.createTray, { borderTopColor: colors.borderSubtle }]}>
                {createChoices.map((choice) => (
                  <Pressable
                    key={choice.key}
                    onPress={() => openCreate(choice.onPress)}
                    style={({ pressed }) => [styles.createChoice, pressed && styles.pressed]}
                  >
                    <View style={[styles.createIcon, { backgroundColor: colors.primarySoft }]}>
                      <Icon name={choice.icon as any} size={18} color={colors.interactive} />
                    </View>
                    <Text style={[styles.createLabel, { color: colors.text }]}>{choice.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </TourAnchor>

        <View style={styles.exploreBlock}>
          <View style={styles.quickHeading}>
            <Text style={[styles.quickHeadingTitle, { color: colors.text }]}>Explore COT</Text>
            <Text style={[styles.quickHeadingMeta, { color: colors.textMuted }]}>Church life</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRail}>
            {quickActions.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => router.push(action.route as any)}
                style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
              >
                <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
                  <Icon name={action.icon as any} size={18} color={colors.interactive} />
                </View>
                <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>{action.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </TourAnchor>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  composerShell: {
    borderWidth: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  composerMain: {
    minHeight: 64,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  prompt: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    justifyContent: 'center',
  },
  promptText: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ministryButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTray: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 8,
    gap: 2,
  },
  createChoice: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  createIcon: {
    width: 31,
    height: 31,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLabel: { fontSize: 10, fontWeight: '900' },
  exploreBlock: { gap: 6, paddingTop: 2 },
  quickHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  quickHeadingTitle: { fontSize: 12.5, fontWeight: '900', letterSpacing: -0.15 },
  quickHeadingMeta: { fontSize: 9, fontWeight: '700' },
  quickRail: { gap: spacing.md, paddingHorizontal: 2, paddingRight: spacing.lg, paddingBottom: 2 },
  quickAction: { minWidth: 52, alignItems: 'center', gap: 5 },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontSize: 9.5, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.975 }] },
});
