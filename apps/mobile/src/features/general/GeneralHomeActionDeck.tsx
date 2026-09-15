import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BottomSheet, Icon } from '@/components';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Props = { onComposePost: () => void; onComposeVoice: () => void };
type QuickAction = { key: string; label: string; icon: string; route: string };
type CreateChoice = { key: string; title: string; subtitle: string; icon: string; onPress: () => void };

export function GeneralHomeActionDeck({ onComposePost, onComposeVoice }: Props) {
  const { colors } = useTheme();
  const { mode, hasOrganizationCapability, hasPublicCapability } = useSession();
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
        <View style={[styles.feedIntro, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={[styles.feedIcon, { backgroundColor: colors.primarySoft }]}><Icon name="layers-outline" size={20} color={colors.interactive} /></View>
          <View style={styles.flex}>
            <Text style={[styles.kicker, { color: colors.interactive }]}>YOUR COT FEED</Text>
            <Text style={[styles.title, { color: colors.text }]}>Everything happening in General COT</Text>
            <Text style={[styles.copy, { color: colors.textMuted }]}>Posts, sermons, events, announcements, Reels and videos are layered below in one feed.</Text>
          </View>
          {hasMinistryAccess ? <Pressable onPress={() => router.push('/general/leadership' as any)} style={[styles.workspaceButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]} accessibilityRole="button"><Icon name="shield-checkmark-outline" size={17} color={colors.interactive} /><Text style={[styles.workspaceText, { color: colors.text }]}>Ministry</Text></Pressable> : null}
        </View>

        <View style={styles.actionRow}>
          {authenticated ? <>
            <Pressable onPress={onComposePost} style={({ pressed }) => [styles.primaryAction, { backgroundColor: colors.text }, pressed && styles.pressed]}><Icon name="create-outline" size={16} color={colors.bg} /><Text style={[styles.primaryText, { color: colors.bg }]}>Share</Text></Pressable>
            <Pressable onPress={onComposeVoice} style={({ pressed }) => [styles.secondaryAction, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}><Icon name="mic-outline" size={16} color={colors.interactive} /><Text style={[styles.secondaryText, { color: colors.text }]}>Voice</Text></Pressable>
            <Pressable onPress={() => setCreateOpen(true)} style={({ pressed }) => [styles.secondaryAction, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}><Icon name="add-outline" size={17} color={colors.interactive} /><Text style={[styles.secondaryText, { color: colors.text }]}>Create</Text></Pressable>
          </> : <Pressable onPress={() => router.push('/(auth)/login' as any)} style={({ pressed }) => [styles.primaryAction, { backgroundColor: colors.text }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: colors.bg }]}>Sign in to participate</Text><Icon name="arrow-forward" size={15} color={colors.bg} /></Pressable>}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRail}>
          {quickActions.map((action) => <Pressable key={action.key} onPress={() => router.push(action.route as any)} style={({ pressed }) => [styles.quickPill, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}><View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}><Icon name={action.icon as any} size={15} color={colors.interactive} /></View><Text style={[styles.quickLabel, { color: colors.text }]}>{action.label}</Text></Pressable>)}
        </ScrollView>

        <BottomSheet visible={createOpen} onClose={() => setCreateOpen(false)} title="Create" subtitle="Choose a focused format" maxHeightPercent={78}>
          <View style={styles.createSheet}>
            {createChoices.map((choice) => <Pressable key={choice.key} onPress={choice.onPress} style={({ pressed }) => [styles.createChoice, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}><View style={[styles.createIcon, { backgroundColor: colors.primarySoft }]}><Icon name={choice.icon as any} size={19} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.createTitle, { color: colors.text }]}>{choice.title}</Text><Text style={[styles.createCopy, { color: colors.textMuted }]}>{choice.subtitle}</Text></View><Icon name="chevron-forward" size={16} color={colors.textMuted} /></Pressable>)}
          </View>
        </BottomSheet>
      </View>
    </TourAnchor>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm }, flex: { flex: 1, minWidth: 0 },
  feedIntro: { minHeight: 104, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feedIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 16.5, lineHeight: 21, fontWeight: '900', letterSpacing: -0.3, marginTop: 2 },
  copy: { fontSize: 10.5, lineHeight: 15, marginTop: 2, maxWidth: 620 },
  workspaceButton: { minHeight: 38, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5 }, workspaceText: { fontSize: 10, fontWeight: '800' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  primaryAction: { minHeight: 39, borderRadius: radius.pill, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 6 }, primaryText: { fontSize: 10.8, fontWeight: '900' },
  secondaryAction: { minHeight: 39, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 }, secondaryText: { fontSize: 10.5, fontWeight: '800' },
  quickRail: { gap: spacing.xs, paddingRight: spacing.md },
  quickPill: { minHeight: 40, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, quickLabel: { fontSize: 10.5, fontWeight: '800' },
  createSheet: { gap: spacing.xs }, createChoice: { minHeight: 66, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, createIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, createTitle: { fontSize: 13, fontWeight: '900' }, createCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
