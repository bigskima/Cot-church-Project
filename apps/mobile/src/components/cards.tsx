import React from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Event, LiveStream, Sermon, SocialPost, PrayerRequest } from '../types/content';
import { palette, radius, shadows, spacing } from '../design-system/tokens';
import { Badge } from './Badge';

// -------------------------------------------------------------
// HERO LIVE CARD (High-intensity full-width broadcast banner)
// -------------------------------------------------------------
export function HeroLiveCard({
  stream,
  onPress,
}: {
  stream: LiveStream;
  onPress: () => void;
}) {
  const isLive = stream.status === 'live';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.heroCardContainer,
        shadows.lg,
        pressed && styles.pressed,
      ]}
    >
      <ImageBackground
        source={stream.thumbnail_url ? { uri: stream.thumbnail_url } : undefined}
        style={styles.heroBackground}
      >
        <LinearGradient
          colors={['#0713291A', '#071329B3', '#071329F5']}
          style={styles.heroGradient}
        >
          <View style={styles.heroTopRow}>
            <Badge
              label={isLive ? '● Live Broadcast' : 'Scheduled'}
              variant={isLive ? 'live' : 'gold'}
              pulse={isLive}
            />
            {stream.visibility && (
              <View style={styles.visibilityBadge}>
                <Text style={styles.visibilityText}>
                  {stream.visibility === 'public' ? 'Global' : 'Expression'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.heroBottomContent}>
            <Text numberOfLines={2} style={styles.heroTitle}>
              {stream.title}
            </Text>
            {stream.description && (
              <Text numberOfLines={2} style={styles.heroDescription}>
                {stream.description}
              </Text>
            )}
            <View style={styles.heroCtaRow}>
              <View style={styles.heroCtaButton}>
                <Text style={styles.heroCtaText}>
                  {isLive ? 'Join Sanctuary Live ➔' : 'View Service Details'}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

// -------------------------------------------------------------
// LIVE STREAM CAROUSEL CARD
// -------------------------------------------------------------
export function LiveCard({
  stream,
  onPress,
}: {
  stream: LiveStream;
  onPress: () => void;
}) {
  const isLive = stream.status === 'live';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.liveCardContainer,
        shadows.md,
        pressed && styles.pressed,
      ]}
    >
      <ImageBackground
        source={stream.thumbnail_url ? { uri: stream.thumbnail_url } : undefined}
        style={styles.cardBackground}
      >
        <LinearGradient
          colors={['#07132910', '#071329CC']}
          style={styles.cardGradient}
        >
          <Badge
            label={isLive ? 'Live' : 'Upcoming'}
            variant={isLive ? 'live' : 'neutral'}
            pulse={isLive}
          />
          <View>
            <Text numberOfLines={2} style={styles.cardTitle}>
              {stream.title}
            </Text>
            <Text style={styles.cardSubtitle}>
              {stream.visibility === 'public' ? 'Global Expression' : 'Local Sanctuary'}
            </Text>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

// -------------------------------------------------------------
// SERMON CARD (With Preacher, Scripture, & Media Type)
// -------------------------------------------------------------
export function SermonCard({
  sermon,
  onPress,
}: {
  sermon: Sermon;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sermonCardContainer,
        shadows.sm,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.sermonMediaPreview}>
        {sermon.thumbnail_url ? (
          <Image source={{ uri: sermon.thumbnail_url }} style={styles.sermonThumbnail} />
        ) : (
          <View style={styles.sermonPlaceholder}>
            <Text style={styles.sermonIcon}>✦</Text>
          </View>
        )}
        <View style={styles.mediaTypePill}>
          <Text style={styles.mediaTypeText}>
            {sermon.video_url ? 'VIDEO' : 'AUDIO'}
          </Text>
        </View>
      </View>

      <View style={styles.sermonContent}>
        {sermon.series?.title && (
          <Text numberOfLines={1} style={styles.sermonSeries}>
            {sermon.series.title.toUpperCase()}
          </Text>
        )}
        <Text numberOfLines={2} style={styles.sermonTitle}>
          {sermon.title}
        </Text>
        <Text style={styles.sermonPreacher}>
          {sermon.preacher ?? 'Church Minister'} · {new Date(sermon.sermon_date).toLocaleDateString()}
        </Text>
      </View>
    </Pressable>
  );
}

