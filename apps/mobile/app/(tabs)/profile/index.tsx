import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import {
  Avatar,
  Badge,
  Button,
  Chip,
  Icon,
  ScreenHeader,
  SectionHeader,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { mode, context, hasCapability, signOut } = useSession();
  const { preference, setPreference, colors } = useTheme();

  const profile = context?.profile;
  const organization = context?.organizations?.[0];
  const expression = context?.expression;

  // Genuine capability check for church leadership tools
  const hasLeadershipAccess =
    hasCapability('content.create') ||
    hasCapability('streams.broadcast') ||
    hasCapability('sermons.create') ||
    hasCapability('events.manage') ||
    hasCapability('finance.manage') ||
    hasCapability('pastoral.manage') ||
    hasCapability('members.manage') ||
    hasCapability('*');

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: 100 },
        ]}
      >
        <ScreenHeader
          title="My Profile"
          subtitle="Account settings, spiritual activity, giving receipts, and church tools."
        />

        {mode === 'visitor' ? (
          /* Visitor Onboarding Card */
          <View
            style={[
              styles.visitorCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            <View style={[styles.visitorIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Icon name="person-add" size={28} color={colors.interactive} />
            </View>
            <Text style={[styles.visitorTitle, { color: colors.text }]}>
              Join the Church Family
            </Text>
            <Text style={[styles.visitorSubtitle, { color: colors.textSecondary }]}>
              Sign in or create an account to access prayer petitions, giving history, local campus connection, and personalized spiritual resources.
            </Text>
            <Button
              label="Sign In or Create Account"
              onPress={() => router.replace('/(auth)/login')}
              variant="primary"
              size="lg"
              style={{ width: '100%', marginTop: spacing.sm }}
            />
          </View>
        ) : (
          /* Authenticated Member Summary Card */
          <View
            style={[
              styles.memberCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            <View style={styles.memberHeader}>
              <Avatar
                url={profile?.avatar_url}
                name={profile?.display_name}
                size="lg"
              />
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]}>
                  {profile?.display_name ?? 'Church Member'}
                </Text>
                {profile?.email ? (
                  <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
                    {profile.email}
                  </Text>
                ) : null}
                {organization?.name ? (
                  <Text style={[styles.memberOrg, { color: colors.interactive }]}>
                    {organization.name} {expression?.name ? `· ${expression.name}` : ''}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* Member Services Links */}
        <View style={styles.sectionWrap}>
          <SectionHeader title="Spiritual & Community Services" />
          <View style={styles.linksList}>
            <Pressable
              onPress={() => router.push('/(tabs)/profile/prayer' as any)}
              style={({ pressed }) => [
                styles.linkTile,
                { backgroundColor: colors.card, borderColor: colors.border },
                shadows.sm,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="heart-outline" size={20} color={colors.interactive} />
              </View>
              <View style={styles.tileContent}>
                <Text style={[styles.tileTitle, { color: colors.text }]}>Prayer Petitions & Wall</Text>
                <Text style={[styles.tileSub, { color: colors.textSecondary }]}>
                  Submit private pastoral requests or view community prayer items
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/profile/giving' as any)}
              style={({ pressed }) => [
                styles.linkTile,
                { backgroundColor: colors.card, borderColor: colors.border },
                shadows.sm,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="gift-outline" size={20} color={colors.interactive} />
              </View>
              <View style={styles.tileContent}>
                <Text style={[styles.tileTitle, { color: colors.text }]}>Giving & Statements</Text>
                <Text style={[styles.tileSub, { color: colors.textSecondary }]}>
                  Tithe, offerings, campaign donations, and financial history
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/assistant')}
              style={({ pressed }) => [
                styles.linkTile,
                { backgroundColor: colors.card, borderColor: colors.border },
                shadows.sm,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="sparkles" size={20} color={colors.interactive} />
              </View>
              <View style={styles.tileContent}>
                <Text style={[styles.tileTitle, { color: colors.text }]}>AI Spiritual Assistant</Text>
                <Text style={[styles.tileSub, { color: colors.textSecondary }]}>
                  Search scriptures, explore theology, and inquire about church life
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Leadership Hub (Capability Gated) */}
        {hasLeadershipAccess && (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Leadership & Ministry Tools" />
            <Pressable
              onPress={() => router.push('/studio')}
              style={({ pressed }) => [
                styles.leadershipBanner,
                { backgroundColor: colors.card, borderColor: colors.interactive },
                shadows.sm,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.leadershipIconWrap, { backgroundColor: colors.primarySoft }]}>
                <Icon name="construct-outline" size={22} color={colors.interactive} />
              </View>
              <View style={styles.leadershipContent}>
                <View style={styles.leadershipTitleRow}>
                  <Text style={[styles.leadershipTitle, { color: colors.text }]}>
                    Leadership Studio Hub
                  </Text>
                  <Badge label="MINISTRY" variant="primary" />
                </View>
                <Text style={[styles.leadershipSub, { color: colors.textSecondary }]}>
                  Manage sermons, broadcasts, events, expressions, and pastoral triage
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        {/* Appearance & Theme Selector */}
        <View style={styles.sectionWrap}>
          <SectionHeader title="Appearance & Theme" />
          <View style={[styles.themeCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.themeChipsRow}>
              <Chip
                label="System Auto"
                selected={preference === 'system'}
                onPress={() => setPreference('system')}
                icon={<Icon name="phone-portrait-outline" size={14} color={preference === 'system' ? colors.interactive : colors.textSecondary} />}
              />
              <Chip
                label="Light Theme"
                selected={preference === 'light'}
                onPress={() => setPreference('light')}
                icon={<Icon name="sunny-outline" size={14} color={preference === 'light' ? colors.interactive : colors.textSecondary} />}
              />
              <Chip
                label="Dark Theme"
                selected={preference === 'dark'}
                onPress={() => setPreference('dark')}
                icon={<Icon name="moon-outline" size={14} color={preference === 'dark' ? colors.interactive : colors.textSecondary} />}
              />
            </View>
          </View>
        </View>

        {/* Sign Out / Action Buttons */}
        {mode === 'authenticated' && (
          <View style={styles.sectionWrap}>
            <Button
              label="Sign Out"
              onPress={() => signOut()}
              variant="destructive"
              size="lg"
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  visitorCard: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  visitorIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  visitorTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  visitorSubtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    lineHeight: 18,
  },
  memberCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 17,
    fontWeight: '700',
  },
  memberEmail: {
    fontSize: 13,
  },
  memberOrg: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionWrap: {
    gap: spacing.xs,
  },
  linksList: {
    gap: spacing.xs,
  },
  linkTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileContent: {
    flex: 1,
    gap: 2,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  tileSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  leadershipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  leadershipIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadershipContent: {
    flex: 1,
    gap: 2,
  },
  leadershipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leadershipTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  leadershipSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  themeCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  themeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.8,
  },
});
