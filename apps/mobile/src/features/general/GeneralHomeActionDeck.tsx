import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type Props = {
  onComposePost: () => void;
  onComposeVoice: () => void;
};

type QuickAction = { key: string; label: string; hint: string; icon: string; route: string };
type MinistryAction = { key: string; label: string; icon: string; route: string };

function ActionTile({ action, compact = false }: { action: QuickAction; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(action.route as any)}
      accessibilityRole="button"
      style={({ pressed }) => [
        compact ? styles.quickTileCompact : styles.quickTile,
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}><Icon name={action.icon as any} size={18} color={colors.interactive} /></View>
      <View style={styles.flex}><Text style={[styles.quickLabel, { color: colors.text }]}>{action.label}</Text><Text numberOfLines={1} style={[styles.quickHint, { color: colors.textMuted }]}>{action.hint}</Text></View>
      {!compact ? <Icon name="arrow-forward" size={14} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

export function GeneralHomeActionDeck({ onComposePost, onComposeVoice }: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { context, mode, hasOrganizationCapability, hasPublicCapability } = useSession();
  const authenticated = mode === 'authenticated';
  const displayName = context?.profile?.display_name?.trim() || '';
  const firstName = displayName.split(/\s+/).filter(Boolean)[0] || 'there';
  const wide = width >= 760;

  const quickActions = useMemo<QuickAction[]>(() => [
    { key: 'sermons', label: 'Sermons', hint: 'Messages & study', icon: 'book-outline', route: '/general/sermons' },
    { key: 'events', label: 'Events', hint: 'Gatherings & dates', icon: 'calendar-outline', route: '/general/events' },
    { key: 'prayer', label: 'Prayer', hint: 'Pray or ask for prayer', icon: 'heart-outline', route: '/general/prayer' },
    { key: 'giving', label: 'Giving', hint: 'Give & view records', icon: 'gift-outline', route: '/general/giving' },
  ], []);

  const ministryActions = useMemo<MinistryAction[]>(() => {
    if (!authenticated) return [];
    const actions: MinistryAction[] = [];
    if (hasOrganizationCapability('sermons.create') || hasOrganizationCapability('sermons.manage')) actions.push({ key: 'sermons', label: 'Sermons', icon: 'book-outline', route: '/general/leadership/sermons-manage' });
    if (hasOrganizationCapability('events.create') || hasOrganizationCapability('events.update')) actions.push({ key: 'events', label: 'Events', icon: 'calendar-outline', route: '/general/leadership/events-manage' });
    if (hasOrganizationCapability('announcements.manage')) actions.push({ key: 'announcements', label: 'Announcements', icon: 'megaphone-outline', route: '/general/leadership/announcements-manage' });
    if (hasOrganizationCapability('prayer.moderate') || hasOrganizationCapability('pastoral.followups.receive')) actions.push({ key: 'care', label: 'Care inbox', icon: 'heart-circle-outline', route: '/general/leadership/pastoral-triage' });
    if (hasOrganizationCapability('giving.campaigns.manage') || hasOrganizationCapability('giving.finance.read')) actions.push({ key: 'giving', label: 'Giving', icon: 'wallet-outline', route: '/general/leadership/giving-manage' });
    if (hasOrganizationCapability('organization.leadership.manage')) actions.push({ key: 'leadership', label: 'Leadership', icon: 'people-circle-outline', route: '/general/leadership/church-leadership' });
    if (hasPublicCapability('public.live_stream.create')) actions.push({ key: 'media', label: 'Media studio', icon: 'radio-outline', route: '/general/leadership/media-studio' });
    return actions;
  }, [authenticated, hasOrganizationCapability, hasPublicCapability]);

  return (
    <View style={styles.root}>
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
        <View style={[styles.heroGlow, { backgroundColor: colors.primarySoft }]} />
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <Text style={[styles.kicker, { color: colors.interactive }]}>GENERAL COMMUNITY</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>{authenticated ? `Good to see you, ${firstName}.` : 'Welcome to City of Transformation.'}</Text>
            <Text style={[styles.heroCopy, { color: colors.textSecondary }]}>{authenticated ? 'Catch up, discover what matters, and move into the right action without hunting through the app.' : 'Explore sermons, events, prayer, media and the public life of COT.'}</Text>
          </View>
          {authenticated ? <View style={[styles.heroAvatar, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Avatar url={context?.profile?.avatar_url} name={displayName || 'COT member'} size="md" /></View> : null}
        </View>

        {authenticated ? (
          <View style={styles.composerRow}>
            <Pressable onPress={onComposePost} style={({ pressed }) => [styles.composePrimary, { backgroundColor: colors.text }, pressed && styles.pressed]} accessibilityRole="button">
              <Icon name="create-outline" size={17} color={colors.bg} />
              <Text style={[styles.composePrimaryText, { color: colors.bg }]}>Share something</Text>
            </Pressable>
            <Pressable onPress={onComposeVoice} style={({ pressed }) => [styles.composeSecondary, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]} accessibilityRole="button">
              <Icon name="mic-outline" size={17} color={colors.interactive} />
              <Text style={[styles.composeSecondaryText, { color: colors.text }]}>Voice</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/general/studio' as any)} style={({ pressed }) => [styles.composeSecondary, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]} accessibilityRole="button">
              <Icon name="add-outline" size={18} color={colors.interactive} />
              <Text style={[styles.composeSecondaryText, { color: colors.text }]}>Create</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.composerRow}>
            <Pressable onPress={() => router.push('/(auth)/login' as any)} style={({ pressed }) => [styles.composePrimary, { backgroundColor: colors.text }, pressed && styles.pressed]}><Text style={[styles.composePrimaryText, { color: colors.bg }]}>Sign in to participate</Text><Icon name="arrow-forward" size={16} color={colors.bg} /></Pressable>
          </View>
        )}
      </View>

      <View style={[styles.quickGrid, wide && styles.quickGridWide]}>
        {quickActions.map((action) => <ActionTile key={action.key} action={action} compact={!wide} />)}
      </View>

      {ministryActions.length ? (
        <View style={[styles.ministryCard, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
          <View style={styles.ministryHeader}>
            <View style={styles.flex}><Text style={[styles.ministryKicker, { color: colors.interactive }]}>YOUR MINISTRY ACCESS</Text><Text style={[styles.ministryTitle, { color: colors.text }]}>Create and manage</Text><Text style={[styles.ministryCopy, { color: colors.textMuted }]}>Only tools your current permissions allow are shown here.</Text></View>
            <Pressable onPress={() => router.push('/general/leadership' as any)} style={({ pressed }) => [styles.manageAll, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}><Text style={[styles.manageAllText, { color: colors.text }]}>Workspace</Text><Icon name="arrow-forward" size={14} color={colors.interactive} /></Pressable>
          </View>
          <View style={styles.ministryActions}>
            {ministryActions.slice(0, wide ? 7 : 5).map((action) => (
              <Pressable key={action.key} onPress={() => router.push(action.route as any)} style={({ pressed }) => [styles.ministryAction, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed]}>
                <Icon name={action.icon as any} size={16} color={colors.interactive} />
                <Text style={[styles.ministryActionText, { color: colors.text }]} numberOfLines={1}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md }, flex: { flex: 1, minWidth: 0 },
  hero: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, gap: spacing.lg },
  heroGlow: { position: 'absolute', width: 230, height: 230, borderRadius: 115, right: -90, top: -120, opacity: 0.95 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  kicker: { fontSize: 9.5, lineHeight: 13, fontWeight: '900', letterSpacing: 1.05 },
  heroTitle: { fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: -0.75, marginTop: 5, maxWidth: 600 },
  heroCopy: { fontSize: 13, lineHeight: 20, marginTop: 6, maxWidth: 620 },
  heroAvatar: { borderWidth: 1, width: 54, height: 54, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  composerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  composePrimary: { minHeight: 44, borderRadius: radius.pill, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  composePrimaryText: { fontSize: 12, fontWeight: '900' },
  composeSecondary: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  composeSecondaryText: { fontSize: 11.5, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickGridWide: { flexWrap: 'nowrap' },
  quickTile: { flex: 1, minWidth: 155, minHeight: 68, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quickTileCompact: { width: '48%', flexGrow: 1, minHeight: 64, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quickIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12.5, lineHeight: 17, fontWeight: '900' },
  quickHint: { fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  ministryCard: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.md, gap: spacing.md },
  ministryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ministryKicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  ministryTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.3, marginTop: 2 },
  ministryCopy: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  manageAll: { minHeight: 38, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 5 },
  manageAllText: { fontSize: 10.5, fontWeight: '800' },
  ministryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  ministryAction: { minHeight: 38, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ministryActionText: { fontSize: 10.5, fontWeight: '800', maxWidth: 130 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
