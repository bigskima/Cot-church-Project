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
        pressed ? styles.pressed : null,
      ] as any}
    >
      <ImageBackground
        source={stream.thumbnail_url ? { uri: stream.thumbnail_url } : undefined}
        style={styles.heroBackground}
      >
        <LinearGradient
          colors={['#140C071A', '#140C07B3', '#140C07F5']}
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
        pressed ? styles.pressed : null,
      ] as any}
    >
      <ImageBackground
        source={stream.thumbnail_url ? { uri: stream.thumbnail_url } : undefined}
        style={styles.cardBackground}
      >
        <LinearGradient
          colors={['#140C0710', '#140C07CC']}
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
        pressed ? styles.pressed : null,
      ] as any}
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
        pressed ? styles.pressed : null,
      ] as any}
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
    <View style={[styles.postCardContainer, shadows.sm] as any}>
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
              style={({ pressed }) => [styles.reactionButton, pressed ? styles.pressed : null] as any}
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
    <View style={[styles.prayerCardContainer, shadows.sm] as any}>
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
            style={({ pressed }) => [styles.prayNowButton, pressed ? styles.pressed : null] as any}
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
        pressed ? styles.pressed : null,
      ] as any}
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
        pressed ? styles.pressed : null,
      ] as any}
    >
      <LinearGradient
        colors={['#FDE047', '#F59E0B', '#B45309']}
        style={styles.aiButtonGradient}
      >
        <Text style={styles.aiButtonIcon}>✦</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles: Record<string, any> = StyleSheet.create({
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
    backgroundColor: '#140C07',
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
    backgroundColor: 'rgba(255, 253, 249, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  visibilityText: {
    color: '#FFFDF9',
    fontSize: 11,
    fontWeight: '800',
  },
  heroBottomContent: {
    marginTop: 'auto',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFDF9',
    letterSpacing: -0.5,
  },
  heroDescription: {
    color: '#E6CCB2',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  heroCtaRow: {
    marginTop: spacing.md,
  },
  heroCtaButton: {
    backgroundColor: palette.yellow,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  heroCtaText: {
    color: '#140C07',
    fontWeight: '900',
    fontSize: 13,
  },
  liveCardContainer: {
    width: 280,
    height: 190,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginRight: spacing.md,
    backgroundColor: '#22140C',
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
    color: '#FFFDF9',
  },
  cardSubtitle: {
    color: '#E6CCB2',
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
    backgroundColor: '#22140C',
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
    backgroundColor: '#2E1C11',
  },
  sermonIcon: {
    fontSize: 24,
    color: palette.yellow,
  },
  mediaTypePill: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(20, 12, 7, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  mediaTypeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFDF9',
  },
  sermonContent: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  sermonSeries: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.yellowDark,
    marginBottom: 2,
  },
  sermonTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#26140A',
  },
  sermonPreacher: {
    fontSize: 12,
    color: '#8C6549',
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
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
  },
  dateMonth: {
    color: '#78350F',
    fontSize: 10,
    fontWeight: '900',
  },
  dateDay: {
    fontSize: 24,
    fontWeight: '900',
    color: '#78350F',
    lineHeight: 28,
  },
  eventDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#26140A',
  },
  eventMeta: {
    color: '#8C6549',
    fontSize: 12,
    marginTop: 4,
  },
  onlineBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  onlineBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
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
    color: '#26140A',
  },
  postMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5C4',
  },
  postDate: {
    fontSize: 12,
    color: '#8C6549',
  },
  postReactionsCount: {
    fontSize: 12,
    color: '#8C6549',
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
    color: '#5C3D28',
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
    color: '#26140A',
  },
  prayerDescription: {
    fontSize: 14,
    color: '#5C3D28',
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
    borderTopColor: '#E8D5C4',
  },
  prayerAuthor: {
    fontSize: 12,
    color: '#8C6549',
  },
  prayNowButton: {
    backgroundColor: '#F3E8FF',
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
    backgroundColor: '#F1E3D3',
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
    color: '#26140A',
  },
  leadBadge: {
    backgroundColor: palette.yellow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
  leadBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#140C07',
  },
  leadDescription: {
    fontSize: 13,
    color: '#8C6549',
    marginTop: 2,
  },
  leadChevron: {
    fontSize: 22,
    fontWeight: '700',
    color: '#A68A75',
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
    color: '#140C07',
    fontWeight: '900',
  },
  leaderCard: {
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  leaderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarFallback: {
    backgroundColor: palette.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontWeight: '900',
    color: '#140C07',
  },
  leaderName: {
    fontWeight: '900',
  },
  founderBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  founderBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#92400E',
  },
  leaderRoleText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.yellowDark,
    marginTop: 2,
  },
  leaderMinistryText: {
    fontSize: 11,
    marginTop: 2,
  },
  leaderBioText: {
    fontSize: 13,
    marginTop: 12,
    lineHeight: 18,
  },
});

