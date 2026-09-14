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
  variant?: 'card' | 'row' | 'discovery';
  style?: StyleProp<ViewStyle>;
}

export function SermonCard({ sermon, onPress, variant = 'card', style }: SermonCardProps) {
  const { colors } = useTheme();
  const hasVideo = !!sermon.video_url || !!sermon.video_asset_id;
  const hasAudio = !!sermon.audio_url || !!sermon.audio_asset_id;
  const preacherName = sermon.preacher || sermon.preacher_name;
  const formattedDate = sermon.sermon_date
    ? new Date(sermon.sermon_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  if (variant === 'row') {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.rowContainer, { borderBottomColor: colors.border }, pressed && styles.pressed, style]}>
        <View style={[styles.rowThumbnailWrap, { backgroundColor: colors.primarySoft }]}>
          {sermon.thumbnail_url ? <Image source={{ uri: sermon.thumbnail_url }} style={styles.rowThumbnail} resizeMode="cover" /> : <Icon name={hasVideo ? 'videocam-outline' : 'mic-outline'} size={24} color={colors.interactive} />}
        </View>
        <View style={styles.rowContent}>
          {sermon.series?.title ? <Text numberOfLines={1} style={[styles.seriesTag, { color: colors.interactive }]}>{sermon.series.title}</Text> : null}
          <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>{sermon.title}</Text>
          <View style={styles.rowMeta}>
            {preacherName ? <Text numberOfLines={1} style={[styles.metaText, { color: colors.textSecondary }]}>{preacherName}</Text> : null}
            {formattedDate ? <Text style={[styles.metaText, { color: colors.textMuted }]}>{preacherName ? ' · ' : ''}{formattedDate}</Text> : null}
          </View>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  }

  if (variant === 'discovery') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Sermon: ${sermon.title}`}
        style={({ pressed }) => [styles.discoveryCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, pressed && styles.pressed, style]}
      >
        <View style={[styles.discoveryMedia, { backgroundColor: colors.primarySoft }]}>
          {sermon.thumbnail_url ? <Image source={{ uri: sermon.thumbnail_url }} style={styles.cardThumbnail} resizeMode="cover" /> : <View style={styles.placeholderWrap}><Icon name={hasVideo ? 'play-circle-outline' : 'headset-outline'} size={34} color={colors.interactive} /></View>}
          <View style={[styles.discoveryPlay, { backgroundColor: colors.glass, borderColor: colors.borderSubtle }]}><Icon name={hasVideo ? 'play' : 'headset'} size={15} color={colors.text} /></View>
          <View style={styles.discoveryMediaBadge}><Text style={styles.discoveryMediaBadgeText}>{hasVideo ? 'WATCH' : 'LISTEN'}</Text></View>
        </View>
        <View style={styles.discoveryBody}>
          {sermon.series?.title ? <Text numberOfLines={1} style={[styles.discoveryKicker, { color: colors.interactive }]}>{sermon.series.title}</Text> : <Text style={[styles.discoveryKicker, { color: colors.interactive }]}>SERMON</Text>}
          <Text numberOfLines={2} style={[styles.discoveryTitle, { color: colors.text }]}>{sermon.title}</Text>
          <View style={styles.discoveryFooter}>
            <View style={styles.discoveryMetaCopy}>
              {preacherName ? <Text numberOfLines={1} style={[styles.discoveryPreacher, { color: colors.textSecondary }]}>{preacherName}</Text> : null}
              {formattedDate ? <Text style={[styles.discoveryDate, { color: colors.textMuted }]}>{formattedDate}</Text> : null}
            </View>
            <View style={[styles.discoveryArrow, { backgroundColor: colors.bgSecondary }]}><Icon name="arrow-forward" size={14} color={colors.interactive} /></View>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={`Sermon: ${sermon.title}`}
    >
      <View style={[styles.cardThumbnailWrap, { backgroundColor: colors.primarySoft }]}>
        {sermon.thumbnail_url ? <Image source={{ uri: sermon.thumbnail_url }} style={styles.cardThumbnail} resizeMode="cover" /> : <View style={styles.placeholderWrap}><Icon name={hasVideo ? 'videocam-outline' : 'mic-outline'} size={32} color={colors.interactive} /></View>}
        <View style={styles.formatBadgeWrap}>{hasVideo && hasAudio ? <Badge label="WATCH & LISTEN" variant="primary" /> : hasVideo ? <Badge label="VIDEO" variant="primary" /> : <Badge label="AUDIO" variant="neutral" />}</View>
      </View>
      <View style={styles.cardContent}>
        <View style={[styles.playAffordance, { backgroundColor: colors.primarySoft }]}><Icon name={hasVideo ? 'play' : 'headset'} size={14} color={colors.interactive} /></View>
        {sermon.series?.title ? <Text numberOfLines={1} style={[styles.seriesTag, { color: colors.interactive }]}>{sermon.series.title}</Text> : null}
        <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.text }]}>{sermon.title}</Text>
        <View style={styles.cardFooter}>
          <View style={{ flex: 1 }}>
            {preacherName ? <Text numberOfLines={1} style={[styles.preacherName, { color: colors.textSecondary }]}>{preacherName}</Text> : null}
            {formattedDate ? <Text style={[styles.dateText, { color: colors.textMuted }]}>{formattedDate}</Text> : null}
          </View>
          {sermon.scripture_references?.length ? <View style={[styles.scripturePill, { backgroundColor: colors.bgSecondary }]}><Text numberOfLines={1} style={[styles.scriptureText, { color: colors.textSecondary }]}>{sermon.scripture_references[0]}</Text></View> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.md },
  cardThumbnailWrap: { width: '100%', aspectRatio: 16 / 9, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  cardThumbnail: { width: '100%', height: '100%' }, placeholderWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  formatBadgeWrap: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  cardContent: { padding: spacing.md, gap: 4, position: 'relative' }, playAffordance: { position: 'absolute', right: spacing.md, top: spacing.md, width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  seriesTag: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65, textTransform: 'uppercase' }, cardTitle: { ...typography.h3, lineHeight: 22, paddingRight: 36 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs, paddingTop: spacing.xs }, preacherName: { fontSize: 13, fontWeight: '700' }, dateText: { fontSize: 10.5, marginTop: 2 }, scripturePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, maxWidth: 128 }, scriptureText: { fontSize: 10, fontWeight: '700' },
  rowContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1 }, rowThumbnailWrap: { width: 64, height: 64, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }, rowThumbnail: { width: '100%', height: '100%' }, rowContent: { flex: 1, gap: 2 }, rowTitle: { fontSize: 15, fontWeight: '700' }, rowMeta: { flexDirection: 'row', alignItems: 'center' }, metaText: { fontSize: 12 },
  discoveryCard: { width: '100%', borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  discoveryMedia: { width: '100%', aspectRatio: 16 / 10, position: 'relative', overflow: 'hidden' },
  discoveryPlay: { position: 'absolute', right: 10, bottom: 10, width: 36, height: 36, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  discoveryMediaBadge: { position: 'absolute', top: 10, left: 10, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(5,11,20,0.74)' },
  discoveryMediaBadgeText: { color: '#FFFFFF', fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.7 },
  discoveryBody: { padding: spacing.md, gap: 4 }, discoveryKicker: { fontSize: 8.5, lineHeight: 12, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase' }, discoveryTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900', letterSpacing: -0.25 },
  discoveryFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 5 }, discoveryMetaCopy: { flex: 1, minWidth: 0 }, discoveryPreacher: { fontSize: 11.5, lineHeight: 15, fontWeight: '700' }, discoveryDate: { fontSize: 9.5, lineHeight: 13, marginTop: 1 }, discoveryArrow: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
});
