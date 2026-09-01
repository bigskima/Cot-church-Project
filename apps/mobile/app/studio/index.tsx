import React, { useState } from 'react';
import {
  Alert,
  Modal,
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
  const { api, hasCapability } = useSession();
  const { colors } = useTheme();

  const [activeModal, setActiveModal] = useState<'post' | null>(null);
  const [postBody, setPostBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const studioResource = useResource<StudioOverview>('studio:overview', (signal) =>
    api.request<StudioOverview>('creator-studio', { signal }).catch(() => ({}))
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
      route: '/(tabs)/profile/leadership/sermons-manage',
    },
    {
      title: 'Events & Calendar',
      description: 'Create Sunday services, retreats, conferences, and prayer meetings',
      iconName: 'calendar-outline',
      badge: 'EVENTS',
      route: '/(tabs)/profile/leadership/events-manage',
    },
    {
      title: 'Live Media Studio',
      description: 'Broadcast live services, stream ingest keys, and Mux playback status',
      iconName: 'radio-outline',
      badge: 'BROADCAST',
      route: '/(tabs)/profile/leadership/media-studio',
    },
    {
      title: 'Pastoral Triage & Care',
      description: 'Review confidential member prayer requests and assign pastoral responses',
      iconName: 'heart-outline',
      badge: 'PASTORAL',
      route: '/(tabs)/profile/leadership/pastoral-triage',
    },
    {
      title: 'Giving & Financial Reports',
      description: 'Track tithes, offering campaign goals, receipts, and bank wire setups',
      iconName: 'gift-outline',
      badge: 'FINANCE',
      route: '/(tabs)/profile/leadership/giving-manage',
    },
    {
      title: 'Church Expressions & Campuses',
      description: 'Manage multi-campus directory, timezones, and leadership assignments',
      iconName: 'business-outline',
      badge: 'CAMPUS',
      route: '/(tabs)/profile/leadership/expressions-manage',
    },
    {
      title: 'Member Directory & Roster',
      description: 'View active member rolls, communication channels, and roles',
      iconName: 'people-outline',
      badge: 'MEMBERS',
      route: '/(tabs)/profile/leadership/members-manage',
    },
    {
      title: 'Organization Settings',
      description: 'Configure branding, church story, mission, and leadership bios',
      iconName: 'settings-outline',
      badge: 'SETTINGS',
      route: '/(tabs)/profile/leadership/settings-manage',
    },
  ];

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
          title="Ministry Studio Hub"
          subtitle="Scoped leadership suite for content publishing, broadcasts, events, and pastoral operations."
          showBack
        />

        <View style={styles.body}>
          {/* Quick Post Creator CTA */}
          <View style={[styles.quickPostCard, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
            <View style={styles.quickPostHeader}>
              <Icon name="create-outline" size={20} color={colors.interactive} />
              <Text style={[styles.quickPostTitle, { color: colors.text }]}>Quick Community Announcement</Text>
            </View>
            <Text style={[styles.quickPostSub, { color: colors.textSecondary }]}>
              Post an instant encouragement or ministry update to all church members.
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

      {/* Post Modal */}
      <Modal
        visible={activeModal === 'post'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Publish Announcement</Text>
              <Pressable onPress={() => setActiveModal(null)} hitSlop={8}>
                <Icon name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <InputField
              label="Announcement Content"
              value={postBody}
              onChangeText={setPostBody}
              multiline
              numberOfLines={5}
              placeholder="Write your pastoral announcement or spiritual encouragement..."
            />

            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                onPress={() => setActiveModal(null)}
                variant="outline"
                size="md"
              />
              <Button
                label="Publish Post"
                onPress={handlePublishPost}
                loading={submitting}
                variant="primary"
                size="md"
              />
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  quickPostCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6, 20, 38, 0.65)',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    ...typography.h2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
