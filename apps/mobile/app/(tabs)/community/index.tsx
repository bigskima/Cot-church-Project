import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';
import { useResource } from '@/hooks/use-resource';
import {
  Avatar,
  BottomSheet,
  BrandMark,
  CommentSheet,
  EmptyState,
  Icon,
  PostCard,
  ResourceError,
  Skeleton,
} from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import type { ContentComment, SocialPost } from '@/types/content';

type FeedScope = 'general' | 'expression';
type PublicBadge = { id?: string; code?: string; label: string; backgroundColor: string; textColor: string; priority?: number };
type CommunityPost = SocialPost & {
  author?: { id: string; displayName?: string; username?: string; avatarUrl?: string | null; bio?: string | null; badges?: PublicBadge[] } | null;
  expression?: { id: string; name: string; code?: string } | null;
};
type CommunityComment = ContentComment & {
  author?: { id: string; displayName?: string; username?: string; avatarUrl?: string | null; badges?: PublicBadge[] } | null;
};
type MediaAttachment = {
  uploadId: string;
  type: 'image' | 'video' | 'audio';
  mimeType: string;
  url: string;
  fileName?: string | null;
  sizeBytes: number;
};
type UploadIntent = {
  uploadId: string;
  type: 'image' | 'video' | 'audio';
  mimeType: string;
  sizeBytes: number;
  signedUploadUrl: string;
};
type UploadableMedia = {
  uri: string;
  fileName?: string | null;
  mimeType: string;
  reportedSize?: number | null;
  webFile?: Blob | null;
};

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

function inferImagePickerMime(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType) return asset.mimeType.toLowerCase();
  const name = (asset.fileName ?? asset.uri).toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.mp4')) return 'video/mp4';
  return asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
}

function inferAudioMime(name: string, supplied?: string | null) {
  if (supplied?.startsWith('audio/')) return supplied.toLowerCase();
  const value = name.toLowerCase();
  if (value.endsWith('.m4a') || value.endsWith('.mp4')) return 'audio/mp4';
  if (value.endsWith('.aac')) return 'audio/aac';
  if (value.endsWith('.ogg') || value.endsWith('.oga')) return 'audio/ogg';
  if (value.endsWith('.wav')) return 'audio/wav';
  return 'audio/mpeg';
}

