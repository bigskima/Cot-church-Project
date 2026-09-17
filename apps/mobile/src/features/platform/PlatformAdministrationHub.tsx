import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, EmptyState, Icon, ResourceError, Skeleton } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';
import { hasPlatformPermission, isPlatformSuperAdmin, usePlatformAdministrationContext } from './usePlatformAdministration';

export type PlatformModule = {
  key: string;
  title: string;
  description: string;
  icon: string;
  permission: string;
  endpoint: string;
  group: 'Platform' | 'Services & Operations';
  superAdminOnly?: boolean;
  relatedRoute?: string;
};

export const PLATFORM_MODULES: PlatformModule[] = [
  { key: 'overview', title: 'Overview', description: 'Platform-wide operating snapshot and recent activity.', icon: 'pulse-outline', permission: 'platform.overview.read', endpoint: 'platform-overview', group: 'Platform' },
  { key: 'organizations', title: 'Church Organisations', description: 'Inspect churches, status and platform organisation records.', icon: 'business-outline', permission: 'platform.organizations.read', endpoint: 'platform-organizations?pageSize=100', group: 'Platform' },
  { key: 'expressions', title: 'Expressions', description: 'Review Expressions across the platform and their governance state.', icon: 'git-network-outline', permission: 'platform.expressions.read', endpoint: 'platform-expressions?pageSize=100', group: 'Platform', relatedRoute: '/general/leadership/expressions-manage' },
  { key: 'users', title: 'Accounts & Access', description: 'Search member accounts and inspect platform access state.', icon: 'people-outline', permission: 'platform.users.read', endpoint: 'platform-users?pageSize=100', group: 'Platform' },
  { key: 'moderation', title: 'Moderation', description: 'Posting controls, reports and platform moderation state.', icon: 'shield-outline', permission: 'platform.moderation.read', endpoint: 'platform-moderation?view=posting', group: 'Platform' },
  { key: 'roles-access', title: 'Roles & Access', description: 'Platform/public capabilities and role access controls.', icon: 'key-outline', permission: 'platform.roles.read', endpoint: 'platform-roles-access', group: 'Platform', relatedRoute: '/general/leadership/roles-access' },
  { key: 'admin-invitations', title: 'Administrator Access', description: 'Platform administrator roles and invitation workflow.', icon: 'person-add-outline', permission: 'platform.roles.manage', endpoint: 'platform-admin-invitations', group: 'Platform', superAdminOnly: true },
  { key: 'expression-creators', title: 'Expression Creation Access', description: 'Choose who may create Expressions for a church.', icon: 'add-circle-outline', permission: 'platform.expression_creators.manage', endpoint: 'platform-organizations?pageSize=100', group: 'Platform', superAdminOnly: true },
  { key: 'branding', title: 'Branding & Identity', description: 'Platform name, logos, launch artwork and default imagery.', icon: 'color-palette-outline', permission: 'platform.branding.manage', endpoint: 'branding', group: 'Platform' },
  { key: 'public-directory', title: 'Community Directory', description: 'Public church and leadership directory configuration.', icon: 'map-outline', permission: 'platform.public_directory.manage', endpoint: 'platform-public-directory', group: 'Platform', relatedRoute: '/general/leadership/church-leadership' },
  { key: 'features', title: 'Feature Availability', description: 'Live feature flags and rollout configuration.', icon: 'toggle-outline', permission: 'platform.features.read', endpoint: 'platform-features', group: 'Platform' },
  { key: 'credentials', title: 'Secure Credentials', description: 'Configured provider-secret metadata without exposing secret values.', icon: 'lock-closed-outline', permission: 'platform.secrets.manage', endpoint: 'platform-secrets', group: 'Services & Operations' },
  { key: 'streaming', title: 'Streaming Services', description: 'Streaming provider readiness and broadcast infrastructure.', icon: 'radio-outline', permission: 'platform.streaming.read', endpoint: 'platform-streaming', group: 'Services & Operations', relatedRoute: '/general/leadership/media-studio' },
  { key: 'ai', title: 'AI Services', description: 'AI provider readiness, routing and capabilities.', icon: 'sparkles-outline', permission: 'platform.ai.read', endpoint: 'platform-ai', group: 'Services & Operations', relatedRoute: '/general/assistant' },
  { key: 'payments', title: 'Payment Services', description: 'Payment provider readiness and platform payment configuration.', icon: 'card-outline', permission: 'platform.payments.read', endpoint: 'platform-payments', group: 'Services & Operations', relatedRoute: '/general/leadership/giving-manage' },
  { key: 'integrations', title: 'System Activity', description: 'Integration jobs, provider activity and operational failures.', icon: 'sync-outline', permission: 'platform.integrations.read', endpoint: 'platform-integrations', group: 'Services & Operations' },
  { key: 'audit', title: 'Audit & Security', description: 'Platform audit history and security-sensitive operational records.', icon: 'document-lock-outline', permission: 'platform.audit.read', endpoint: 'platform-audit', group: 'Services & Operations' },
];

