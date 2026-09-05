import React from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LiveStream } from '@/types/content';
import { radius, spacing, shadows, typography } from '@/design-system/tokens';
import { Badge } from '../Badge';
import { Icon } from '../primitives/Icon';

export interface HeroLiveCardProps {
  stream: LiveStream;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function HeroLiveCard({ stream, onPress, style }: HeroLiveCardProps) {
  const isLive = stream.status === 'live';
  const isScheduled = stream.status === 'scheduled' || stream.status === 'ready';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        isLive ? shadows.live : shadows.md,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Live stream: ${stream.title}`}
    >
      <ImageBackground
        source={stream.thumbnail_url ? { uri: stream.thumbnail_url } : undefined}
        style={styles.background}
        imageStyle={{ borderRadius: radius.xl }}
      >
        <LinearGradient
          colors={
            isLive
              ? ['rgba(0, 0, 0, 0.08)', 'rgba(0, 0, 0, 0.58)', 'rgba(0, 0, 0, 0.92)']
              : ['rgba(0, 0, 0, 0.12)', 'rgba(0, 0, 0, 0.62)', 'rgba(0, 0, 0, 0.90)']
          }
          style={styles.gradient}
        >
          {/* Top Status Bar */}
          <View style={styles.topRow}>
            <Badge
              label={isLive ? 'LIVE NOW' : isScheduled ? 'UPCOMING SERVICE' : 'REPLAY'}
              variant={isLive ? 'live' : 'primary'}
              pulse={isLive}
              size="md"
            />
            {stream.visibility && (
              <View style={styles.visibilityBadge}>
                <Text style={styles.visibilityText}>
                  {stream.visibility === 'public' ? 'Public Broadcast' : 'Expression Only'}
                </Text>
              </View>
            )}
          </View>

          {/* Bottom Info Area */}
          <View style={styles.bottomContent}>
            <Text numberOfLines={2} style={styles.title}>
              {stream.title}
            </Text>
            {stream.description ? (
              <Text numberOfLines={2} style={styles.description}>
                {stream.description}
              </Text>
            ) : null}

            <View style={styles.ctaRow}>
              <View style={[styles.ctaButton, { backgroundColor: isLive ? '#F04452' : '#168FF0' }]}>
                <Icon
                  name={isLive ? 'play' : 'calendar-outline'}
                  size={15}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.ctaText}>
                  {isLive ? 'Watch live' : 'View details'}
                </Text>
              </View>
              {stream.viewer_count !== undefined && isLive ? (
                <View style={styles.viewerBadge}>
                  <Icon name="eye-outline" size={14} color="#CBD5E1" style={{ marginRight: 4 }} />
                  <Text style={styles.viewerText}>{stream.viewer_count} watching</Text>
                </View>
              ) : null}
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#000000',
    minHeight: 200,
  },
  background: {
    minHeight: 200,
    justifyContent: 'flex-end',
    backgroundColor: '#000000',
  },
  gradient: {
    minHeight: 200,
    padding: spacing.lg,
    justifyContent: 'space-between',
    borderRadius: radius.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visibilityBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  visibilityText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  bottomContent: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  title: {
    color: '#FFFFFF',
    ...typography.h2,
  },
  description: {
    color: '#CBD5E1',
    ...typography.bodySmall,
    lineHeight: 18,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  viewerText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
