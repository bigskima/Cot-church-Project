import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Badge,
  BottomSheet,
  Button,
  Icon,
  InputField,
  LeadershipModuleCard,
  ScreenHeader,
  SectionHeader,
  Skeleton,
} from '@/components';
import { radius, shadows, spacing, typography } from '@/design-system/tokens';

interface StudioOverview {
  drafts?: { id: string; content_type: string; status: string; created_at: string }[];
  mediaQueue?: { id: string; media_type: string; processing_state: string; created_at: string }[];
  totalPublished?: number;
}

export default function CreatorStudioScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, hasCapability } = useSession();
  const expression = context?.expression;
  const canPublishPosts = hasCapability('posts.create') || hasCapability('posts.publish') || hasCapability('*');
  const { colors } = useTheme();

  const [activeModal, setActiveModal] = useState<'post' | null>(null);
  const [postBody, setPostBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const studioResource = useResource<StudioOverview>('studio:overview', (signal) =>
    api.request<StudioOverview>('creator-studio', { signal })
  );

  const handlePublishPost = async () => {
    if (!postBody.trim()) return;
    setSubmitting(true);
    try {
      await api.request('creator-studio', {
        method: 'POST',
        body: JSON.stringify({
          action: 'publish_post',
          expressionId: expression?.id ?? null,
          visibility: expression?.id ? 'branch' : 'public',
          body: postBody.trim(),
        }),
      });
      setPostBody('');
      setActiveModal(null);
      Alert.alert(
        'Post Published',
        expression?.name ? `Your message is now live inside ${expression.name}.` : 'Your message is now live in the General Community.',
      );
      studioResource.refresh();
    } catch (err: any) {
      Alert.alert('Publish Failed', err.message ?? 'Unable to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  const leadershipModules = [
    {
      title: 'Sermons',
      description: 'Create sermon drafts, manage teachings and publish when authorized.',
      iconName: 'book-outline',
      badge: 'MEDIA',
      route: '/leadership/sermons',
      enabled: hasCapability('sermons.create') || hasCapability('sermons.manage') || hasCapability('sermons.publish') || hasCapability('*'),
    },
    {
      title: 'Events',
      description: 'Create and manage gatherings in your current church scope.',
      iconName: 'calendar-outline',
      badge: 'EVENTS',
      route: '/leadership/events',
      enabled: hasCapability('events.create') || hasCapability('events.update') || hasCapability('events.manage') || hasCapability('*'),
    },
    {
      title: 'Live Media Studio',
      description: 'Operate broadcasts and monitor streams when your role allows it.',
      iconName: 'radio-outline',
      badge: 'BROADCAST',
      route: '/leadership/media-studio',
      enabled: hasCapability('streams.manage') || hasCapability('streams.broadcast') || hasCapability('livestream.operate') || hasCapability('*'),
    },
    {
      title: 'Pastoral Care',
      description: 'Review confidential prayer requests and assigned follow-up.',
      iconName: 'heart-outline',
      badge: 'PASTORAL',
      route: '/leadership/pastoral-triage',
      enabled: hasCapability('prayer.manage') || hasCapability('prayer.moderate') || hasCapability('prayer.pastoral_notes.manage') || hasCapability('*'),
    },
    {
      title: 'Giving',
      description: 'Manage giving destinations and finance information you can access.',
      iconName: 'gift-outline',
      badge: 'FINANCE',
      route: '/leadership/giving',
      enabled: hasCapability('giving.campaigns.manage') || hasCapability('giving.finance.read') || hasCapability('*'),
    },
    {
      title: 'Expressions',
      description: 'Manage Expressions when your account has church-level authority.',
      iconName: 'people-outline',
      badge: 'COMMUNITY',
      route: '/leadership/expressions',
      enabled: hasCapability('branches.create') || hasCapability('organizations.manage') || hasCapability('expression.create') || hasCapability('*'),
    },
    {
      title: 'Expression Leadership',
      description: 'Manage leaders and ministry roles in the active Expression.',
      iconName: 'people-circle-outline',
      badge: 'DIRECTORY',
      route: '/leadership/directory',
      enabled: Boolean(expression?.id) && (hasCapability('expression.leadership.manage') || hasCapability('organization.leadership.manage') || hasCapability('*')),
    },
  ].filter((module) => module.enabled);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <ScreenHeader
          title="Ministry Studio"
          kicker="LEADERSHIP"
          subtitle="Create, publish and manage only the ministry tools assigned to your role."
          showBack
        />

        <View style={styles.body}>
          {canPublishPosts ? (
          <View style={[styles.quickPostCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={styles.quickPostHeader}>
              <Icon name="create-outline" size={20} color={colors.interactive} />
              <Text style={[styles.quickPostTitle, { color: colors.text }]}>Quick Community Announcement</Text>
            </View>
            <Text style={[styles.quickPostSub, { color: colors.textSecondary }]}>
              {expression?.name
                ? `Share an encouragement or update inside ${expression.name}.`
                : 'Share an encouragement or ministry update with the General Community.'}
            </Text>
            <Button
              label="Compose Announcement"
              onPress={() => setActiveModal('post')}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          </View>
          ) : null}

          {/* Operational Leadership Modules Grid */}
          <View style={styles.modulesSection}>
            <SectionHeader title="Your tools" badge={leadershipModules.length} subtitle="Only operations assigned to your role are shown" />
            {leadershipModules.map((module, idx) => (
              <LeadershipModuleCard
                key={idx}
                title={module.title}
                description={module.description}
                iconName={module.iconName}
                badge={module.badge}
                onPress={() => router.push(module.route as any)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={activeModal === 'post'}
        onClose={() => setActiveModal(null)}
        title="Publish announcement"
        subtitle={expression?.name ? `Share inside ${expression.name}.` : 'Share with the General Community.'}
      >
        <InputField
          label="Announcement"
          value={postBody}
          onChangeText={setPostBody}
          multiline
          numberOfLines={5}
          placeholder="Write your pastoral announcement or encouragement..."
        />
        <View style={styles.modalActions}>
          <Button label="Cancel" onPress={() => setActiveModal(null)} variant="outline" size="md" />
          <Button label="Publish" onPress={handlePublishPost} loading={submitting} variant="primary" size="md" />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  quickPostCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.xs,
  },
  quickPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickPostTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  quickPostSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  modulesSection: {
    gap: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