async function readUploadBody(media: UploadableMedia) {
  if (media.webFile) return media.webFile;
  const response = await fetch(media.uri);
  if (!response.ok) throw new Error('Unable to read the selected media file.');
  return response.blob();
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { api, context, mode } = useSession();
  const { colors } = useTheme();
  const expression = context?.expression;
  const organizationId = context?.organization?.id ?? context?.organizations?.[0]?.id ?? process.env.EXPO_PUBLIC_ORGANIZATION_ID ?? '';

  const [activeTab, setActiveTab] = useState<FeedScope>('general');
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [postDestination, setPostDestination] = useState<FeedScope>('general');
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [commentTargetPostId, setCommentTargetPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  useEffect(() => {
    if (!expression?.id && activeTab === 'expression') setActiveTab('general');
  }, [activeTab, expression?.id]);

  const feedKey = `mobile:community:${activeTab}:${organizationId || 'auto'}:${expression?.id ?? 'none'}`;
  const resource = useResource<CommunityPost[]>(feedKey, (signal) => {
    if (activeTab === 'general') {
      const query = new URLSearchParams({ scope: 'all' });
      if (organizationId) query.set('organizationId', organizationId);
      return api.request<CommunityPost[]>(`public-social-feed?${query.toString()}`, { signal });
    }
    return api.request<CommunityPost[]>('social-feed?scope=expression', { signal });
  });

  const hasChurchMembership = Boolean(
    context?.organizations?.some((organization) => organization.memberships?.some((membership) => membership.status === 'active')),
  );
  // General Community is public to read and available to any authenticated
  // account for interaction. Expression-only posting remains scoped by the
  // selected Expression below and is still enforced by the API.
  const canPost = mode === 'authenticated';
  const canEngage = mode === 'authenticated';

  const cleanupAttachments = async (items = attachments) => {
    if (!items.length) return;
    await Promise.allSettled(items.map((item) => api.request('community-media', {
      method: 'DELETE',
      body: JSON.stringify({ uploadId: item.uploadId }),
    })));
  };

  const openComposer = () => {
    if (!canPost) return;
    setPostError('');
    setPostDestination(activeTab === 'expression' ? 'expression' : 'general');
    setComposerOpen(true);
  };

  const closeComposer = () => {
    if (posting || mediaUploading) return;
    const pending = attachments;
    setComposerOpen(false);
    setPostText('');
    setAttachments([]);
    setPostError('');
    void cleanupAttachments(pending);
  };

  const changeDestination = (destination: FeedScope) => {
    if (destination === postDestination) return;
    const pending = attachments;
    setAttachments([]);
    setPostDestination(destination);
    if (pending.length) void cleanupAttachments(pending);
  };

  const uploadMedia = async (media: UploadableMedia) => {
    const binary = await readUploadBody(media);
    const sizeBytes = Number(binary.size || media.reportedSize || 0);
    if (!sizeBytes || sizeBytes > MAX_MEDIA_BYTES) throw new Error('Each attachment must be 50 MB or smaller.');

    const branchId = postDestination === 'expression' ? expression?.id : undefined;
    const intent = await api.request<UploadIntent>('community-media', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create_upload',
        mimeType: media.mimeType,
        fileName: media.fileName ?? undefined,
        sizeBytes,
        branchId,
      }),
    });

    try {
      const uploaded = await fetch(intent.signedUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': media.mimeType },
        body: binary,
      });
      if (!uploaded.ok) throw new Error(`Media upload failed (${uploaded.status}).`);
      return await api.request<MediaAttachment>('community-media', {
        method: 'POST',
        body: JSON.stringify({ action: 'complete_upload', uploadId: intent.uploadId }),
      });
    } catch (error) {
      await api.request('community-media', {
        method: 'DELETE',
        body: JSON.stringify({ uploadId: intent.uploadId }),
      }).catch(() => undefined);
      throw error;
    }
  };

  const appendUploads = async (selected: UploadableMedia[]) => {
    if (!selected.length) return;
    setMediaUploading(true);
    const uploaded: MediaAttachment[] = [];
    try {
      for (const media of selected.slice(0, Math.max(0, 10 - attachments.length))) {
        uploaded.push(await uploadMedia(media));
      }
      setAttachments((current) => [...current, ...uploaded].slice(0, 10));
    } catch (error) {
      if (uploaded.length) await cleanupAttachments(uploaded);
      setPostError(error instanceof Error ? error.message : 'Unable to upload selected media.');
    } finally {
      setMediaUploading(false);
    }
  };

  const choosePhotoOrVideo = async () => {
    if (!canPost || mediaUploading || attachments.length >= 10) return;
    setPostError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPostError('Allow photo-library access to attach images or videos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, 10 - attachments.length),
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      await appendUploads(result.assets.map((asset) => ({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: inferImagePickerMime(asset),
        reportedSize: asset.fileSize,
        webFile: ((asset as any).file as Blob | undefined) ?? null,
      })));
    } catch (error) {
      setPostError(error instanceof Error ? error.message : 'Unable to choose media.');
      setMediaUploading(false);
    }
  };

  const chooseAudio = async () => {
    if (!canPost || mediaUploading || attachments.length >= 10) return;
    setPostError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      await appendUploads(result.assets.map((asset) => ({
        uri: asset.uri,
        fileName: asset.name,
        mimeType: inferAudioMime(asset.name, asset.mimeType),
        reportedSize: asset.size,
        webFile: ((asset as any).file as Blob | undefined) ?? null,
      })));
    } catch (error) {
      setPostError(error instanceof Error ? error.message : 'Unable to choose audio.');
      setMediaUploading(false);
    }
  };

  const removeAttachment = async (attachment: MediaAttachment) => {
    setAttachments((current) => current.filter((item) => item.uploadId !== attachment.uploadId));
    try {
      await api.request('community-media', {
        method: 'DELETE',
        body: JSON.stringify({ uploadId: attachment.uploadId }),
      });
    } catch (error) {
      setPostError(error instanceof Error ? error.message : 'Unable to remove the selected media.');
    }
  };

  const handleCreatePost = async () => {
    if ((!postText.trim() && !attachments.length) || !canPost || mediaUploading) return;
    if (postDestination === 'expression' && !expression?.id) {
      setPostError('Select or join an Expression before posting to an Expression feed.');
      return;
    }

    setPosting(true);
    setPostError('');
    try {
      await api.request('social-feed', {
        method: 'POST',
        body: JSON.stringify({
          body: postText.trim(),
          visibility: postDestination === 'expression' ? 'branch' : 'public',
          branchId: postDestination === 'expression' ? expression!.id : undefined,
          mediaUploadIds: attachments.map((item) => item.uploadId),
        }),
      });
      setPostText('');
      setAttachments([]);
      setComposerOpen(false);
      setActiveTab(postDestination);
      resource.refresh();
    } catch (error) {
      setPostError(error instanceof Error ? error.message : 'Unable to share post.');
    } finally {
      setPosting(false);
    }
  };

  useEffect(() => {
    if (!commentTargetPostId || !canEngage) {
      setComments([]);
      return;
    }
    let active = true;
    setCommentsLoading(true);
    api.request<CommunityComment[]>(`social-feed?postId=${encodeURIComponent(commentTargetPostId)}`)
      .then((items) => { if (active) setComments(items); })
      .catch((error) => {
        if (active) Alert.alert('Comments unavailable', error instanceof Error ? error.message : 'Unable to load comments.');
      })
      .finally(() => { if (active) setCommentsLoading(false); });
    return () => { active = false; };
  }, [api, commentTargetPostId, canEngage]);

  const submitComment = async (body: string, parentCommentId?: string | null) => {
    if (!commentTargetPostId || !canEngage) return;
    try {
      await api.request('social-feed', {
        method: 'POST',
        body: JSON.stringify({ action: 'comment', postId: commentTargetPostId, body, parentCommentId: parentCommentId ?? undefined }),
      });
      const refreshed = await api.request<CommunityComment[]>(`social-feed?postId=${encodeURIComponent(commentTargetPostId)}`);
      setComments(refreshed);
    } catch (error) {
      Alert.alert('Comment not posted', error instanceof Error ? error.message : 'Unable to add comment.');
      throw error;
    }
  };

  const reactToPost = async (postId: string, reaction: string) => {
    if (!canEngage) return;
    try {
      await api.request('social-feed', {
        method: 'POST',
        body: JSON.stringify({ action: 'react', postId, reaction }),
      });
    } catch (error) {
      Alert.alert('Reaction not saved', error instanceof Error ? error.message : 'Unable to save reaction.');
    }
  };

  const posts = resource.data ?? [];
  const canPublishCurrent = Boolean(postText.trim() || attachments.length) && !posting && !mediaUploading;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.headerBar, { paddingTop: insets.top + spacing.sm, backgroundColor: colors.glass, borderColor: colors.borderSubtle }]}>
        <View style={styles.headerIdentity}>
          <BrandMark variant="compact" size={30} />
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Community</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Public fellowship and Expression conversations</Text>
          </View>
        </View>
        {expression?.id ? (
          <Pressable onPress={() => router.push('/(tabs)/community/leadership')} hitSlop={8} style={[styles.headerIconBtn, { backgroundColor: colors.bgSecondary }]} accessibilityRole="button" accessibilityLabel={`${expression.name} leadership`}>
            <Icon name="people-outline" size={18} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        <Pressable onPress={() => setActiveTab('general')} style={[styles.tabItem, activeTab === 'general' && { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.tabText, { color: activeTab === 'general' ? colors.interactive : colors.textMuted }, activeTab === 'general' && styles.tabTextActive]}>General</Text>
        </Pressable>
        {expression?.id ? (
          <Pressable onPress={() => setActiveTab('expression')} style={[styles.tabItem, activeTab === 'expression' && { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.tabText, { color: activeTab === 'expression' ? colors.interactive : colors.textMuted }, activeTab === 'expression' && styles.tabTextActive]} numberOfLines={1}>{expression.name}</Text>
          </Pressable>
        ) : null}
      </View>

      {canPost ? (
        <Pressable onPress={openComposer} style={({ pressed }) => [styles.composerStrip, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.composerPressed]}>
          <Avatar url={context?.profile?.avatar_url} name={context?.profile?.display_name || 'Me'} size="sm" />
          <View style={styles.composerCopy}>
            <Text style={[styles.composerPrompt, { color: colors.text }]}>Share with the community</Text>
            <Text style={[styles.composerPlaceholder, { color: colors.textMuted }]}>Text, photos, video or audio</Text>
          </View>
          <Icon name="create-outline" size={20} color={colors.interactive} />
        </Pressable>
      ) : mode === 'authenticated' ? (
        <View style={[styles.membershipNotice, { backgroundColor: colors.primarySoft, borderBottomColor: colors.borderSubtle }]}>
          <Icon name="globe-outline" size={17} color={colors.interactive} />
          <Text style={[styles.membershipNoticeText, { color: colors.textSecondary }]}>You can always read the General Community. Join an Expression to publish and join member conversations.</Text>
        </View>
      ) : null}

      {resource.loading && !resource.data ? (
        <View style={styles.loadingContainer}><Skeleton height={100} count={4} /></View>
      ) : resource.error && !resource.data ? (
        <ResourceError message={resource.error} retry={resource.refresh} />
      ) : posts.length > 0 ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}
          refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.interactive} />}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              expressionName={item.expression?.name}
              canEngage={canEngage}
              onReply={canEngage ? () => setCommentTargetPostId(item.id) : undefined}
              onReact={canEngage ? (reaction) => void reactToPost(item.id, reaction) : undefined}
            />
          )}
        />
      ) : (
        <EmptyState
          title={activeTab === 'expression' ? 'No Expression Posts Yet' : 'No General Community Posts Yet'}
          message={canPost ? 'Share the first encouraging word or media post in this feed.' : 'Published community posts will appear here.'}
          iconName="chatbubbles-outline"
        />
      )}

      <BottomSheet visible={composerOpen} onClose={closeComposer} title="Create post" subtitle="Share something meaningful with your community.">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.composerBody}>
          <View style={styles.destinationBlock}>
            <Text style={[styles.destinationLabel, { color: colors.textSecondary }]}>POST TO</Text>
            <View style={styles.destinationRow}>
              <Pressable
                onPress={() => changeDestination('general')}
                style={[styles.destinationPill, { borderColor: postDestination === 'general' ? colors.interactive : colors.border, backgroundColor: postDestination === 'general' ? colors.primarySoft : colors.bgSecondary }]}
              >
                <Icon name="globe-outline" size={15} color={postDestination === 'general' ? colors.interactive : colors.textSecondary} />
                <Text style={[styles.destinationText, { color: postDestination === 'general' ? colors.interactive : colors.textSecondary }]}>General Community</Text>
              </Pressable>
              {expression?.id ? (
                <Pressable
                  onPress={() => changeDestination('expression')}
                  style={[styles.destinationPill, { borderColor: postDestination === 'expression' ? colors.interactive : colors.border, backgroundColor: postDestination === 'expression' ? colors.primarySoft : colors.bgSecondary }]}
                >
                  <Icon name="people-outline" size={15} color={postDestination === 'expression' ? colors.interactive : colors.textSecondary} />
                  <Text style={[styles.destinationText, { color: postDestination === 'expression' ? colors.interactive : colors.textSecondary }]} numberOfLines={1}>{expression.name}</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.destinationHelp, { color: colors.textMuted }]}>General Community posts are public. Expression posts remain inside your selected Expression.</Text>
          </View>

          {postError ? <View style={[styles.errorBanner, { backgroundColor: colors.liveSoft }]}><Icon name="alert-circle" size={17} color={colors.live} /><Text style={[styles.errorText, { color: colors.live }]}>{postError}</Text></View> : null}

          <View style={styles.composerRow}>
            <Avatar url={context?.profile?.avatar_url} name={context?.profile?.display_name || 'Me'} size="md" />
            <TextInput
              value={postText}
              onChangeText={setPostText}
              placeholder="What would you like to share?"
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
              maxLength={10000}
              style={[styles.composerInput, { color: colors.text }]}
            />
          </View>

          <View style={styles.mediaToolbar}>
            <Pressable onPress={() => void choosePhotoOrVideo()} disabled={mediaUploading || attachments.length >= 10} style={[styles.mediaButton, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Icon name="images-outline" size={18} color={colors.interactive} />
              <Text style={[styles.mediaButtonText, { color: colors.text }]}>Photo / Video</Text>
            </Pressable>
            <Pressable onPress={() => void chooseAudio()} disabled={mediaUploading || attachments.length >= 10} style={[styles.mediaButton, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Icon name="musical-notes-outline" size={18} color={colors.interactive} />
              <Text style={[styles.mediaButtonText, { color: colors.text }]}>Audio</Text>
            </Pressable>
            <Pressable onPress={() => { closeComposer(); router.push('/studio/reel' as any); }} style={[styles.mediaButton, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Icon name="flash-outline" size={18} color={colors.interactive} />
              <Text style={[styles.mediaButtonText, { color: colors.text }]}>Create Reel</Text>
            </Pressable>
          </View>
          <Text style={[styles.mediaHelp, { color: colors.textMuted }]}>Up to 10 attachments · 50 MB each · images, videos and audio upload through the same validated Storage pipeline.</Text>

          {mediaUploading ? (
            <View style={[styles.uploadingRow, { backgroundColor: colors.primarySoft }]}>
              <Icon name="cloud-upload-outline" size={17} color={colors.interactive} />
              <Text style={[styles.uploadingText, { color: colors.textSecondary }]}>Uploading selected media…</Text>
            </View>
          ) : null}

          {attachments.length ? (
            <View style={styles.attachmentsGrid}>
              {attachments.map((item) => (
                <View key={item.uploadId} style={[styles.attachmentCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                  {item.type === 'image' ? (
                    <Image source={{ uri: item.url }} style={styles.attachmentPreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.attachmentTypePreview}>
                      <Icon name={item.type === 'video' ? 'videocam-outline' : 'musical-notes-outline'} size={26} color={colors.interactive} />
                    </View>
                  )}
                  <View style={styles.attachmentMeta}>
                    <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>{item.fileName || item.type}</Text>
                    <Text style={[styles.attachmentSize, { color: colors.textMuted }]}>{(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB</Text>
                  </View>
                  <Pressable onPress={() => void removeAttachment(item)} hitSlop={6} style={styles.removeAttachment}>
                    <Icon name="close-circle" size={20} color={colors.live} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.composerFooter, { borderTopColor: colors.borderSubtle }]}>
            <Text style={[styles.characterCount, { color: colors.textMuted }]}>{postText.length.toLocaleString()} / 10,000 · {attachments.length}/10 media</Text>
            <Pressable
              onPress={handleCreatePost}
              disabled={!canPublishCurrent}
              style={({ pressed }) => [styles.postPillBtn, { backgroundColor: colors.interactive, opacity: !canPublishCurrent ? 0.5 : pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.postPillText}>{posting ? 'Posting...' : mediaUploading ? 'Uploading...' : 'Post'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      {commentTargetPostId ? (
        <CommentSheet
          visible
          onClose={() => setCommentTargetPostId(null)}
          comments={comments}
          loading={commentsLoading}
          onSubmitComment={submitComment}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.md, marginTop: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderWidth: 1, borderRadius: radius.xl },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.55 },
  headerSubtitle: { fontSize: 11, lineHeight: 15, marginTop: 1 },
  headerIconBtn: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.sm, padding: 4, borderWidth: 1, borderRadius: radius.pill },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 9, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  tabText: { fontSize: 14, fontWeight: '600' },
  tabTextActive: { fontWeight: '800' },
  composerStrip: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginVertical: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderWidth: 1, borderRadius: radius.xl, gap: spacing.md },
  composerPressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
  composerCopy: { flex: 1, minWidth: 0 },
  composerPrompt: { fontSize: 14, fontWeight: '700', letterSpacing: -0.15 },
  composerPlaceholder: { fontSize: 11, marginTop: 2 },
  membershipNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  membershipNoticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  loadingContainer: { padding: spacing.lg, gap: spacing.md },
  composerBody: { gap: spacing.md },
  destinationBlock: { gap: spacing.xs },
  destinationLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  destinationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  destinationPill: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  destinationText: { fontSize: 12, fontWeight: '700', maxWidth: 180 },
  destinationHelp: { fontSize: 11, lineHeight: 16 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600' },
  composerRow: { flexDirection: 'row', gap: spacing.md },
  composerInput: { flex: 1, fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
  mediaToolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  mediaButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 9 },
  mediaButtonText: { fontSize: 12, fontWeight: '700' },
  mediaHelp: { fontSize: 10, lineHeight: 15 },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md },
  uploadingText: { fontSize: 12, fontWeight: '600' },
  attachmentsGrid: { gap: spacing.xs },
  attachmentCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', minHeight: 64 },
  attachmentPreview: { width: 72, height: 64 },
  attachmentTypePreview: { width: 72, height: 64, alignItems: 'center', justifyContent: 'center' },
  attachmentMeta: { flex: 1, paddingHorizontal: spacing.sm, gap: 2 },
  attachmentName: { fontSize: 12, fontWeight: '700' },
  attachmentSize: { fontSize: 10 },
  removeAttachment: { padding: spacing.sm },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md, borderTopWidth: 1, gap: spacing.sm },
  characterCount: { fontSize: 11, flex: 1 },
  postPillBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: radius.pill },
  postPillText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
