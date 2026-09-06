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

export interface LiveCardProps {
  stream: LiveStream;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

function statusPresentation(status: LiveStream['status']) {
  switch (status) {
    case 'live':
      return { label: 'LIVE', variant: 'live' as const, pulse: true };
    case 'scheduled':
      return { label: 'SCHEDULED', variant: 'primary' as const, pulse: false };
    case 'provisioning':
      return { label: 'PREPARING', variant: 'warning' as const, pulse: false };
    case 'ready':
      return { label: 'READY', variant: 'active' as const, pulse: false };
    case 'processing':
      return { label: 'PROCESSING', variant: 'warning' as const, pulse: false };
    case 'replay_ready':
      return { label: 'REPLAY', variant: 'primary' as const, pulse: false };
    case 'ended':
      return { label: 'ENDED', variant: 'neutral' as const, pulse: false };
    case 'failed':
      return { label: 'UNAVAILABLE', variant: 'neutral' as const, pulse: false };
    default:
      return { label: status.replace(/_/g, ' ').toUpperCase(), variant: 'neutral' as const, pulse: false };
  }
}

export function LiveCard({ stream, onPress, style }: LiveCardProps) {
  const isLive = stream.status === 'live';
  const presentation = statusPresentation(stream.status);

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
      accessibilityLabel={`Stream: ${stream.title}`}
    >
      <ImageBackground
        source={stream.thumbnail_url ? { uri: stream.thumbnail_url } : undefined}
        style={styles.background}
        imageStyle={{ borderRadius: radius.lg }}
      >
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.08)', 'rgba(0, 0, 0, 0.86)']}
          style={styles.gradient}
        >
          <View style={styles.topRow}>
            <Badge
              label={presentation.label}
              variant={presentation.variant}
              pulse={presentation.pulse}
            />
          </View>
          <View>
            <Text numberOfLines={2} style={styles.title}>
              {stream.title}
            </Text>
            {stream.scheduled_start && ['scheduled', 'provisioning', 'ready'].includes(stream.status) ? (
              <Text style={styles.timeText}>
                {new Date(stream.scheduled_start).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            ) : stream.status === 'processing' ? (
              <Text style={styles.timeText}>Recording is being prepared</Text>
            ) : stream.status === 'replay_ready' ? (
              <Text style={styles.timeText}>Replay available</Text>
            ) : null}
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 220,
    height: 140,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  background: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    backgroundColor: '#000000',
  },
  gradient: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  timeText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
});
