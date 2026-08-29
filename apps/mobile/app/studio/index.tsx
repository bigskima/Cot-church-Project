import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import { Badge, Button, InputField, Skeleton } from '@/components';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';

interface StudioOverview {
  drafts: { id: string; content_type: string; status: string; created_at: string }[];
  mediaQueue: { id: string; media_type: string; processing_state: string; created_at: string }[];
  totalPublished: number;
}

export default function CreatorStudioScreen() {
  const { api } = useSession();
  const { colors, isDark } = useTheme();

  const [activeModal, setActiveModal] = useState<'post' | 'reel' | 'video' | null>(null);
  const [postBody, setPostBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const studioResource = useResource<StudioOverview>('studio:overview', (signal) =>
    api.request<StudioOverview>('creator-studio', { signal })
  );

  const studioData = studioResource.data;

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

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }] as any}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ] as any}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn as any}>
          <Text style={[styles.backText, { color: colors.text }] as any}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }] as any}>
          Creator & Ministry Studio
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content as any}>
        {/* Studio Banner */}
        <View
          style={[
            styles.bannerCard,
            { backgroundColor: isDark ? '#1C1008' : '#FFFDF9', borderColor: isDark ? '#3D2415' : palette.line },
            shadows.md,
          ] as any}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Badge label="PRODUCTION STUDIO" variant="gold" />
            <Text style={{ fontSize: 13, color: palette.gold, fontWeight: '800' } as any}>
              ✦ Scoped Ministry Hub
            </Text>
          </View>
          <Text style={[styles.bannerTitle, { color: colors.text }] as any}>
            Author, Produce & Distribute
          </Text>
          <Text style={[styles.bannerSub, { color: colors.textMuted }] as any}>
            Publish social conversations, vertical short reels, expository sermons, and long-form watch videos.
          </Text>
        </View>

        {/* Quick Publishing Actions Grid */}
        <Text style={[styles.sectionHeading, { color: colors.text }] as any}>
          Content Publishing Tools
        </Text>
        <View style={styles.actionsGrid as any}>
          <Pressable
            onPress={() => setActiveModal('post')}
            style={[
              styles.actionCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ] as any}
          >
            <Text style={{ fontSize: 24 } as any}>📝</Text>
            <Text style={[styles.actionTitle, { color: colors.text }] as any}>Create Post</Text>
            <Text style={[styles.actionSub, { color: colors.textMuted }] as any}>
              Text, reflections & updates
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveModal('reel')}
            style={[
              styles.actionCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ] as any}
          >
            <Text style={{ fontSize: 24 } as any}>🎬</Text>
            <Text style={[styles.actionTitle, { color: colors.text }] as any}>Upload Reel</Text>
            <Text style={[styles.actionSub, { color: colors.textMuted }] as any}>
              Vertical 9:16 video highlights
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveModal('video')}
            style={[
              styles.actionCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ] as any}
          >
            <Text style={{ fontSize: 24 } as any}>📹</Text>
            <Text style={[styles.actionTitle, { color: colors.text }] as any}>Upload Video</Text>
            <Text style={[styles.actionSub, { color: colors.textMuted }] as any}>
              Long-form Watch documentaries
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/profile/leadership/sermons-manage' as any)}
            style={[
              styles.actionCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
            ] as any}
          >
            <Text style={{ fontSize: 24 } as any}>🎙️</Text>
            <Text style={[styles.actionTitle, { color: colors.text }] as any}>Manage Sermons</Text>
            <Text style={[styles.actionSub, { color: colors.textMuted }] as any}>
              Expository series & archives
            </Text>
          </Pressable>
        </View>

        {/* Media Processing Queue */}
        <Text style={[styles.sectionHeading, { color: colors.text }] as any}>
          Media Processing Queue
        </Text>
        {studioResource.loading ? (
          <Skeleton height={80} count={2} dark={isDark} />
        ) : (studioData?.mediaQueue.length ?? 0) > 0 ? (
          <View style={{ gap: 8 }}>
            {studioData?.mediaQueue.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.queueItem,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ] as any}
              >
                <Text style={{ fontSize: 18 } as any}>⚙️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.queueTitle, { color: colors.text }] as any}>
                    {item.media_type.toUpperCase()} Asset Pipeline
                  </Text>
                  <Text style={[styles.queueSub, { color: palette.gold }] as any}>
                    State: {item.processing_state}
                  </Text>
                </View>
                <Badge label="IN PROGRESS" variant="gold" />
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.emptyQueue,
              { backgroundColor: colors.card, borderColor: colors.border },
            ] as any}
          >
            <Text style={{ fontSize: 20 } as any}>✓</Text>
            <Text style={[styles.emptyQueueText, { color: colors.textMuted }] as any}>
              All uploaded media assets have finished transcoding.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Post Modal */}
      <Modal visible={activeModal === 'post'} transparent animationType="slide">
        <View style={styles.modalBackdrop as any}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: isDark ? '#1C1008' : '#FFFDF9', borderColor: colors.border },
            ] as any}
          >
            <Text style={[styles.modalHeading, { color: colors.text }] as any}>
              Publish New Social Post
            </Text>
            <InputField
              label="Post Message"
              placeholder="Share ministry update, testimony, or reflection..."
              value={postBody}
              onChangeText={setPostBody}
              multiline
              dark={isDark}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setActiveModal(null)}
                style={{ flex: 1 } as any}
              />
              <Button
                label="Publish Now ➔"
                variant="gold"
                loading={submitting}
                onPress={handlePublishPost}
                style={{ flex: 1 } as any}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 54,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 100,
  },
  bannerCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 8,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  bannerSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  actionSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
  },
  queueTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  queueSub: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyQueue: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
  },
  emptyQueueText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '900',
  },
});
