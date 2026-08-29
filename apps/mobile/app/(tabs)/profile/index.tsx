import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { Badge, Button, ScreenHeader, SectionHeader } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';

export default function ProfileScreen() {
  const { mode, context, permissions, signOut } = useSession();
  const { preference, setPreference, isDark, colors } = useTheme();

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
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title="Sanctuary Profile"
        subtitle="Manage your spiritual membership, theme appearance, and leadership tools."
        dark={isDark}
      />

      {mode === 'visitor' ? (
        /* Visitor Welcome Card */
        <View style={[styles.visitorCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.md] as any}>
          <View style={styles.visitorIconCircle}>
            <Text style={styles.visitorIcon as any}>🕊️</Text>
          </View>
          <Text style={[styles.visitorTitle, { color: colors.text }] as any}>
            Make this sanctuary your spiritual home
          </Text>
          <Text style={[styles.visitorSubtitle, { color: colors.textMuted }] as any}>
            Sign in to connect with your local church expression, spiritual groups, giving history, and pastoral care.
          </Text>
          <Button
            label="Sign In or Create Account"
            onPress={() => router.replace('/(auth)/login')}
            variant="gold"
            size="lg"
            style={{ width: '100%', maxWidth: 300, marginTop: spacing.sm } as any}
          />
        </View>
      ) : (
        /* Member Digital Pass Card */
        <View style={[styles.memberPassCard, shadows.lg] as any}>
          <View style={styles.passHeader}>
            <View>
              <Text style={styles.passOrgName as any}>{organization?.name ?? 'Global Sanctuary'}</Text>
              <Text style={styles.passMemberTitle as any}>DIGITAL MEMBER PASS</Text>
            </View>
            <Badge label={expression?.name ?? 'Sanctuary'} variant="gold" />
          </View>

          <View style={styles.passBody}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials as any}>
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
              <Text style={styles.memberName as any}>{profile?.display_name ?? 'Church Member'}</Text>
              <Text style={styles.memberEmail as any}>{profile?.email}</Text>
              <Text style={styles.memberRoleBadge as any}>
                {hasLeadershipAccess ? '🌟 Church Leader / Minister' : 'Dedicated Member'}
              </Text>
            </View>
          </View>

          {/* QR Attendance Code Simulation */}
          <View style={styles.passFooter}>
            <View style={styles.qrBlock}>
              <Text style={styles.qrIcon as any}>▦</Text>
              <Text style={styles.qrLabel as any}>Fast Check-in QR Code</Text>
            </View>
            <Text style={styles.passId as any}>ID: {profile?.id?.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>
      )}

      {/* Leadership Hub Banner (Role-Aware) */}
      {hasLeadershipAccess && (
        <Pressable
          onPress={() => router.push('/(tabs)/profile/leadership')}
          style={({ pressed }) => [styles.leadHubBanner, shadows.glowGold, pressed && styles.pressed] as any}
        >
          <View style={styles.leadHubIconTile}>
            <Text style={styles.leadHubIcon as any}>👑</Text>
          </View>
          <View style={styles.leadHubContent}>
            <View style={styles.leadHubTitleRow}>
              <Text style={styles.leadHubTitle as any}>Leadership Hub</Text>
              <Badge label="ACTIVE" variant="gold" />
            </View>
            <Text style={styles.leadHubSubtitle as any}>
              Media studio, pastoral triage, giving management, sermon publishing, campus bootstrap.
            </Text>
          </View>
          <Text style={styles.leadHubChevron as any}>➔</Text>
        </Pressable>
      )}

      {/* Visual Appearance & Theme Selector */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <SectionHeader title="Appearance & Theme" dark={isDark} />
        <View style={[styles.themeCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm] as any}>
          <Text style={[styles.themeCardTitle, { color: colors.text }] as any}>COLOR SCHEME</Text>
          <Text style={[styles.themeCardSubtitle, { color: colors.textMuted }] as any}>
            Choose between radiant dark chocolate espresso or warm sand light mode.
          </Text>

          <View style={styles.themeToggleRow}>
            {[
              { key: 'light', label: '☀️ Light', icon: '☀️' },
              { key: 'dark', label: '🌙 Dark', icon: '🌙' },
              { key: 'system', label: '⚙ System', icon: '⚙' },
            ].map((option) => {
              const isSelected = preference === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setPreference(option.key as any)}
                  style={[
                    styles.themeOptionPill,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : isDark
                        ? '#2E1C11'
                        : '#F1E3D3',
                      borderColor: isSelected ? colors.primaryDark : colors.border,
                    },
                  ] as any}
                >
                  <Text
                    style={[
                      styles.themeOptionText,
                      {
                        color: isSelected
                          ? '#140C07'
                          : isDark
                          ? '#FFFDF9'
                          : '#26140A',
                        fontWeight: isSelected ? '900' : '700',
                      },
                    ] as any}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Profile Modules & Settings */}
      {mode === 'authenticated' && (
        <>
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <SectionHeader title="Church Services & Records" dark={isDark} />
            <View style={styles.menuList}>
              {quickLinks.map((item, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => item.route && router.push(item.route as any)}
                  style={({ pressed }) => [
                    styles.menuItemCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    shadows.sm,
                    pressed && styles.pressed,
                  ] as any}
                >
                  <View style={[styles.menuIconTile, { backgroundColor: colors.tagBg }] as any}>
                    <Text style={styles.menuIcon as any}>{item.icon}</Text>
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={[styles.menuItemTitle, { color: colors.text }] as any}>{item.title}</Text>
                    <Text style={[styles.menuItemSubtitle, { color: colors.textMuted }] as any}>{item.subtitle}</Text>
                  </View>
                  <Text style={[styles.menuChevron, { color: colors.textMuted }] as any}>›</Text>
                </Pressable>
              ))}
            </View>
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
        </>
      )}
    </ScrollView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  visitorCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  visitorIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  visitorIcon: {
    fontSize: 34,
  },
  visitorTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  visitorSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 13,
    marginVertical: spacing.md,
    maxWidth: 280,
  },
  memberPassCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: '#140C07',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderColor: '#452A1A',
  },
  passHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#2E1C11',
    paddingBottom: spacing.md,
  },
  passOrgName: {
    color: '#FFFDF9',
    fontSize: 16,
    fontWeight: '900',
  },
  passMemberTitle: {
    color: palette.yellow,
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
    backgroundColor: palette.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '900',
    color: '#140C07',
  },
  memberInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFDF9',
  },
  memberEmail: {
    fontSize: 12,
    color: '#A68A75',
    marginTop: 2,
  },
  memberRoleBadge: {
    color: palette.yellowLight,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  passFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2E1C11',
    paddingTop: spacing.md,
  },
  qrBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrIcon: {
    fontSize: 18,
    color: palette.yellow,
    marginRight: 6,
  },
  qrLabel: {
    color: '#E6CCB2',
    fontSize: 11,
    fontWeight: '700',
  },
  passId: {
    color: '#A68A75',
    fontSize: 11,
    fontWeight: '800',
  },
  leadHubBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: '#22140C',
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: palette.yellow,
  },
  leadHubIconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#140C07',
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
    color: '#FFFDF9',
  },
  leadHubSubtitle: {
    fontSize: 12,
    color: '#E6CCB2',
    marginTop: 2,
    lineHeight: 16,
  },
  leadHubChevron: {
    fontSize: 16,
    color: palette.yellow,
    fontWeight: '900',
    marginLeft: spacing.sm,
  },
  themeCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  themeCardTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  themeCardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  themeToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeOptionPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  themeOptionText: {
    fontSize: 12,
  },
  menuList: {
    gap: spacing.sm,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  menuIconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
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
  },
  menuItemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 20,
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
