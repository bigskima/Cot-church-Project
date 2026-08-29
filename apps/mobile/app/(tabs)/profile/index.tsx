import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { Badge, Button, ScreenHeader, SectionHeader } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';

export default function ProfileScreen() {
  const { mode, context, permissions, signOut } = useSession();

  if (mode === 'visitor') {
    return (
      <View style={styles.visitorContainer}>
        <View style={styles.visitorIconCircle}>
          <Text style={styles.visitorIcon}>🕊️</Text>
        </View>
        <Text style={styles.visitorTitle}>Make this sanctuary your spiritual home</Text>
        <Text style={styles.visitorSubtitle}>
          Sign in to connect with your local church expression, spiritual groups, giving history, and pastoral care.
        </Text>
        <Button
          label="Sign In or Create Account"
          onPress={() => router.replace('/(auth)/login')}
          variant="primary"
          size="lg"
          style={{ width: '100%', maxWidth: 300, marginTop: spacing.lg }}
        />
      </View>
    );
  }

  const profile = context?.profile;
  const organization = context?.organizations?.[0];
  const expression = context?.expression;
  const hasLeadershipAccess = permissions.length > 0;

  const quickLinks = [
    { title: 'Prayer Wall & Requests', subtitle: 'Submit prayer & pastoral requests', icon: '🙏', route: '/(tabs)/profile/prayer' },
    { title: 'Giving & Statements', subtitle: 'Tithe, offerings, and tax receipts', icon: '🤍', route: '/(tabs)/profile/giving' },
    { title: 'My Church Expression', subtitle: expression?.name ?? 'Global Central Sanctuary', icon: '🏛️', route: null },
    { title: 'Notifications & Alerts', subtitle: 'Manage spiritual reminders and broadcast alerts', icon: '🔔', route: null },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Sanctuary Profile"
        subtitle="Manage your spiritual membership and leadership tools."
      />

      {/* Member Digital Pass Card */}
      <View style={[styles.memberPassCard, shadows.lg]}>
        <View style={styles.passHeader}>
          <View>
            <Text style={styles.passOrgName}>{organization?.name ?? 'Global Sanctuary'}</Text>
            <Text style={styles.passMemberTitle}>DIGITAL MEMBER PASS</Text>
          </View>
          <Badge label={expression?.name ?? 'Sanctuary'} variant="gold" />
        </View>

        <View style={styles.passBody}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {profile?.display_name
                ? profile.display_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                : 'M'}
            </Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{profile?.display_name ?? 'Church Member'}</Text>
            <Text style={styles.memberEmail}>{profile?.email}</Text>
            <Text style={styles.memberRoleBadge}>
              {hasLeadershipAccess ? '🌟 Church Leader / Minister' : 'Dedicated Member'}
            </Text>
          </View>
        </View>

        {/* QR Attendance Code Simulation */}
        <View style={styles.passFooter}>
          <View style={styles.qrBlock}>
            <Text style={styles.qrIcon}>▦</Text>
            <Text style={styles.qrLabel}>Fast Check-in QR Code</Text>
          </View>
          <Text style={styles.passId}>ID: {profile?.id?.slice(0, 8).toUpperCase()}</Text>
        </View>
      </View>

      {/* Leadership Hub Banner (Role-Aware) */}
      {hasLeadershipAccess && (
        <Pressable
          onPress={() => router.push('/(tabs)/profile/leadership')}
          style={({ pressed }) => [styles.leadHubBanner, shadows.glowGold, pressed && styles.pressed]}
        >
          <View style={styles.leadHubIconTile}>
            <Text style={styles.leadHubIcon}>👑</Text>
          </View>
          <View style={styles.leadHubContent}>
            <View style={styles.leadHubTitleRow}>
              <Text style={styles.leadHubTitle}>Leadership Hub</Text>
              <Badge label="ACTIVE" variant="gold" />
            </View>
            <Text style={styles.leadHubSubtitle}>
              Media studio, pastoral triage, attendance counters, sermon publishing.
            </Text>
          </View>
          <Text style={styles.leadHubChevron}>➔</Text>
        </Pressable>
      )}

      {/* Profile Modules & Settings */}
      <SectionHeader title="Church Services & Records" />
      <View style={styles.menuList}>
        {quickLinks.map((item, idx) => (
          <Pressable
            key={idx}
            onPress={() => item.route && router.push(item.route as any)}
            style={({ pressed }) => [styles.menuItemCard, shadows.sm, pressed && styles.pressed]}
          >
            <View style={styles.menuIconTile}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>{item.title}</Text>
              <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>
        ))}
      </View>

      {/* Sign Out Button */}
      <View style={styles.signOutWrapper}>
        <Button
          label="Sign Out of Sanctuary"
          onPress={signOut}
          variant="outline"
          size="md"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  content: {
    paddingBottom: 120,
  },
  visitorContainer: {
    flex: 1,
    backgroundColor: palette.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  visitorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8EDCE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  visitorIcon: {
    fontSize: 40,
  },
  visitorTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  visitorSubtitle: {
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginVertical: spacing.md,
    maxWidth: 300,
  },
  memberPassCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: palette.midnight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: palette.glassBorderDark,
  },
  passHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF1A',
    paddingBottom: spacing.md,
  },
  passOrgName: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '900',
  },
  passMemberTitle: {
    color: palette.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  passBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.midnight,
  },
  memberInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.white,
  },
  memberEmail: {
    fontSize: 12,
    color: '#8E9EB5',
    marginTop: 2,
  },
  memberRoleBadge: {
    color: palette.goldLight,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  passFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF1A',
    paddingTop: spacing.md,
  },
  qrBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrIcon: {
    fontSize: 18,
    color: palette.gold,
    marginRight: 6,
  },
  qrLabel: {
    color: '#D2DCEB',
    fontSize: 11,
    fontWeight: '700',
  },
  passId: {
    color: '#8E9EB5',
    fontSize: 11,
    fontWeight: '800',
  },
  leadHubBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: palette.navy,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: palette.gold,
  },
  leadHubIconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.midnight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadHubIcon: {
    fontSize: 22,
  },
  leadHubContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  leadHubTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  leadHubTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.white,
  },
  leadHubSubtitle: {
    fontSize: 12,
    color: '#B5C4DC',
    marginTop: 2,
    lineHeight: 16,
  },
  leadHubChevron: {
    fontSize: 16,
    color: palette.gold,
    fontWeight: '900',
    marginLeft: spacing.sm,
  },
  menuList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  menuIconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 20,
  },
  menuItemContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: palette.ink,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 20,
    color: palette.mutedLight,
    fontWeight: '700',
  },
  signOutWrapper: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