// -------------------------------------------------------------
// LEADER CARD (Reusable domain component for Church & Expression leadership)
// -------------------------------------------------------------
export function LeaderCard({
  leader,
  name,
  roleTitle,
  biography,
  variant = 'standard',
  dark = false,
  onPress,
}: {
  leader?: {
    id?: string;
    display_name?: string;
    role_title?: string;
    ministry?: string | null;
    short_bio?: string | null;
    portrait_url?: string | null;
    is_founder?: boolean;
    is_featured_public?: boolean;
  };
  name?: string;
  roleTitle?: string;
  biography?: string;
  variant?: 'standard' | 'featured' | 'compact' | 'founder';
  dark?: boolean;
  onPress?: () => void;
}) {
  const isCompact = variant === 'compact';
  const isFeatured = variant === 'featured' || variant === 'founder';
  const avatarSize = isCompact ? 46 : isFeatured ? 68 : 58;

  const displayName = leader?.display_name ?? name ?? 'Leader';
  const role = leader?.role_title ?? roleTitle ?? 'Pastor';
  const bio = leader?.short_bio ?? biography ?? null;
  const isFounder = variant === 'founder' || leader?.is_founder;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.leaderCard,
        {
          backgroundColor: dark ? '#22140C' : '#FFFDF9',
          borderColor: dark ? '#452A1A' : '#E8D5C4',
          borderRadius: isCompact ? radius.md : radius.xl,
          padding: isCompact ? spacing.md : spacing.lg,
        },
      ] as any}
    >
      <View style={styles.leaderHeaderRow}>
        {leader?.portrait_url ? (
          <Image
            source={{ uri: leader.portrait_url }}
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            }}
          />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarFallbackText,
                { fontSize: isCompact ? 18 : 24 },
              ]}
            >
              {displayName ? displayName[0] : 'L'}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text
              style={[
                styles.leaderName,
                {
                  fontSize: isCompact ? 15 : 17,
                  color: dark ? '#FFFDF9' : '#26140A',
                },
              ]}
            >
              {displayName}
            </Text>
            {isFounder ? (
              <View style={styles.founderBadge}>
                <Text style={styles.founderBadgeText}>FOUNDER</Text>
              </View>
            ) : null}
          </View>

          <Text
            style={[
              styles.leaderRole,
              { color: dark ? palette.yellow : '#8C430B' },
            ]}
          >
            {role}
          </Text>

          {leader?.ministry ? (
            <Text
              style={[
                styles.leaderMinistry,
                { color: dark ? '#C9B5A3' : '#6B4226' },
              ]}
            >
              ✦ {leader.ministry}
            </Text>
          ) : null}
        </View>
      </View>

      {bio ? (
        <Text
          style={[
            styles.leaderBio,
            { color: dark ? '#E6D7CB' : '#422415' },
          ]}
          numberOfLines={isCompact ? 2 : 4}
        >
          {bio}
        </Text>
      ) : null}
    </Pressable>
  );
}
