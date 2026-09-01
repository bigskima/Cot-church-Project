import React, { useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { Avatar } from '../primitives/Avatar';
import type { Reel } from '@/types/content';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export interface ReelPlayerProps {
  reel: Reel;
  expressionName?: string;
  isFollowing?: boolean;
  isActive?: boolean;
  onFollow?: () => void;
  onLike?: () => void;
  onOpenComments?: () => void;
  onSave?: () => void;
  onShare?: () => void;
}

export function ReelPlayer({
  reel,
  expressionName,
  isFollowing = false,
  isActive = true,
  onFollow,
  onLike,
  onOpenComments,
  onSave,
  onShare,
}: ReelPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);

  const toggleLike = () => {
    setIsLiked(!isLiked);
    onLike?.();
  };

  const toggleSave = () => {
    setIsSaved(!isSaved);
    onSave?.();
  };

  const thumbnailUrl = reel.media_assets?.thumbnailUrl || reel.media_assets?.url;

  return (
    <View style={styles.container}>
      {/* 9:16 Media Canvas */}
      <View style={styles.videoCanvas}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.videoPoster} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderCanvas}>
            <Icon name="film-outline" size={48} color="#5C8FF5" />
          </View>
        )}

        {/* Tap to Play/Pause Layer */}
        <Pressable
          onPress={() => setIsPlaying(!isPlaying)}
          style={styles.tapLayer}
        >
          {!isPlaying ? (
            <View style={styles.pauseIndicator}>
              <Icon name="play" size={36} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
          ) : null}
        </Pressable>

        {/* Right Interaction Action Rail */}
        <View style={styles.actionRail}>
          {/* Like / Reaction */}
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
                color={isLiked ? '#E5484D' : '#FFFFFF'}
              />
            </View>
            <Text style={styles.actionLabel}>
              {reel.likes_count + (isLiked ? 1 : 0)}
            </Text>
          </Pressable>

          {/* Comment Trigger */}
          <Pressable
            onPress={onOpenComments}
            hitSlop={6}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="View comments"
          >
            <View style={styles.actionCircle}>
              <Icon name="chatbubble-outline" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>{reel.comments_count}</Text>
          </Pressable>

          {/* Save/Bookmark */}
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
                size={22}
                color={isSaved ? '#5C8FF5' : '#FFFFFF'}
              />
            </View>
            <Text style={styles.actionLabel}>{isSaved ? 'Saved' : 'Save'}</Text>
          </Pressable>

          {/* Share */}
          <Pressable
            onPress={onShare}
            hitSlop={6}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Share reel"
          >
            <View style={styles.actionCircle}>
              <Icon name="share-social-outline" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>Share</Text>
          </Pressable>
        </View>

        {/* Bottom Metadata Gradient & Details */}
        <LinearGradient
          colors={['transparent', 'rgba(6, 20, 38, 0.7)', 'rgba(6, 20, 38, 0.95)']}
          style={styles.bottomGradient}
        >
          {/* Creator & Expression Info */}
          <View style={styles.creatorRow}>
            <Avatar name={expressionName || 'Church'} size="sm" showBorder />
            <View style={styles.creatorCol}>
              <Text style={styles.creatorName} numberOfLines={1}>
                {expressionName || 'Church Expression'}
              </Text>
            </View>
            {onFollow ? (
              <Pressable
                onPress={onFollow}
                style={[
                  styles.followBtn,
                  isFollowing ? styles.followingBtn : styles.notFollowingBtn,
                ]}
              >
                <Text
                  style={[
                    styles.followBtnText,
                    { color: isFollowing ? '#CBD5E1' : '#0D294B' },
                  ]}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Caption */}
          <Pressable onPress={() => setIsCaptionExpanded(!isCaptionExpanded)}>
            <Text
              style={styles.captionText}
              numberOfLines={isCaptionExpanded ? undefined : 2}
            >
              {reel.caption}
            </Text>
          </Pressable>

          {/* Audio Info */}
          {reel.audio_title ? (
            <View style={styles.audioRow}>
              <Icon name="musical-note" size={13} color="#8FB4F8" style={{ marginRight: 5 }} />
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
    width: screenWidth,
    height: screenHeight - 80, // Accounts for tab bar & header
    backgroundColor: '#061426',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCanvas: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#061426',
  },
  videoPoster: {
    width: '100%',
    height: '100%',
  },
  placeholderCanvas: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#091B33',
  },
  tapLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIndicator: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(6, 20, 38, 0.65)',
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
    backgroundColor: 'rgba(6, 20, 38, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedCircle: {
    backgroundColor: 'rgba(229, 72, 77, 0.25)',
  },
  savedCircle: {
    backgroundColor: 'rgba(47, 111, 237, 0.25)',
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.xs,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxs,
  },
  creatorCol: {
    flex: 1,
  },
  creatorName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  notFollowingBtn: {
    backgroundColor: '#FFFFFF',
  },
  followingBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  captionText: {
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 18,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxs,
  },
  audioText: {
    color: '#8FB4F8',
    fontSize: 12,
    fontWeight: '600',
  },
});
