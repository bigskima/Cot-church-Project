import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';

export interface MediaShelfCardProps {
  label: 'REEL' | 'WATCH';
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  thumbnailUrl?: string | null;
  width: number;
  aspectRatio?: number;
  onPress: () => void;
}

export function MediaShelfCard({ label, title, subtitle, meta, thumbnailUrl, width, aspectRatio = 16 / 9, onPress }: MediaShelfCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${label === 'REEL' ? 'Reel' : 'video'}: ${title}`} style={({ pressed }) => [styles.card, { width, backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}>
      <View style={[styles.media, { aspectRatio, backgroundColor: colors.cardElevated }]}>{thumbnailUrl ? <Image source={{ uri: thumbnailUrl }} style={styles.image} resizeMode="cover" /> : <View style={styles.placeholder}><View style={[styles.placeholderIcon, { backgroundColor: colors.primarySoft }]}><Icon name={label === 'REEL' ? 'flash-outline' : 'videocam-outline'} size={23} color={colors.interactive} /></View></View>}<View style={styles.label}><Text style={styles.labelText}>{label}</Text></View><View style={styles.playButton}><Icon name="play" size={14} color="#FFFFFF" /></View></View>
      <View style={styles.copy}><Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}{meta ? <Text numberOfLines={1} style={[styles.meta, { color: colors.textMuted }]}>{meta}</Text> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  media: { width: '100%', position: 'relative', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  label: { position: 'absolute', left: spacing.sm, top: spacing.sm, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(4,12,24,0.74)' },
  labelText: { color: '#FFFFFF', fontSize: 8, lineHeight: 10, fontWeight: '900', letterSpacing: 0.8 },
  playButton: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,12,24,0.76)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)' },
  copy: { padding: spacing.sm, gap: 3 },
  title: { fontSize: 12.5, lineHeight: 17, fontWeight: '900' },
  subtitle: { fontSize: 10.5, lineHeight: 14, fontWeight: '600' },
  meta: { fontSize: 9.5, lineHeight: 13 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
});
