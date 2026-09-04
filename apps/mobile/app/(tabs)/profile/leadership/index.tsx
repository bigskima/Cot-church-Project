import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { EmptyState, LeadershipModuleCard, ScreenHeader, SectionHeader } from '@/components';
import { spacing } from '@/design-system/tokens';

export default function LeadershipHubScreen() {
  const insets = useSafeAreaInsets();
  const { hasCapability, context } = useSession();
  const { colors } = useTheme();

  const canManageMedia = hasCapability('streams.broadcast') || hasCapability('streams.manage') || hasCapability('livestream.operate') || hasCapability('livestream.create') || hasCapability('*');
  const canPastoralTriage = hasCapability('prayer.manage') || hasCapability('prayer.moderate') || hasCapability('prayer.pastoral_notes.manage') || hasCapability('*');
  const canManageSermons = hasCapability('sermons.create') || hasCapability('sermons.manage') || hasCapability('sermons.publish') || hasCapability('*');
  const canManageEvents = hasCapability('events.create') || hasCapability('events.update') || hasCapability('events.manage') || hasCapability('*');
  const canManageGiving = hasCapability('giving.campaigns.manage') || hasCapability('giving.finance.read') || hasCapability('*');
  const canManageLeadership = hasCapability('expression.leadership.manage') || hasCapability('organization.leadership.manage') || hasCapability('*');
  const canManageExpressionAccess = (hasCapability('members.invite') && hasCapability('roles.assign')) || hasCapability('*');
  const canManageExpressions = hasCapability('organizations.manage') || hasCapability('branches.create') || hasCapability('expression.create') || hasCapability('*');

  const tools = [
    { title: 'Live Media Studio', description: 'Create live broadcasts, retrieve ingest details, and monitor stream health.', iconName: 'radio-outline', badge: 'LIVE OPS', route: '/(tabs)/profile/leadership/media-studio', enabled: canManageMedia },
    { title: 'Pastoral Triage & Care Queue', description: 'Manage confidential prayer petitions, decisions, and assigned follow-ups.', iconName: 'heart-outline', badge: 'CARE', route: '/(tabs)/profile/leadership/pastoral-triage', enabled: canPastoralTriage },
    { title: 'Expression Leadership Directory', description: 'Manage public pastoral and ministry leadership profiles for the selected Expression.', iconName: 'people-outline', badge: 'DIRECTORY', route: '/(tabs)/profile/leadership/expression-leadership', enabled: canManageLeadership },
    { title: 'Expression Access & Ownership', description: 'Invite users into specific roles, review pending role offers, and transfer accountable Expression ownership.', iconName: 'key-outline', badge: 'ACCESS', route: '/(tabs)/profile/leadership/expression-governance', enabled: canManageExpressionAccess },
    { title: 'Giving', description: 'Manage the giving destinations available to your church or selected Expression, according to your access.', iconName: 'gift-outline', badge: 'GIVING', route: '/(tabs)/profile/leadership/giving-manage', enabled: canManageGiving },
    { title: 'Sermons & Media Publishing', description: 'Review recorded message drafts, assign scripture topics, and publish sermons to members.', iconName: 'book-outline', badge: 'MEDIA', route: '/(tabs)/profile/leadership/sermons-manage', enabled: canManageSermons },
    { title: 'Events & Gatherings', description: 'Schedule worship gatherings, configure attendance, and manage event schedules.', iconName: 'calendar-outline', badge: 'SCHEDULE', route: '/(tabs)/profile/leadership/events-manage', enabled: canManageEvents },
    { title: 'Expressions', description: 'View church Expressions and create a new one when your account has been approved to do so.', iconName: 'business-outline', badge: 'EXPRESSIONS', route: '/(tabs)/profile/leadership/expressions-manage', enabled: canManageExpressions },
  ];

  const availableTools = tools.filter((tool) => tool.enabled);
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: 60 }]}>
        <ScreenHeader title="Leadership Hub" subtitle="Role-scoped operational tools for the selected Expression and church responsibilities." showBack />
        <View style={styles.body}>
          <SectionHeader title="Your Ministerial Delegations" badge={availableTools.length} />
          {availableTools.length ? availableTools.map((tool) => (
            <LeadershipModuleCard key={tool.title} title={tool.title} description={tool.description} iconName={tool.iconName} badge={tool.badge} onPress={() => router.push(tool.route as any)} />
          )) : <EmptyState title="No Delegations Assigned" message={`You are an active member of ${context?.organizations?.[0]?.name ?? 'your church'}. Leadership tools appear only when authority has been assigned.`} iconName="lock-closed-outline" />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flexGrow: 1 }, body: { paddingHorizontal: spacing.lg, gap: spacing.xs } });
