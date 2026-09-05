import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/state/theme';
import type { Sermon } from '@/types/content';
import { radius, spacing, shadows, typography } from '@/design-system/tokens';
import { Badge } from '../Badge';
import { Icon } from '../primitives/Icon';

export interface SermonCardProps {
  sermon: Sermon;
  onPress: () => void;
  variant?: 'card' | 'row';
  style?: StyleProp<ViewStyle>;
}

export function SermonCard({
  sermon,
  onPress,
  variant = 'card',
  style,
}: SermonCardProps) {
  const { colors } = useTheme();

  const hasVideo = !!sermon.video_url || !!sermon.video_asset_id;
  const hasAudio = !!sermon.audio_url || !!sermon.audio_asset_id;
  const preacherName = sermon.preacher || sermon.preacher_name;
  const formattedDate = sermon.sermon_date
    ? new Date(sermon.sermon_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  if (variant === 'row') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.rowContainer,
          { borderBottomColor: colors.border },
          pressed && styles.pressed,
          style,
        ]}
      >
        <View style={[styles.rowThumbnailWrap, { backgroundColor: colors.primarySoft }]}>
          {sermon.thumbnail_url ? (
            <Image source={{ uri: sermon.thumbnail_url }} style={styles.rowThumbnail} resizeMode="cover" />
          ) : (
            <Icon name={hasVideo ? 'videocam-outline' : 'mic-outline'} size={24} color={colors.interactive} />
          )}
        </View>

        <View style={styles.rowContent}>
          {sermon.series?.title ? (
            <Text numberOfLines={1} style={[styles.seriesTag, { color: colors.interactive }]}>
              {sermon.series.title}
            </Text>
          ) : null}
          <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>
            {sermon.title}
          </Text>
          <View style={styles.rowMeta}>
            {preacherName ? (
              <Text numberOfLines={1} style={[styles.metaText, { color: colors.textSecondary }]}>
                {preacherName}
              </Text>
            ) : null}
            {formattedDate ? (
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {preacherName ? ' · ' : ''}{formattedDate}
              </Text>
            ) : null}
          </View>
        </View>

        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.borderSubtle,
        },
        shadows.md,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Sermon: ${sermon.title}`}
    >
      <View style={[styles.cardThumbnailWrap, { backgroundColor: colors.primarySoft }]}>
        {sermon.thumbnail_url ? (
          <Image source={{ uri: sermon.thumbnail_url }} style={styles.cardThumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderWrap}>
            <Icon name={hasVideo ? 'videocam-outline' : 'mic-outline'} size={32} color={colors.interactive} />
          </View>
        )}
        <View style={styles.formatBadgeWrap}>
          {hasVideo && hasAudio ? (
            <Badge label="WATCH & LISTEN" variant="primary" />
          ) : hasVideo ? (
            <Badge label="VIDEO" variant="primary" />
          ) : (
            <Badge label="AUDIO" variant="neutral" />
          )}
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={[styles.playAffordance, { backgroundColor: colors.primarySoft }]}>
          <Icon name={hasVideo ? 'play' : 'headset'} size={14} color={colors.interactive} />
        </View>
        {sermon.series?.title ? (
          <Text numberOfLines={1} style={[styles.seriesTag, { color: colors.interactive }]}>
            {sermon.series.title}
          </Text>
        ) : null}
        <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.text }]}>
          {sermon.title}
        </Text>

        <View style={styles.cardFooter}>
          <View style={{ flex: 1 }}>
            {preacherName ? (
              <Text numberOfLines={1} style={[styles.preacherName, { color: colors.textSecondary }]}>
                {preacherName}
              </Text>
            ) : null}
            {formattedDate ? (
              <Text style={[styles.dateText, { color: colors.textMuted }]}>
                {formattedDate}
              </Text>
            ) : null}
          </View>
          {sermon.scripture_references && sermon.scripture_references.length > 0 ? (
            <View style={[styles.scripturePill, { backgroundColor: colors.bgSecondary }]}>
              <Text numberOfLines={1} style={[styles.scriptureText, { color: colors.textSecondary }]}>
                {sermon.scripture_references[0]}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardThumbnailWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardThumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatBadgeWrap: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
  },
  cardContent: {
    padding: spacing.md,
    gap: 4,
    position: 'relative',
  },
  playAffordance: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seriesTag: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardTitle: {
    ...typography.h3,
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  preacherName: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    marginTop: 1,
  },
  scripturePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    maxWidth: 120,
  },
  scriptureText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  rowThumbnailWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowThumbnail: {
    width: '100%',
    height: '100%',
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.992 }],
  },
});
