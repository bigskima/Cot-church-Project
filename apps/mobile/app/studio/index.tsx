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
  const { api } = useSession();
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
          visibility: 'public',
          body: postBody.trim(),
        }),
      });
      setPostBody('');
      setActiveModal(null);
      Alert.alert('Post Published', 'Your message is now live across the community feed.');
      studioResource.refresh();
    } catch (err: any) {
      Alert.alert('Publish Failed', err.message ?? 'Unable to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  const leadershipModules = [
    {
      title: 'Sermons & Archives',
      description: 'Upload sermon audio/video, manage series, and add scripture notes',
      iconName: 'book-outline',
      badge: 'MEDIA',
      route: '/leadership/sermons',
    },
    {
      title: 'Events & Calendar',
      description: 'Create Sunday services, retreats, conferences, and prayer meetings',
      iconName: 'calendar-outline',
      badge: 'EVENTS',
      route: '/leadership/events',
    },
    {
      title: 'Live Media Studio',
      description: 'Broadcast live services, stream ingest keys, and stream health status',
      iconName: 'radio-outline',
      badge: 'BROADCAST',
      route: '/leadership/media-studio',
    },
    {
      title: 'Pastoral Triage & Care',
      description: 'Review confidential member prayer requests and assign pastoral responses',
      iconName: 'heart-outline',
      badge: 'PASTORAL',
      route: '/leadership/pastoral-triage',
    },
    {
      title: 'Giving & Financial Configuration',
      description: 'Track offering campaign goals, receipts, and configure bank wire setups',
      iconName: 'gift-outline',
      badge: 'FINANCE',
      route: '/leadership/giving',
    },
    {
      title: 'Expressions',
      description: 'Manage Expression directory, timezones, leadership and community access',
      iconName: 'business-outline',
      badge: 'COMMUNITY',
      route: '/leadership/expressions',
    },
    {
      title: 'Expression Leadership',
      description: 'View pastors, leaders, communication channels and ministry roles',
      iconName: 'people-outline',
      badge: 'DIRECTORY',
      route: '/leadership/directory',
    },
  ];

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
          {/* Quick Post Creator CTA */}
          <View style={[styles.quickPostCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
            <View style={styles.quickPostHeader}>
              <Icon name="create-outline" size={20} color={colors.interactive} />
              <Text style={[styles.quickPostTitle, { color: colors.text }]}>Quick Community Announcement</Text>
            </View>
            <Text style={[styles.quickPostSub, { color: colors.textSecondary }]}>
              Share an encouragement or ministry update with the General Community.
            </Text>
            <Button
              label="Compose Announcement"
              onPress={() => setActiveModal('post')}
              variant="primary"
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          </View>

          {/* Operational Leadership Modules Grid */}
          <View style={styles.modulesSection}>
            <SectionHeader title="Ministry Operations & Tools" />
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
        subtitle="Share this with the General Community."
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
