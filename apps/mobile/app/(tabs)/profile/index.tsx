import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Avatar, Badge, Button, Chip, Icon, ResourceError, ScreenHeader, SectionHeader, Skeleton } from '@/components';
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
  const { mode, context, contextStatus, contextError, accessReady, refreshContext, hasOrganizationCapability, hasPublicCapability, signOut, api } = useSession();
  const { preference, setPreference, colors } = useTheme();
  const profile = context?.profile;
  const membershipOrganization = context?.organization ?? context?.organizations?.[0];
  const creatorOrganization = context?.creatorOrganizations?.[0];
  const organization = membershipOrganization ?? creatorOrganization;
  const hasOrganization = Boolean(membershipOrganization?.id);

  const isAuthorizedExpressionCreator = Boolean(
    mode === 'authenticated' &&
    context?.creatorOrganizations?.some((item) => item.id === organization?.id),
  );

  const aiReadiness = useResource<AiReadiness>(
    `profile:assistant-readiness:${mode}:${contextStatus}:${membershipOrganization?.id ?? 'none'}:general`,
    (signal) => {
    if (mode !== 'authenticated' || !hasOrganization) {
      return Promise.resolve({ capability: 'assistant.answer', ready: false, reason: 'active_membership_required' });
    }
      return api.request<AiReadiness>('ai-gateway?capability=assistant.answer', { signal });
    },
  );
  const aiReady = aiReadiness.data?.ready === true;
  const aiSubtitle = aiReady
    ? 'Available now'
    : aiReadiness.loading
      ? 'Checking availability…'
      : 'Temporarily unavailable. Please try again later.';

  const hasPublicBroadcastAccess = hasPublicCapability('public.live_stream.create');

  const hasOrganizationPastoralLeadershipAccess =
    ((hasOrganizationCapability('prayer.moderate') &&
      (hasOrganizationCapability('prayer.pastoral.receive') || hasOrganizationCapability('prayer.team.receive'))) ||
      hasOrganizationCapability('pastoral.followups.receive'));

  const hasOrganizationCreatorAccess =
    hasOrganizationCapability('posts.create') ||
    hasOrganizationCapability('posts.publish') ||
    (hasOrganizationCapability('media.upload') &&
      (hasOrganizationCapability('reels.publish') || hasOrganizationCapability('videos.publish')));
  const hasOrganizationContentLeadershipAccess =
    hasOrganizationCreatorAccess ||
    hasOrganizationCapability('sermons.create') ||
    hasOrganizationCapability('sermons.manage') ||
    hasOrganizationCapability('events.create') ||
    hasOrganizationCapability('events.update');

  const hasOrganizationLeadershipAccess =
    hasOrganizationCapability('organization.leadership.manage') ||
    hasOrganizationContentLeadershipAccess ||
    hasOrganizationPastoralLeadershipAccess ||
    hasOrganizationCapability('giving.campaigns.manage') ||
    hasOrganizationCapability('giving.finance.read') ||
    isAuthorizedExpressionCreator;

  const hasLeadershipAccess = mode === 'authenticated' && accessReady && (
    hasPublicBroadcastAccess || hasOrganizationLeadershipAccess
  );

  const serviceTile = (route: string, icon: string, title: string, subtitle: string, disabled = false) => (
    <Pressable
      onPress={() => !disabled && router.push(route as any)}
      disabled={disabled}
      style={({ pressed }) => [styles.linkTile, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
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
        <ScreenHeader title="You" subtitle="Your identity, community and church tools." kicker="PROFILE" />

        {mode === 'visitor' ? (
          <View style={[styles.visitorCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={[styles.visitorIconWrap, { backgroundColor: colors.primarySoft }]}><Icon name="person-add" size={28} color={colors.interactive} /></View>
            <Text style={[styles.visitorTitle, { color: colors.text }]}>Your COT account</Text>
            <Text style={[styles.visitorSubtitle, { color: colors.textSecondary }]}>Public COT stays open to browse. Sign in when you want to interact, join an Expression, receive invitations, or use member-only features.</Text>
            <Button label="Sign in or create account" onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/general/profile' } } as any)} variant="primary" size="lg" style={{ width: '100%', marginTop: spacing.sm }} />
          </View>
        ) : contextStatus === 'loading' && !context ? (
          <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <Skeleton height={74} />
            <Skeleton height={42} count={2} />
          </View>
        ) : contextStatus === 'error' && !context ? (
          <ResourceError message={contextError || 'We couldn’t load your account right now.'} retry={refreshContext} />
        ) : (
          <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={styles.memberHeader}>
              <View style={[styles.avatarHalo, { backgroundColor: colors.primarySoft }]}>
                <Avatar url={profile?.avatar_url} name={profile?.display_name} size="lg" />
              </View>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]}>{profile?.display_name ?? 'Church Member'}</Text>
                {profile?.email ? <Text style={[styles.memberEmail, { color: colors.textSecondary }]} numberOfLines={1}>{profile.email}</Text> : null}
                {organization?.name ? (
                  <View style={styles.memberContextRow}>
                    <Icon name="business-outline" size={13} color={colors.interactive} />
                    <Text style={[styles.memberOrg, { color: colors.interactive }]} numberOfLines={1}>{organization.name}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.profileQuickActions}>
              <Pressable onPress={() => router.push('/general/settings')} style={({ pressed }) => [styles.profileQuickAction, { backgroundColor: colors.bgSecondary }, pressed && styles.pressed]}>
                <Icon name="create-outline" size={16} color={colors.text} />
                <Text style={[styles.profileQuickActionText, { color: colors.text }]}>Edit profile</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/general/notifications')} style={({ pressed }) => [styles.profileQuickAction, { backgroundColor: colors.bgSecondary }, pressed && styles.pressed]}>
                <Icon name="notifications-outline" size={16} color={colors.text} />
                <Text style={[styles.profileQuickActionText, { color: colors.text }]}>Notifications</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.sectionWrap}>
          <SectionHeader title="Your church" subtitle="Community, Expressions and personal services" />
          <View style={styles.linksList}>
            {mode === 'authenticated' ? serviceTile('/general/saved', 'bookmark-outline', 'Saved Library', 'Return to posts, Reels, Watch videos and sermons you kept for later') : null}
            {mode === 'authenticated' ? serviceTile('/expressions', 'business-outline', 'My Expressions', 'Join with an invite code or enter one of your Expressions') : null}
            {serviceTile('/general/prayer', 'heart-outline', 'Prayer Petitions & Wall', 'Submit private pastoral requests or view community prayer items')}
            {serviceTile('/general/giving', 'gift-outline', 'Giving & Statements', 'View church-wide giving destinations and your receipts')}
            {mode === 'authenticated' ? serviceTile('/general/assistant', 'sparkles', 'AI Spiritual Assistant', aiSubtitle, !aiReady) : null}
          </View>
        </View>

        {mode === 'authenticated' && !accessReady ? (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Ministry tools" subtitle="Getting your ministry tools ready" />
            <Skeleton height={92} />
          </View>
        ) : hasLeadershipAccess ? (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Ministry tools" subtitle="Only the ministry tools available to you appear here" />
            <Pressable onPress={() => router.push('/general/leadership')} style={({ pressed }) => [styles.leadershipBanner, { backgroundColor: colors.card, borderColor: colors.interactive }, shadows.md, pressed && styles.pressed]}>
              <View style={[styles.leadershipIconWrap, { backgroundColor: colors.primarySoft }]}><Icon name="construct-outline" size={22} color={colors.interactive} /></View>
              <View style={styles.leadershipContent}>
                <View style={styles.leadershipTitleRow}><Text style={[styles.leadershipTitle, { color: colors.text }]}>Leadership tools</Text><Badge label="MINISTRY" variant="primary" /></View>
                <Text style={[styles.leadershipSub, { color: colors.textSecondary }]}>Open your church-wide ministry tools</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionWrap}>
          <SectionHeader title="Appearance" subtitle="Choose how COT looks on this device" />
          <View style={[styles.themeCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={styles.themeChipsRow}>
              <Chip label="System" selected={preference === 'system'} onPress={() => setPreference('system')} icon={<Icon name="phone-portrait-outline" size={14} color={preference === 'system' ? colors.interactive : colors.textSecondary} />} />
              <Chip label="Light" selected={preference === 'light'} onPress={() => setPreference('light')} icon={<Icon name="sunny-outline" size={14} color={preference === 'light' ? colors.interactive : colors.textSecondary} />} />
              <Chip label="Dark" selected={preference === 'dark'} onPress={() => setPreference('dark')} icon={<Icon name="moon-outline" size={14} color={preference === 'dark' ? colors.interactive : colors.textSecondary} />} />
            </View>
          </View>
        </View>

        {mode === 'authenticated' ? <View style={styles.sectionWrap}><Button label="Sign out" onPress={() => signOut()} variant="destructive" size="lg" /></View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: spacing.md, gap: spacing.xl },
  visitorCard: { padding: spacing.xl, borderRadius: radius.xxl, borderWidth: 1, alignItems: 'center', gap: spacing.xs }, visitorIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  visitorTitle: { ...typography.h2, textAlign: 'center' }, visitorSubtitle: { ...typography.bodySmall, textAlign: 'center', lineHeight: 18 },
  memberCard: { padding: spacing.lg, borderRadius: radius.xxl, borderWidth: 1, gap: spacing.md }, memberHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, avatarHalo: { padding: 4, borderRadius: radius.pill }, memberInfo: { flex: 1, minWidth: 0, gap: 2 }, memberName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }, memberEmail: { fontSize: 13 }, memberContextRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }, memberOrg: { fontSize: 12, fontWeight: '700', flexShrink: 1 }, profileQuickActions: { flexDirection: 'row', gap: spacing.sm }, profileQuickAction: { flex: 1, minHeight: 42, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: spacing.sm }, profileQuickActionText: { fontSize: 12, fontWeight: '700' },
  sectionWrap: { gap: spacing.sm }, linksList: { gap: spacing.sm }, linkTile: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, gap: spacing.md },
  tileIcon: { width: 42, height: 42, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' }, tileContent: { flex: 1, gap: 2 }, tileTitle: { fontSize: 15, fontWeight: '700' }, tileSub: { fontSize: 12, lineHeight: 16 },
  leadershipBanner: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, gap: spacing.md }, leadershipIconWrap: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, leadershipContent: { flex: 1, gap: 2 },
  leadershipTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, leadershipTitle: { fontSize: 15, fontWeight: '700' }, leadershipSub: { fontSize: 12, lineHeight: 16 },
  themeCard: { padding: spacing.md, borderRadius: radius.xl, borderWidth: 1 }, themeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, disabled: { opacity: 0.58 }, pressed: { opacity: 0.9, transform: [{ scale: 0.992 }] },
});
