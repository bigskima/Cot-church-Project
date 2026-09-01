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

export function LiveCard({ stream, onPress, style }: LiveCardProps) {
  const isLive = stream.status === 'live';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        isLive ? shadows.live : shadows.sm,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Stream: ${stream.title}`}
    >
      <ImageBackground
        source={stream.thumbnail_url ? { uri: stream.thumbnail_url } : undefined}
        style={styles.background}
        imageStyle={{ borderRadius: radius.md }}
      >
        <LinearGradient
          colors={['rgba(6, 20, 38, 0.1)', 'rgba(6, 20, 38, 0.85)']}
          style={styles.gradient}
        >
          <View style={styles.topRow}>
            <Badge
              label={isLive ? 'LIVE' : 'UPCOMING'}
              variant={isLive ? 'live' : 'primary'}
              pulse={isLive}
            />
          </View>
          <View>
            <Text numberOfLines={2} style={styles.title}>
              {stream.title}
            </Text>
            {stream.scheduled_start ? (
              <Text style={styles.timeText}>
                {new Date(stream.scheduled_start).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
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
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#091B33',
  },
  background: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    backgroundColor: '#0D294B',
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
    opacity: 0.85,
  },
});
