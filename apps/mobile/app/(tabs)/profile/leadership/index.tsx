import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import {
  EmptyState,
  LeadershipModuleCard,
  ScreenHeader,
  SectionHeader,
} from '@/components';
import { palette, spacing } from '@/design-system/tokens';

export default function LeadershipHubScreen() {
  const { hasCapability, context } = useSession();

  const canManageMedia =
    hasCapability('streams.broadcast') ||
    hasCapability('streams.manage') ||
    hasCapability('livestream.operate') ||
    hasCapability('livestream.create') ||
    hasCapability('*');

  const canPastoralTriage =
    hasCapability('prayer.manage') ||
    hasCapability('prayer.moderate') ||
    hasCapability('prayer.pastoral_notes.manage') ||
    hasCapability('*');

  const canManageSermons =
    hasCapability('sermons.create') ||
    hasCapability('sermons.manage') ||
    hasCapability('sermons.publish') ||
    hasCapability('*');

  const canManageEvents =
    hasCapability('events.create') ||
    hasCapability('events.update') ||
    hasCapability('events.manage') ||
    hasCapability('*');

  const canManageGiving =
    hasCapability('giving.campaigns.manage') ||
    hasCapability('giving.finance.read') ||
    hasCapability('*');

  const canManageLeadership =
    hasCapability('expression.leadership.manage') ||
    hasCapability('organization.leadership.manage') ||
    hasCapability('*');

  const canManageExpressions =
    hasCapability('organizations.manage') ||
    hasCapability('branches.create') ||
    hasCapability('expression.create') ||
    hasCapability('*');

  const tools = [
    {
      title: 'Expression Media Studio',
      description:
        'Create live broadcasts, retrieve RTMP ingest stream keys, monitor live telemetry, and convert recordings to sermon drafts.',
      icon: '📡',
      badge: 'LIVE OPS',
      route: '/(tabs)/profile/leadership/media-studio',
      enabled: canManageMedia,
    },
    {
      title: 'Pastoral Triage & Care Queue',
      description:
        'Manage confidential prayer petitions, respond to altar call decisions, and assign pastoral follow-ups.',
      icon: '🕊️',
      badge: 'CARE QUEUE',
      route: '/(tabs)/profile/leadership/pastoral-triage',
      enabled: canPastoralTriage,
    },
    {
      title: 'Expression Leadership Directory',
      description:
        'Add, update, and manage local pastors, directors, coordinators, and public featured profiles for this campus.',
      icon: '👥',
      badge: 'DIRECTORY',
      route: '/(tabs)/profile/leadership/expression-leadership',
      enabled: canManageLeadership,
    },
    {
      title: 'Giving & Church Bank Details',
      description:
        'Administer church giving campaigns, building projects, and configure manual bank transfer instructions.',
      icon: '🤍',
      badge: 'FINANCE',
      route: '/(tabs)/profile/leadership/giving-manage',
      enabled: canManageGiving,
    },
    {
      title: 'Sermons & Media Publishing',
      description:
        'Review recorded message drafts, generate AI scripture & summaries, and publish sermons to the church.',
      icon: '📖',
      badge: 'MEDIA',
      route: '/(tabs)/profile/leadership/sermons-manage',
      enabled: canManageSermons,
    },
    {
      title: 'Events & Gatherings Coordinator',
      description:
        'Schedule sanctuary worship gatherings, configure attendance caps, and manage member RSVPs.',
      icon: '🗓️',
      badge: 'SCHEDULE',
      route: '/(tabs)/profile/leadership/events-manage',
      enabled: canManageEvents,
    },
    {
      title: 'Expressions & Campus Bootstrap',
      description:
        'Bootstrap new church campuses, daughter expressions, and establish responsible authority.',
      icon: '🏛️',
      badge: 'CAMPUS',
      route: '/(tabs)/profile/leadership/expressions-manage',
      enabled: canManageExpressions,
    },
  ];

  const availableTools = tools.filter((t) => t.enabled);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Sanctuary Leadership Hub"
        subtitle="Role-scoped tools for pastors, media operators, finance stewards, and campus coordinators."
        showBack
      />

      <View style={styles.body}>
        <SectionHeader title="Your Ministerial Capabilities" badge={availableTools.length} />

        {availableTools.length > 0 ? (
          availableTools.map((tool) => (
            <LeadershipModuleCard
              key={tool.title}
              title={tool.title}
              description={tool.description}
              icon={tool.icon}
              badge={tool.badge}
              onPress={() => router.push(tool.route as any)}
            />
          ))
        ) : (
          <EmptyState
            title="No Leadership Delegations"
            message={`You are an active member of ${
              context?.organizations?.[0]?.name ?? 'your local church expression'
            }. Leadership modules will appear here when authorized by your pastoral leadership.`}
            icon="🔒"
          />
        )}
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
  body: {
    paddingHorizontal: spacing.lg,
  },
});
