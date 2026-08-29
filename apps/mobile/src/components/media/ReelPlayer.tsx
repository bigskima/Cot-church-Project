import React, { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';
import type { Reel } from '@/types/content';

const { height: screenHeight } = Dimensions.get('window');

interface ReelPlayerProps {
  reel: Reel;
  expressionName?: string;
  isFollowing?: boolean;
  onFollow?: () => void;
  onLike?: () => void;
  onOpenComments?: () => void;
  onSave?: () => void;
  onShare?: () => void;
}

export function ReelPlayer({
  reel,
  expressionName = 'Sanctuary Campus',
  isFollowing = false,
  onFollow,
  onLike,
  onOpenComments,
  onSave,
  onShare,
}: ReelPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const toggleLike = () => {
    setIsLiked(!isLiked);
    onLike?.();
  };

  const toggleSave = () => {
    setIsSaved(!isSaved);
    onSave?.();
  };

  return (
    <View style={styles.container as any}>
      {/* 9:16 Video Canvas Layer */}
      <View style={styles.videoCanvas as any}>
        {/* Placeholder dynamic video layer */}
        <View style={styles.videoBackground as any}>
          <Text style={{ fontSize: 48 } as any}>🎬</Text>
        </View>

        {/* Tap to Play/Pause Overlay */}
        <Pressable
          onPress={() => setIsPlaying(!isPlaying)}
          style={styles.tapLayer as any}
        >
          {!isPlaying ? (
            <View style={styles.pauseIndicator as any}>
              <Text style={{ fontSize: 32, color: '#FFFDF9' } as any}>▶</Text>
            </View>
          ) : null}
        </Pressable>

        {/* Right Side Vertical Action Rail */}
        <View style={styles.actionRail as any}>
          {/* Reaction Button */}
          <Pressable onPress={toggleLike} style={styles.actionBtn as any}>
            <View style={[styles.actionCircle, isLiked ? styles.likedCircle : null] as any}>
              <Text style={{ fontSize: 22 } as any}>{isLiked ? '❤️' : '🤍'}</Text>
            </View>
            <Text style={styles.actionLabel as any}>{reel.likes_count + (isLiked ? 1 : 0)}</Text>
          </Pressable>

          {/* Comment Trigger */}
          <Pressable onPress={onOpenComments} style={styles.actionBtn as any}>
            <View style={styles.actionCircle as any}>
              <Text style={{ fontSize: 20 } as any}>💬</Text>
            </View>
            <Text style={styles.actionLabel as any}>{reel.comments_count}</Text>
          </Pressable>

          {/* Save/Bookmark */}
          <Pressable onPress={toggleSave} style={styles.actionBtn as any}>
            <View style={[styles.actionCircle, isSaved ? styles.savedCircle : null] as any}>
              <Text style={{ fontSize: 20 } as any}>{isSaved ? '🔖' : '🏷️'}</Text>
            </View>
            <Text style={styles.actionLabel as any}>{isSaved ? 'Saved' : 'Save'}</Text>
          </Pressable>

          {/* Share */}
          <Pressable onPress={onShare} style={styles.actionBtn as any}>
            <View style={styles.actionCircle as any}>
              <Text style={{ fontSize: 20 } as any}>↗️</Text>
            </View>
            <Text style={styles.actionLabel as any}>Share</Text>
          </Pressable>
        </View>

        {/* Bottom Content Metadata Drawer */}
        <View style={styles.bottomMeta as any}>
          {/* Expression Header & Follow Button */}
          <View style={styles.creatorRow as any}>
            <View style={styles.avatarCircle as any}>
              <Text style={{ fontSize: 16 } as any}>🏛️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.expressionName as any} numberOfLines={1}>
                {expressionName}
              </Text>
            </View>
            <Pressable
              onPress={onFollow}
              style={[
                styles.followPill,
                isFollowing ? styles.followingPill : null,
              ] as any}
            >
              <Text style={[styles.followText, isFollowing ? styles.followingText : null] as any}>
                {isFollowing ? '✓ Following' : '+ Follow'}
              </Text>
            </Pressable>
          </View>

          {/* Caption */}
          <Text style={styles.caption as any} numberOfLines={3}>
            {reel.caption}
          </Text>

          {/* Audio Information Pill */}
          {reel.audio_title ? (
            <View style={styles.audioPill as any}>
              <Text style={styles.audioIcon as any}>🎵</Text>
              <Text style={styles.audioText as any} numberOfLines={1}>
                {reel.audio_title} {reel.audio_artist ? `• ${reel.audio_artist}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  container: {
    height: screenHeight - 120,
    width: '100%',
    backgroundColor: '#0D0805',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCanvas: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'space-between',
  },
  videoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#140C07',
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(20, 12, 7, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRail: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    gap: 16,
    alignItems: 'center',
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
    backgroundColor: 'rgba(34, 20, 12, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  likedCircle: {
    borderColor: palette.gold,
    backgroundColor: 'rgba(120, 53, 15, 0.9)',
  },
  savedCircle: {
    borderColor: palette.yellow,
    backgroundColor: 'rgba(120, 53, 15, 0.9)',
  },
  actionLabel: {
    color: '#FFFDF9',
    fontSize: 11,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomMeta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 60,
    padding: spacing.lg,
    paddingBottom: 24,
    gap: 10,
    backgroundColor: 'rgba(13, 8, 5, 0.85)',
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2E1C11',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.gold,
  },
  expressionName: {
    color: '#FFFDF9',
    fontSize: 14,
    fontWeight: '900',
  },
  followPill: {
    backgroundColor: palette.gold,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  followingPill: {
    backgroundColor: 'rgba(255, 253, 249, 0.2)',
    borderWidth: 1,
    borderColor: '#FFFDF9',
  },
  followText: {
    color: '#140C07',
    fontSize: 11,
    fontWeight: '900',
  },
  followingText: {
    color: '#FFFDF9',
  },
  caption: {
    color: '#FFFDF9',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  audioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  audioIcon: {
    fontSize: 12,
  },
  audioText: {
    color: palette.yellow,
    fontSize: 11,
    fontWeight: '700',
  },
});
