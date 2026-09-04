import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Avatar, Badge, Button, Chip, Icon, ScreenHeader, SectionHeader } from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

type AiReadiness = {
  capability: string;
  ready: boolean;
  reason?: string | null;
  providerName?: string;
  modelName?: string;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { mode, context, hasCapability, signOut, api } = useSession();
  const { preference, setPreference, colors } = useTheme();
  const profile = context?.profile;
  const organization = context?.organizations?.[0];
  const expression = context?.expression;
  const hasOrganization = Boolean(context?.organization?.id ?? organization?.id);

  const aiReadiness = useResource<AiReadiness>('profile:assistant-readiness', (signal) => {
    if (mode !== 'authenticated' || !hasOrganization) {
      return Promise.resolve({ capability: 'assistant.answer', ready: false, reason: 'active_membership_required' });
    }
    return api.request<AiReadiness>('ai-gateway?capability=assistant.answer', { signal });
  });
  const aiReady = aiReadiness.data?.ready === true;
  const aiSubtitle = aiReady
    ? 'Available now'
    : aiReadiness.loading
      ? 'Checking availability…'
      : 'Temporarily unavailable. Please try again later.';

  const hasLeadershipAccess =
    hasCapability('content.create') || hasCapability('streams.broadcast') || hasCapability('sermons.create') ||
    hasCapability('events.manage') || hasCapability('finance.manage') || hasCapability('pastoral.manage') ||
    hasCapability('members.manage') || hasCapability('*');

  const serviceTile = (route: string, icon: string, title: string, subtitle: string, disabled = false) => (
    <Pressable
      onPress={() => !disabled && router.push(route as any)}
      disabled={disabled}
      style={({ pressed }) => [styles.linkTile, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <View style={[styles.tileIcon, { backgroundColor: colors.primarySoft }]}><Icon name={icon} size={20} color={disabled ? colors.textMuted : colors.interactive} /></View>
      <View style={styles.tileContent}>
        <Text style={[styles.tileTitle, { color: disabled ? colors.textMuted : colors.text }]}>{title}</Text>
        <Text style={[styles.tileSub, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      {title === 'AI Spiritual Assistant' ? <Badge label={aiReady ? 'READY' : 'OFFLINE'} variant={aiReady ? 'active' : 'neutral'} /> : <Icon name="chevron-forward" size={18} color={colors.textMuted} />}
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: 100 }]}>
        <ScreenHeader title="My Profile" subtitle="Account settings, notifications, giving, and church tools." />

        {mode === 'visitor' ? (
          <View style={[styles.visitorCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={[styles.visitorIconWrap, { backgroundColor: colors.primarySoft }]}><Icon name="person-add" size={28} color={colors.interactive} /></View>
            <Text style={[styles.visitorTitle, { color: colors.text }]}>Join the Church Family</Text>
            <Text style={[styles.visitorSubtitle, { color: colors.textSecondary }]}>Sign in or create an account to connect with an Expression, receive invitations, participate in community, and access member services.</Text>
            <Button label="Sign In or Create Account" onPress={() => router.replace('/(auth)/login')} variant="primary" size="lg" style={{ width: '100%', marginTop: spacing.sm }} />
          </View>
        ) : (
          <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.memberHeader}>
              <Avatar url={profile?.avatar_url} name={profile?.display_name} size="lg" />
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]}>{profile?.display_name ?? 'Church Member'}</Text>
                {profile?.email ? <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>{profile.email}</Text> : null}
                {organization?.name ? <Text style={[styles.memberOrg, { color: colors.interactive }]}>{organization.name} {expression?.name ? `· ${expression.name}` : ''}</Text> : null}
              </View>
            </View>
          </View>
        )}

        <View style={styles.sectionWrap}>
          <SectionHeader title="Account & Community" />
          <View style={styles.linksList}>
            {mode === 'authenticated' ? serviceTile('/(tabs)/profile/settings', 'person-circle-outline', 'Account Settings', 'Edit your name, username, birthday, bio, phone, and profile photo') : null}
            {mode === 'authenticated' ? serviceTile('/(tabs)/profile/notifications', 'notifications-outline', 'Notifications & Invitations', 'Accept or decline role invitations and view church updates') : null}
            {mode === 'authenticated' && expression?.id ? serviceTile('/(tabs)/community/groups', 'people-outline', 'Expression Groups', `Discover and join groups inside ${expression.name}`) : null}
            {mode === 'authenticated' && expression?.id ? serviceTile('/(tabs)/community/birthdays', 'gift-outline', 'Expression Birthdays', 'Private upcoming birthday calendar with month/day only') : null}
            {serviceTile('/(tabs)/profile/prayer', 'heart-outline', 'Prayer Petitions & Wall', 'Submit private pastoral requests or view community prayer items')}
            {serviceTile('/(tabs)/profile/giving', 'gift-outline', 'Giving & Statements', 'View the configured church or Expression giving destinations and receipts')}
            {mode === 'authenticated' ? serviceTile('/assistant', 'sparkles', 'AI Spiritual Assistant', aiSubtitle, !aiReady) : null}
          </View>
        </View>

        {hasLeadershipAccess && (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Leadership & Ministry Tools" />
            <Pressable onPress={() => router.push('/studio')} style={({ pressed }) => [styles.leadershipBanner, { backgroundColor: colors.card, borderColor: colors.interactive }, shadows.sm, pressed && styles.pressed]}>
              <View style={[styles.leadershipIconWrap, { backgroundColor: colors.primarySoft }]}><Icon name="construct-outline" size={22} color={colors.interactive} /></View>
              <View style={styles.leadershipContent}>
                <View style={styles.leadershipTitleRow}><Text style={[styles.leadershipTitle, { color: colors.text }]}>Leadership Studio Hub</Text><Badge label="MINISTRY" variant="primary" /></View>
                <Text style={[styles.leadershipSub, { color: colors.textSecondary }]}>Manage the church capabilities your role is authorized to operate</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        <View style={styles.sectionWrap}>
          <SectionHeader title="Appearance & Theme" />
          <View style={[styles.themeCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.themeChipsRow}>
              <Chip label="System Auto" selected={preference === 'system'} onPress={() => setPreference('system')} icon={<Icon name="phone-portrait-outline" size={14} color={preference === 'system' ? colors.interactive : colors.textSecondary} />} />
              <Chip label="Light Theme" selected={preference === 'light'} onPress={() => setPreference('light')} icon={<Icon name="sunny-outline" size={14} color={preference === 'light' ? colors.interactive : colors.textSecondary} />} />
              <Chip label="Dark Theme" selected={preference === 'dark'} onPress={() => setPreference('dark')} icon={<Icon name="moon-outline" size={14} color={preference === 'dark' ? colors.interactive : colors.textSecondary} />} />
            </View>
          </View>
        </View>

        {mode === 'authenticated' ? <View style={styles.sectionWrap}><Button label="Sign Out" onPress={() => signOut()} variant="destructive" size="lg" /></View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.lg },
  visitorCard: { padding: spacing.xl, borderRadius: radius.xl, borderWidth: 1, alignItems: 'center', gap: spacing.xs }, visitorIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  visitorTitle: { ...typography.h2, textAlign: 'center' }, visitorSubtitle: { ...typography.bodySmall, textAlign: 'center', lineHeight: 18 },
  memberCard: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1 }, memberHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, memberInfo: { flex: 1, gap: 2 }, memberName: { fontSize: 17, fontWeight: '700' }, memberEmail: { fontSize: 13 }, memberOrg: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  sectionWrap: { gap: spacing.xs }, linksList: { gap: spacing.xs }, linkTile: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md },
  tileIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, tileContent: { flex: 1, gap: 2 }, tileTitle: { fontSize: 15, fontWeight: '600' }, tileSub: { fontSize: 12, lineHeight: 16 },
  leadershipBanner: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md }, leadershipIconWrap: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, leadershipContent: { flex: 1, gap: 2 },
  leadershipTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, leadershipTitle: { fontSize: 15, fontWeight: '700' }, leadershipSub: { fontSize: 12, lineHeight: 16 },
  themeCard: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 }, themeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, disabled: { opacity: 0.58 }, pressed: { opacity: 0.8 },
});
