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
    hasCapability('livestream.create');
  const canPastoralTriage =
    hasCapability('prayer.manage') ||
    hasCapability('prayer.moderate') ||
    hasCapability('prayer.pastoral_notes.manage');
  const canManageSermons =
    hasCapability('sermons.create') ||
    hasCapability('sermons.manage') ||
    hasCapability('sermons.publish');
  const canManageEvents =
    hasCapability('events.create') ||
    hasCapability('events.update') ||
    hasCapability('events.manage');

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
      title: 'Pastoral Triage & Care',
      description:
        'Manage confidential prayer petitions, respond to altar call decisions, and assign pastoral follow-ups.',
      icon: '🕊️',
      badge: 'CARE QUEUE',
      route: '/(tabs)/profile/leadership/pastoral-triage',
      enabled: canPastoralTriage,
    },
    {
      title: 'Sermons & Media Publishing',
      description:
        'Review recorded message drafts, generate AI scripture & summaries, and publish sermons to the global app.',
      icon: '📖',
      badge: 'PUBLISHING',
      route: '/(tabs)/profile/leadership/sermons-manage',
      enabled: canManageSermons,
    },
    {
      title: 'Gatherings & Events Coordinator',
      description:
        'Create church services, manage registration capacities, and oversee real-time attendance check-in counters.',
      icon: '🗓️',
      badge: 'GATHERINGS',
      route: '/(tabs)/profile/leadership/events-manage',
      enabled: canManageEvents,
    },
  ].filter((t) => t.enabled);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Leadership Studio"
        subtitle={`Operational tools scoped to ${
          context?.expression?.name ?? context?.organizations?.[0]?.name ?? 'your local church expression'
        }.`}
        showBack
      />

      <View style={styles.body}>
        <SectionHeader title="Active Ministry Workspaces" badge={tools.length} />

        {tools.length > 0 ? (
          tools.map((tool, idx) => (
            <LeadershipModuleCard
              key={idx}
              title={tool.title}
              description={tool.description}
              icon={tool.icon}
              badge={tool.badge}
              onPress={() => router.push(tool.route as any)}
            />
          ))
        ) : (
          <EmptyState
            title="No Scoped Permissions"
            message="Your account currently does not have active ministerial or operational roles assigned for this church."
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
