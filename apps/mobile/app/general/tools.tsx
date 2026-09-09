import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  Chip,
  Icon,
  ScreenHeader,
  SectionHeader,
} from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type ToolTileProps = {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: string;
};

export default function GeneralToolsScreen() {
  const insets = useSafeAreaInsets();
  const {
    mode,
    accessReady,
    hasOrganizationCapability,
    hasPublicCapability,
  } = useSession();
  const { preference, setPreference, colors } = useTheme();

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
    hasOrganizationCapability('prayer.moderate') ||
    hasOrganizationCapability('giving.campaigns.manage') ||
    hasOrganizationCapability('giving.finance.read')
  );

  const toolTile = ({ icon, title, subtitle, onPress, badge }: ToolTileProps) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolTile,
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
        shadows.sm,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.toolIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={20} color={colors.interactive} />
      </View>
      <View style={styles.toolCopy}>
        <View style={styles.toolTitleRow}>
          <Text style={[styles.toolTitle, { color: colors.text }]}>{title}</Text>
          {badge ? <Badge label={badge} variant="primary" /> : null}
        </View>
        <Text style={[styles.toolSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + 120,
          },
        ]}
      >
        <ScreenHeader
          title="General COT"
          kicker="TOOLS & SETTINGS"
          subtitle="Create, connect and manage your COT experience from one simple place."
          showBack
        />

        {mode === 'authenticated' ? (
          <View style={styles.section}>
            <SectionHeader title="Create" subtitle="Share to the public General COT space" />
            <View style={[styles.createRail, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
              {[
                ['create-outline', 'Post', () => router.push({ pathname: '/general/community', params: { compose: 'post', intentId: String(Date.now()) } } as any)],
                ['mic-outline', 'Voice', () => router.push({ pathname: '/general/community', params: { compose: 'audio', intentId: String(Date.now()) } } as any)],
                ['flash-outline', 'Reel', () => router.push('/general/studio/reel')],
                ['videocam-outline', 'Video', () => router.push('/general/studio/video')],
              ].map(([icon, label, onPress]) => (
                <Pressable
                  key={label as string}
                  onPress={onPress as () => void}
                  style={({ pressed }) => [styles.createAction, pressed && styles.pressed]}
                >
                  <View style={[styles.createIcon, { backgroundColor: colors.primarySoft }]}>
                    <Icon name={icon as string} size={19} color={colors.interactive} />
                  </View>
                  <Text style={[styles.createLabel, { color: colors.text }]}>{label as string}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={[styles.signInCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.signInIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="person-add-outline" size={22} color={colors.interactive} />
            </View>
            <View style={styles.signInCopy}>
              <Text style={[styles.signInTitle, { color: colors.text }]}>Sign in for your COT tools</Text>
              <Text style={[styles.signInText, { color: colors.textSecondary }]}>
                Public content stays open. Sign in to create, message, save and manage your account.
              </Text>
            </View>
            <Button
              label="Sign in"
              variant="primary"
              size="sm"
              onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/tools' } } as any)}
            />
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title="COT tools" subtitle="Everything useful without crowding Home" />
          <View style={styles.toolsGrid}>
            {mode === 'authenticated' ? toolTile({
              icon: 'chatbubbles-outline',
              title: 'Messages',
              subtitle: 'Private direct messages across COT',
              onPress: () => router.push('/general/chat'),
            }) : null}
            {toolTile({
              icon: 'radio-outline',
              title: 'Live',
              subtitle: 'Watch current and upcoming broadcasts',
              onPress: () => router.push('/general/live' as any),
            })}
            {mode === 'authenticated' ? toolTile({
              icon: 'bookmark-outline',
              title: 'Saved',
              subtitle: 'Posts, Reels, videos and sermons you kept',
              onPress: () => router.push('/general/saved'),
            }) : null}
            {toolTile({
              icon: 'heart-outline',
              title: 'Prayer',
              subtitle: 'Prayer wall and private petitions',
              onPress: () => router.push('/general/prayer'),
            })}
            {toolTile({
              icon: 'gift-outline',
              title: 'Giving',
              subtitle: 'Giving destinations, receipts and statements',
              onPress: () => router.push('/general/giving'),
            })}
            {mode === 'authenticated' ? toolTile({
              icon: 'business-outline',
              title: 'Expressions',
              subtitle: 'Open or join your private church spaces',
              onPress: () => router.push('/expressions'),
            }) : null}
            {mode === 'authenticated' ? toolTile({
              icon: 'sparkles',
              title: 'COT Assistant',
              subtitle: 'Ask for help navigating COT and church resources',
              onPress: () => router.push('/general/assistant'),
            }) : null}
            {mode === 'authenticated' && hasLeadershipAccess ? toolTile({
              icon: 'construct-outline',
              title: 'Ministry tools',
              subtitle: 'The ministry tools available to your account',
              badge: 'MINISTRY',
              onPress: () => router.push('/general/leadership'),
            }) : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Account & settings" subtitle="Keep account controls together" />
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            {mode === 'authenticated' ? (
              <>
                <Pressable onPress={() => router.push('/general/settings')} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
                  <View style={[styles.settingsIcon, { backgroundColor: colors.bgSecondary }]}>
                    <Icon name="person-circle-outline" size={19} color={colors.text} />
                  </View>
                  <View style={styles.settingsCopy}>
                    <Text style={[styles.settingsTitle, { color: colors.text }]}>Profile & privacy</Text>
                    <Text style={[styles.settingsSubtitle, { color: colors.textSecondary }]}>Identity, banner, birthday privacy and contact</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
                <View style={[styles.settingsDivider, { backgroundColor: colors.borderSubtle }]} />
                <Pressable onPress={() => router.push('/general/notifications')} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
                  <View style={[styles.settingsIcon, { backgroundColor: colors.bgSecondary }]}>
                    <Icon name="notifications-outline" size={19} color={colors.text} />
                  </View>
                  <View style={styles.settingsCopy}>
                    <Text style={[styles.settingsTitle, { color: colors.text }]}>Notifications</Text>
                    <Text style={[styles.settingsSubtitle, { color: colors.textSecondary }]}>Inbox, invitations and activity</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
                <View style={[styles.settingsDivider, { backgroundColor: colors.borderSubtle }]} />
                <Pressable onPress={() => router.push('/general/notification-settings')} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
                  <View style={[styles.settingsIcon, { backgroundColor: colors.bgSecondary }]}>
                    <Icon name="options-outline" size={19} color={colors.text} />
                  </View>
                  <View style={styles.settingsCopy}>
                    <Text style={[styles.settingsTitle, { color: colors.text }]}>Notification preferences</Text>
                    <Text style={[styles.settingsSubtitle, { color: colors.textSecondary }]}>Choose what COT should notify you about</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              </>
            ) : null}

            <View style={[styles.appearanceBlock, mode === 'authenticated' && { borderTopColor: colors.borderSubtle, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.appearanceHeading}>
                <View style={[styles.settingsIcon, { backgroundColor: colors.bgSecondary }]}>
                  <Icon name="color-palette-outline" size={19} color={colors.text} />
                </View>
                <View style={styles.settingsCopy}>
                  <Text style={[styles.settingsTitle, { color: colors.text }]}>Appearance</Text>
                  <Text style={[styles.settingsSubtitle, { color: colors.textSecondary }]}>Choose how COT looks on this device</Text>
                </View>
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
  content: { flexGrow: 1, paddingHorizontal: spacing.md, gap: spacing.xl },
  section: { gap: spacing.sm },
  createRail: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, flexDirection: 'row', gap: spacing.xs },
  createAction: { flex: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.lg },
  createIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  createLabel: { fontSize: 11, fontWeight: '800' },
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toolTile: { width: '48%', minHeight: 116, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  toolIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolCopy: { flex: 1, gap: 3 },
  toolTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  toolTitle: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  toolSubtitle: { fontSize: 11, lineHeight: 16 },
  signInCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  signInIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  signInCopy: { flex: 1, minWidth: 0 },
  signInTitle: { fontSize: 14, fontWeight: '800' },
  signInText: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  settingsCard: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  settingsRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  settingsIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  settingsCopy: { flex: 1, minWidth: 0 },
  settingsTitle: { fontSize: 13.5, fontWeight: '800' },
  settingsSubtitle: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  settingsDivider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  appearanceBlock: { padding: spacing.md, gap: spacing.sm },
  appearanceHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingLeft: 48 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
});