// -------------------------------------------------------------
// EVENT CARD (Calendar Date Tile + Location)
// -------------------------------------------------------------
export function EventCard({
  event,
  onPress,
}: {
  event: Event;
  onPress?: () => void;
}) {
  const date = new Date(event.starts_at);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.eventCardContainer,
        shadows.sm,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.dateTile}>
        <Text style={styles.dateMonth}>
          {date.toLocaleString(undefined, { month: 'short' }).toUpperCase()}
        </Text>
        <Text style={styles.dateDay}>{date.getDate()}</Text>
      </View>

      <View style={styles.eventDetails}>
        <Text numberOfLines={1} style={styles.eventTitle}>
          {event.title}
        </Text>
        <Text style={styles.eventMeta}>
          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {event.location?.name ?? 'Main Sanctuary'}
        </Text>
        {event.location?.is_online && (
          <View style={styles.onlineBadge}>
            <Text style={styles.onlineBadgeText}>🌐 Hybrid / Streamed</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// -------------------------------------------------------------
// SOCIAL POST CARD (Rich Community Feed)
// -------------------------------------------------------------
export function PostCard({
  post,
  onReact,
}: {
  post: SocialPost;
  onReact?: (reaction: string) => void;
}) {
  const image = post.media?.find((item) => item.type === 'image');

  return (
    <View style={[styles.postCardContainer, shadows.sm]}>
      {image && <Image source={{ uri: image.url }} style={styles.postImage} />}
      <View style={styles.postContent}>
        <Text style={styles.postBody}>{post.body}</Text>
        <View style={styles.postMetaRow}>
          <Text style={styles.postDate}>
            {new Date(post.published_at).toLocaleDateString()}
          </Text>
          <Text style={styles.postReactionsCount}>
            {post.social_reactions?.length ?? 0} prayers & reactions
          </Text>
        </View>

        <View style={styles.reactionBar}>
          {[
            ['🙏', 'pray', 'Pray'],
            ['♥', 'love', 'Amen'],
            ['🔥', 'celebrate', 'Fire'],
          ].map(([icon, value, label]) => (
            <Pressable
              key={value}
              onPress={() => onReact?.(value)}
              style={({ pressed }) => [styles.reactionButton, pressed && styles.pressed]}
            >
              <Text style={styles.reactionIcon}>{icon}</Text>
              <Text style={styles.reactionLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

// -------------------------------------------------------------
// PRAYER CARD (Confidential / Wall View)
// -------------------------------------------------------------
export function PrayerCard({
  prayer,
  onPray,
}: {
  prayer: PrayerRequest;
  onPray?: () => void;
}) {
  return (
    <View style={[styles.prayerCardContainer, shadows.sm]}>
      <View style={styles.prayerTopRow}>
        <Badge
          label={prayer.status.toUpperCase()}
          variant={prayer.status === 'answered' ? 'success' : 'prayer'}
        />
        {prayer.privacy === 'pastoral_only' && (
          <Text style={styles.confidentialPill}>🔒 Pastoral Care Only</Text>
        )}
      </View>

      <Text style={styles.prayerTitle}>{prayer.title}</Text>
      <Text style={styles.prayerDescription} numberOfLines={3}>
        {prayer.request ?? prayer.description ?? 'Confidential petition submitted in faith.'}
      </Text>

      <View style={styles.prayerFooter}>
        <Text style={styles.prayerAuthor}>
          {prayer.privacy === 'pastoral_only' ? 'Confidential Member' : 'Sanctuary Member'}
        </Text>
        {onPray && (
          <Pressable
            onPress={onPray}
            style={({ pressed }) => [styles.prayNowButton, pressed && styles.pressed]}
          >
            <Text style={styles.prayNowText}>🙏 Stand in Agreement</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// -------------------------------------------------------------
// LEADERSHIP MODULE CARD (Modular Hub Tile)
// -------------------------------------------------------------
export function LeadershipModuleCard({
  title,
  description,
  icon,
  badge,
  onPress,
}: {
  title: string;
  description: string;
  icon: string;
  badge?: string | number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.leadModuleContainer,
        shadows.sm,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.leadIconTile}>
        <Text style={styles.leadIcon}>{icon}</Text>
      </View>
      <View style={styles.leadContent}>
        <View style={styles.leadTitleRow}>
          <Text style={styles.leadTitle}>{title}</Text>
          {badge !== undefined && (
            <View style={styles.leadBadge}>
              <Text style={styles.leadBadgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.leadDescription} numberOfLines={2}>
          {description}
        </Text>
      </View>
      <Text style={styles.leadChevron}>›</Text>
    </Pressable>
  );
}

// -------------------------------------------------------------
// FLOATING AI ASSISTANT BUTTON
// -------------------------------------------------------------
export function AIButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open church digital assistant"
      onPress={onPress}
      style={({ pressed }) => [
        styles.aiButton,
        shadows.glowGold,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={['#F3D27E', '#E7BB4D', '#C79A2B']}
        style={styles.aiButtonGradient}
      >
        <Text style={styles.aiButtonIcon}>✦</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  heroCardContainer: {
    width: '100%',
    height: 270,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    backgroundColor: palette.midnight,
  },
  heroBackground: {
    flex: 1,
  },
  heroGradient: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visibilityBadge: {
    backgroundColor: '#FFFFFF26',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  visibilityText: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '800',
  },
  heroBottomContent: {
    marginTop: 'auto',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.white,
    letterSpacing: -0.5,
  },
  heroDescription: {
    color: '#D4DBE8',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  heroCtaRow: {
    marginTop: spacing.md,
  },
  heroCtaButton: {
    backgroundColor: palette.gold,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  heroCtaText: {
    color: palette.midnight,
    fontWeight: '900',
    fontSize: 13,
  },
  liveCardContainer: {
    width: 280,
    height: 190,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginRight: spacing.md,
    backgroundColor: palette.navy,
  },
  cardBackground: {
    flex: 1,
  },
  cardGradient: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.white,
  },
  cardSubtitle: {
    color: '#B6C0D0',
    fontSize: 12,
    marginTop: 4,
  },
  sermonCardContainer: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm + 4,
    alignItems: 'center',
  },
  sermonMediaPreview: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: palette.navy,
    position: 'relative',
  },
  sermonThumbnail: {
    width: '100%',
    height: '100%',
  },
  sermonPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.navy,
  },
  sermonIcon: {
    fontSize: 24,
    color: palette.gold,
  },
  mediaTypePill: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#000000B3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  mediaTypeText: {
    fontSize: 9,
    fontWeight: '900',
    color: palette.white,
  },
  sermonContent: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  sermonSeries: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.goldDark,
    marginBottom: 2,
  },
  sermonTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.ink,
  },
  sermonPreacher: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 4,
  },
  eventCardContainer: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm + 4,
    alignItems: 'center',
  },
  dateTile: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8EDCE',
    borderRadius: radius.md,
  },
  dateMonth: {
    color: palette.navy,
    fontSize: 10,
    fontWeight: '900',
  },
  dateDay: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.navy,
    lineHeight: 28,
  },
  eventDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.ink,
  },
  eventMeta: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  onlineBadge: {
    backgroundColor: '#EBF3FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  onlineBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.blue,
  },
  postCardContainer: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  postImage: {
    height: 240,
    width: '100%',
  },
  postContent: {
    padding: spacing.lg,
  },
  postBody: {
    fontSize: 15,
    lineHeight: 23,
    color: palette.ink,
  },
  postMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  postDate: {
    fontSize: 12,
    color: palette.muted,
  },
  postReactionsCount: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  reactionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  reactionIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  reactionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.inkSecondary,
  },
  prayerCardContainer: {
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  prayerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  confidentialPill: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.prayer,
  },
  prayerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: palette.ink,
  },
  prayerDescription: {
    fontSize: 14,
    color: palette.inkSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  prayerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  prayerAuthor: {
    fontSize: 12,
    color: palette.muted,
  },
  prayNowButton: {
    backgroundColor: '#F2EFFB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  prayNowText: {
    fontSize: 12,
    fontWeight: '900',
    color: palette.prayer,
  },
  leadModuleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  leadIconTile: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadIcon: {
    fontSize: 22,
  },
  leadContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  leadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.ink,
  },
  leadBadge: {
    backgroundColor: palette.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
  leadBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: palette.midnight,
  },
  leadDescription: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
  },
  leadChevron: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.mutedLight,
    marginLeft: spacing.sm,
  },
  aiButton: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 96,
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
  },
  aiButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiButtonIcon: {
    fontSize: 26,
    color: palette.midnight,
    fontWeight: '900',
  },
});
