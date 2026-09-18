import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, BottomSheet, Icon } from '@/components';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Props = { onComposePost: () => void; onComposeVoice: () => void };
type QuickAction = { key: string; label: string; icon: string; route: string };
type CreateChoice = { key: string; title: string; subtitle: string; icon: string; onPress: () => void };

export function GeneralHomeActionDeck({ onComposePost, onComposeVoice }: Props) {
  const { colors } = useTheme();
  const { mode, context, hasOrganizationCapability, hasPublicCapability } = useSession();
  const [createOpen, setCreateOpen] = useState(false);
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
    { key: 'post', title: 'Post', subtitle: 'Text, photo, video or file.', icon: 'create-outline', onPress: () => { setCreateOpen(false); onComposePost(); } },
    { key: 'voice', title: 'Voice update', subtitle: 'Record or attach audio.', icon: 'mic-outline', onPress: () => { setCreateOpen(false); onComposeVoice(); } },
    { key: 'reel', title: 'Reel', subtitle: 'Short public video.', icon: 'flash-outline', onPress: () => { setCreateOpen(false); router.push('/general/studio/reel' as any); } },
    { key: 'video', title: 'Video', subtitle: 'Long-form public video.', icon: 'videocam-outline', onPress: () => { setCreateOpen(false); router.push('/general/studio/video' as any); } },
  ], [onComposePost, onComposeVoice]);

  return (
    <TourAnchor targetKey="general.home.actions">
      <View style={styles.root}>
        <TourAnchor targetKey="general.home.feed">
          <View style={[styles.composerCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View pointerEvents="none" style={[styles.composerGlow, { backgroundColor: colors.primarySoft }]} />
            <View style={styles.composerTop}>
              <Avatar
                url={context?.profile?.avatar_url}
                name={context?.profile?.display_name || 'COT member'}
                size="md"
              />
              {authenticated ? (
                <Pressable
                  onPress={onComposePost}
                  style={({ pressed }) => [styles.promptButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Create a General COT post"
                >
                  <Text style={[styles.promptText, { color: colors.textSecondary }]}>Share something with General COT…</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => router.push('/(auth)/login' as any)}
                  style={({ pressed }) => [styles.promptButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
                >
                  <Text style={[styles.promptText, { color: colors.textSecondary }]}>Sign in to join the conversation</Text>
                </Pressable>
              )}
              {hasMinistryAccess ? (
                <Pressable
                  onPress={() => router.push('/general/leadership' as any)}
                  style={({ pressed }) => [styles.ministryButton, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Open Ministry tools"
                >
                  <Icon name="shield-checkmark-outline" size={18} color={colors.interactive} />
                </Pressable>
              ) : null}
            </View>

            <View style={[styles.composerDivider, { backgroundColor: colors.borderSubtle }]} />

            <View style={styles.actionRow}>
              {authenticated ? (
                <>
                  <Pressable onPress={onComposePost} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                    <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}><Icon name="create-outline" size={17} color={colors.interactive} /></View>
                    <Text style={[styles.actionText, { color: colors.text }]}>Post</Text>
                  </Pressable>
                  <Pressable onPress={onComposeVoice} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                    <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}><Icon name="mic-outline" size={17} color={colors.interactive} /></View>
                    <Text style={[styles.actionText, { color: colors.text }]}>Voice</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push('/general/studio/reel' as any)} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                    <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}><Icon name="flash-outline" size={17} color={colors.interactive} /></View>
                    <Text style={[styles.actionText, { color: colors.text }]}>Reel</Text>
                  </Pressable>
                  <Pressable onPress={() => setCreateOpen(true)} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                    <View style={[styles.actionIcon, { backgroundColor: colors.bgSecondary }]}><Icon name="add" size={18} color={colors.textSecondary} /></View>
                    <Text style={[styles.actionText, { color: colors.text }]}>More</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => router.push('/(auth)/login' as any)} style={({ pressed }) => [styles.signInAction, { backgroundColor: colors.text }, pressed && styles.pressed]}>
                  <Text style={[styles.signInText, { color: colors.bg }]}>Sign in to participate</Text>
                  <Icon name="arrow-forward" size={15} color={colors.bg} />
                </Pressable>
              )}
            </View>
          </View>
        </TourAnchor>

        <View style={styles.quickHeading}>
          <Text style={[styles.quickHeadingTitle, { color: colors.text }]}>Explore COT</Text>
          <Text style={[styles.quickHeadingMeta, { color: colors.textMuted }]}>Church life, one tap away</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRail}>
          {quickActions.map((action) => (
            <Pressable key={action.key} onPress={() => router.push(action.route as any)} style={({ pressed }) => [styles.quickPill, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}>
              <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}><Icon name={action.icon as any} size={16} color={colors.interactive} /></View>
              <Text style={[styles.quickLabel, { color: colors.text }]}>{action.label}</Text>
              <Icon name="chevron-forward" size={13} color={colors.textMuted} />
            </Pressable>
          ))}
        </ScrollView>

        <BottomSheet visible={createOpen} onClose={() => setCreateOpen(false)} title="Create" subtitle="Choose what you want to share" maxHeightPercent={78}>
          <View style={styles.createSheet}>
            {createChoices.map((choice) => <Pressable key={choice.key} onPress={choice.onPress} style={({ pressed }) => [styles.createChoice, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}><View style={[styles.createIcon, { backgroundColor: colors.primarySoft }]}><Icon name={choice.icon as any} size={19} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.createTitle, { color: colors.text }]}>{choice.title}</Text><Text style={[styles.createCopy, { color: colors.textMuted }]}>{choice.subtitle}</Text></View><Icon name="chevron-forward" size={16} color={colors.textMuted} /></Pressable>)}
          </View>
        </BottomSheet>
      </View>
    </TourAnchor>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  composerCard: { minHeight: 124, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.md, overflow: 'hidden' },
  composerGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -88, top: -112, opacity: 0.65 },
  composerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  promptButton: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, justifyContent: 'center' },
  promptText: { fontSize: 12.5, lineHeight: 17, fontWeight: '700' },
  ministryButton: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  composerDivider: { height: StyleSheet.hairlineWidth, marginTop: spacing.md, marginBottom: spacing.xs },
  actionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  actionButton: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.lg },
  actionIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 10.5, fontWeight: '900' },
  signInAction: { minHeight: 44, borderRadius: radius.pill, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  signInText: { fontSize: 11, fontWeight: '900' },
  quickHeading: { marginTop: 2, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: 2 },
  quickHeadingTitle: { fontSize: 13, fontWeight: '900', letterSpacing: -0.2 },
  quickHeadingMeta: { fontSize: 9.5, fontWeight: '700' },
  quickRail: { gap: spacing.xs, paddingRight: spacing.md, paddingBottom: 2 },
  quickPill: { minHeight: 44, borderWidth: 1, borderRadius: 16, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 10.5, fontWeight: '900' },
  createSheet: { gap: spacing.xs },
  createChoice: { minHeight: 66, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  createIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  createTitle: { fontSize: 13, fontWeight: '900' },
  createCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});