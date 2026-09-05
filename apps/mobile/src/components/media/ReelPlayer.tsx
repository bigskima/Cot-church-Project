import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { radius, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { Avatar } from '../primitives/Avatar';
import type { Reel } from '@/types/content';

export interface ReelPlayerProps {
  reel: Reel;
  expressionName?: string;
  isFollowing?: boolean;
  isActive?: boolean;
  initialLiked?: boolean;
  initialSaved?: boolean;
  onFollow?: () => void;
  onLike?: (currentlyLiked: boolean) => boolean | Promise<boolean>;
  onOpenComments?: () => void;
  onSave?: (currentlySaved: boolean) => boolean | Promise<boolean>;
  onShare?: () => void;
  containerHeight?: number;
}

export function ReelPlayer({
  reel,
  expressionName,
  isFollowing = false,
  isActive = true,
  initialLiked = false,
  initialSaved = false,
  onFollow,
  onLike,
  onOpenComments,
  onSave,
  onShare,
  containerHeight,
}: ReelPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const videoUrl =
    reel.media_assets?.renditions?.find((r) => r.rendition_kind === 'video_stream')?.storage_path ||
    reel.media_assets?.url;
  const thumbnailUrl = reel.media_assets?.thumbnailUrl || reel.media_assets?.url;
  const contentIdentity = reel.content_items;
  const creator = contentIdentity?.author;
  const resolvedExpressionName = expressionName || contentIdentity?.expression?.name || undefined;
  const creatorName =
    creator?.display_name ||
    resolvedExpressionName ||
    contentIdentity?.organization?.name ||
    'City of Transformation';
  const creatorMeta = [
    creator?.username ? `@${creator.username}` : null,
    resolvedExpressionName && resolvedExpressionName !== creatorName ? resolvedExpressionName : null,
  ].filter(Boolean).join(' · ');

  const player = useVideoPlayer(videoUrl || '', (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.5;
  });

  useEffect(() => {
    if (!player) return;
    if (isActive) {
      player.play();
      setIsPlaying(true);
    } else {
      player.pause();
      setIsPlaying(false);
    }
  }, [isActive, player]);

  useEffect(() => {
    if (!player) return;

    const statusSub = player.addListener('statusChange', (status) => {
      setIsBuffering(status.status === 'loading');
    });

    const playingSub = player.addListener('playingChange', (status) => {
      setIsPlaying(status.isPlaying);
    });

    return () => {
      statusSub.remove();
      playingSub.remove();
    };
  }, [player]);

  const togglePlay = () => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  useEffect(() => {
    setIsLiked(initialLiked);
  }, [initialLiked, reel.id]);

  useEffect(() => {
    setIsSaved(initialSaved);
  }, [initialSaved, reel.id]);

  const toggleLike = async () => {
    const next = onLike ? await onLike(isLiked) : !isLiked;
    setIsLiked(next);
  };

  const toggleSave = async () => {
    const next = onSave ? await onSave(isSaved) : !isSaved;
    setIsSaved(next);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Watch this Reel on City of Transformation: ${reel.caption || 'Church video'}`,
      });
      onShare?.();
    } catch {
      // Ignored
    }
  };

  return (
    <View style={[styles.container, containerHeight ? { height: containerHeight } : null]}>
      {/* 9:16 Media Canvas */}
      <View style={styles.videoCanvas}>
        {videoUrl && player ? (
          <VideoView
            player={player}
            style={styles.videoView}
            contentFit="cover"
          />
        ) : thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.videoPoster} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderCanvas}>
            <Icon name="film-outline" size={48} color="#1D9BF0" />
          </View>
        )}

        {/* Buffering Indicator */}
        {isBuffering && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        {/* Tap to Play/Pause Layer */}
        <Pressable
          onPress={togglePlay}
          style={styles.tapLayer}
        >
          {!isPlaying ? (
            <View style={styles.pauseIndicator}>
              <Icon name="play" size={36} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
          ) : null}
        </Pressable>

        {/* Right Interaction Action Rail (TikTok / Reels style) */}
        <View style={styles.actionRail}>
          {/* Like */}
          <Pressable
            onPress={toggleLike}
            hitSlop={6}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Like reel"
          >
            <View style={[styles.actionCircle, isLiked && styles.likedCircle]}>
              <Icon
                name={isLiked ? 'heart' : 'heart-outline'}
                size={24}
                color={isLiked ? '#EF4444' : '#FFFFFF'}
              />
            </View>
            <Text style={styles.actionLabel}>
              {Math.max(0, reel.likes_count + (isLiked ? 1 : 0) - (initialLiked ? 1 : 0))}
            </Text>
          </Pressable>

          {/* Comment */}
          <Pressable
            onPress={onOpenComments}
            hitSlop={6}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Comments"
          >
            <View style={styles.actionCircle}>
              <Icon name="chatbubble-ellipses-outline" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>{reel.comments_count}</Text>
          </Pressable>

          {/* Bookmark */}
          <Pressable
            onPress={toggleSave}
            hitSlop={6}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Bookmark reel"
          >
            <View style={[styles.actionCircle, isSaved && styles.savedCircle]}>
              <Icon
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={isSaved ? '#168FF0' : '#FFFFFF'}
              />
            </View>
            <Text style={styles.actionLabel}>Save</Text>
          </Pressable>

          {/* Share */}
          <Pressable
            onPress={handleShare}
            hitSlop={6}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Share reel"
          >
            <View style={styles.actionCircle}>
              <Icon name="share-social-outline" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>Share</Text>
          </Pressable>
        </View>

        {/* Bottom Overlay Gradient & Metadata */}
        <LinearGradient
          colors={['transparent', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.85)']}
          style={styles.bottomGradient}
        >
          {/* Creator Identity */}
          <View style={styles.creatorRow}>
            <Avatar url={creator?.avatar_url} name={creatorName} size="sm" />
            <View style={styles.creatorCopy}>
              <Text style={styles.creatorName} numberOfLines={1}>{creatorName}</Text>
              {creatorMeta ? <Text style={styles.creatorMeta} numberOfLines={1}>{creatorMeta}</Text> : null}
            </View>
            {onFollow ? (
              <Pressable
                onPress={onFollow}
                style={[styles.followBtn, isFollowing && styles.followingBtn]}
              >
                <Text style={styles.followBtnText}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Caption */}
          {reel.caption ? (
            <Pressable onPress={() => setIsCaptionExpanded(!isCaptionExpanded)}>
              <Text
                style={styles.captionText}
                numberOfLines={isCaptionExpanded ? undefined : 2}
              >
                {reel.caption}
              </Text>
            </Pressable>
          ) : null}

          {/* Audio track tag */}
          {reel.audio_title ? (
            <View style={styles.audioRow}>
              <Icon name="musical-note" size={13} color="#FFFFFF" />
              <Text style={styles.audioText} numberOfLines={1}>
                {reel.audio_title} {reel.audio_artist ? `· ${reel.audio_artist}` : ''}
              </Text>
            </View>
          ) : null}
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  videoCanvas: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  videoPoster: {
    width: '100%',
    height: '100%',
  },
  placeholderCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050B14',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFill as any,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  tapLayer: {
    ...StyleSheet.absoluteFill as any,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIndicator: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRail: {
    position: 'absolute',
    right: spacing.md,
    bottom: 90,
    alignItems: 'center',
    gap: spacing.lg,
    zIndex: 10,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedCircle: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  savedCircle: {
    backgroundColor: 'rgba(22, 143, 240, 0.25)',
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: 24,
    paddingTop: 60,
    gap: spacing.xs,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  creatorCopy: {
    flex: 1,
    minWidth: 0,
  },
  creatorName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  creatorMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  followBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  audioText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.9,
  },
});