export default function PlatformAdministrationHub() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const authority = usePlatformAdministrationContext();
  const context = authority.data;
  const superAdmin = isPlatformSuperAdmin(context);
  const modules = useMemo(() => PLATFORM_MODULES.filter((module) => (!module.superAdminOnly || superAdmin) && hasPlatformPermission(context, module.permission)), [context, superAdmin]);
  const roleName = context?.roles?.find((role) => role.role_code === 'super_admin')?.platform_roles?.name
    ?? context?.roles?.[0]?.platform_roles?.name
    ?? context?.roles?.[0]?.role_code?.replaceAll('_', ' ')
    ?? 'Platform Administrator';

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 96 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]} accessibilityRole="button" accessibilityLabel="Back to Ministry Workspace"><Icon name="arrow-back" size={19} color={colors.text} /></Pressable>
          <View style={styles.flex}><Text style={[styles.eyebrow, { color: colors.interactive }]}>MINISTRY TOOLS · PLATFORM</Text><Text style={[styles.title, { color: colors.text }]}>Platform Administration</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>The same platform sections exposed by the web administration dashboard, available inside COT according to your live permissions.</Text></View>
        </View>

        {authority.loading ? <><Skeleton height={136} borderRadius={radius.xxl} /><Skeleton height={112} count={5} /></> : authority.error && authority.data === undefined ? <ResourceError message={authority.error} retry={authority.refresh} /> : !context ? (
          <EmptyState title="Platform Administration is not assigned" message="This workspace only appears for accounts with a current Platform Administration role." iconName="shield-outline" />
        ) : (
          <>
            <View style={[styles.authorityCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
              <View style={[styles.authorityIcon, { backgroundColor: colors.primarySoft }]}><Icon name="shield-checkmark" size={25} color={colors.interactive} /></View>
              <View style={styles.flex}><Text style={[styles.authorityLabel, { color: colors.interactive }]}>ACTIVE PLATFORM AUTHORITY</Text><Text style={[styles.authorityName, { color: colors.text }]}>{context.profile?.display_name?.trim() || 'Administrator'}</Text><Text style={[styles.authorityMeta, { color: colors.textMuted }]}>{roleName} · {modules.length} available sections</Text></View>
              <Badge label={superAdmin ? 'SUPER ADMIN' : 'ADMIN'} variant="primary" />
            </View>

            {(['Platform', 'Services & Operations'] as const).map((group) => {
              const items = modules.filter((module) => module.group === group);
              if (!items.length) return null;
              return <View key={group} style={styles.section}><View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.text }]}>{group}</Text><Text style={[styles.sectionCount, { color: colors.interactive }]}>{items.length}</Text></View><View style={styles.grid}>{items.map((module) => <Pressable key={module.key} onPress={() => router.push(`/general/leadership/platform-admin/${module.key}` as any)} style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}><View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}><Icon name={module.icon as any} size={20} color={colors.interactive} /></View><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.text }]}>{module.title}</Text><Text style={[styles.cardCopy, { color: colors.textMuted }]}>{module.description}</Text><View style={styles.cardFooter}><Text style={[styles.permission, { color: colors.interactive }]} numberOfLines={1}>{module.permission}</Text><Icon name="arrow-forward" size={14} color={colors.textSecondary} /></View></View></Pressable>)}</View></View>;
            })}

            <View style={[styles.note, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}><Icon name="information-circle-outline" size={18} color={colors.interactive} /><Text style={[styles.noteText, { color: colors.textMuted }]}>Platform roles remain separate from church and Expression roles. Every section above is filtered from the live platform-context response; hidden sections are not inferred or hardcoded as granted.</Text></View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.xl }, flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, backButton: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, eyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.05 }, title: { fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: -0.75, marginTop: 2 }, subtitle: { fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  authorityCard: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, authorityIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, authorityLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 }, authorityName: { fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 2 }, authorityMeta: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  section: { gap: spacing.sm }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, sectionTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900' }, sectionCount: { fontSize: 10, fontWeight: '900' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { width: '48%', flexGrow: 1, minWidth: 280, minHeight: 124, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, cardTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '900' }, cardCopy: { fontSize: 10.7, lineHeight: 16, marginTop: 3 }, cardFooter: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8 }, permission: { flex: 1, fontSize: 8.5, fontWeight: '800', letterSpacing: 0.15 },
  note: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, noteText: { flex: 1, fontSize: 10.5, lineHeight: 16 }, pressed: { opacity: 0.82, transform: [{ scale: 0.995 }] },
});