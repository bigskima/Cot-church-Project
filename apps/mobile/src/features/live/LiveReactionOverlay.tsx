import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

export type LiveReactionKind = 'heart' | 'prayer' | 'fire' | 'amen';

export type LiveReactionBurst = {
  id: string;
  reaction: LiveReactionKind;
};

const reactionMeta: Record<LiveReactionKind, { symbol: string; label: string }> = {
  heart: { symbol: '❤️', label: 'Love' },
  prayer: { symbol: '🙏', label: 'Pray' },
  fire: { symbol: '🔥', label: 'Fire' },
  amen: { symbol: '🙌', label: 'Amen' },
};

function FloatingReaction({ burst, onComplete }: { burst: LiveReactionBurst; onComplete: (id: string) => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const lane = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < burst.id.length; i += 1) hash = ((hash << 5) - hash + burst.id.charCodeAt(i)) | 0;
    return Math.abs(hash % 4);
  }, [burst.id]);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onComplete(burst.id);
    });
    return () => animation.stop();
  }, [burst.id, onComplete, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -180 - lane * 12] });
  const translateX = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, lane % 2 === 0 ? -18 : 18, lane % 2 === 0 ? 10 : -10] });
  const scale = progress.interpolate({ inputRange: [0, 0.18, 0.8, 1], outputRange: [0.55, 1.18, 1, 0.88] });
  const opacity = progress.interpolate({ inputRange: [0, 0.08, 0.78, 1], outputRange: [0, 1, 0.95, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.burst,
        {
          right: 20 + lane * 9,
          opacity,
          transform: [{ translateY }, { translateX }, { scale }],
        },
      ]}
    >
      <Text style={styles.burstText}>{reactionMeta[burst.reaction].symbol}</Text>
    </Animated.View>
  );
}

export function LiveReactionOverlay({
  bursts,
  disabled = false,
  compact = false,
  onReact,
  onDismissBurst,
}: {
  bursts: LiveReactionBurst[];
  disabled?: boolean;
  compact?: boolean;
  onReact: (reaction: LiveReactionKind) => void;
  onDismissBurst: (id: string) => void;
}) {
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {bursts.map((burst) => (
          <FloatingReaction key={burst.id} burst={burst} onComplete={onDismissBurst} />
        ))}
      </View>

      <View style={[styles.dock, compact && styles.dockCompact]}>
        {(Object.keys(reactionMeta) as LiveReactionKind[]).map((reaction) => {
          const meta = reactionMeta[reaction];
          return (
            <Pressable
              key={reaction}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={meta.label}
              onPress={() => onReact(reaction)}
              style={({ pressed }) => [
                styles.reactionButton,
                compact && styles.reactionButtonCompact,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
              ]}
            >
              <Text style={[styles.reactionSymbol, compact && styles.reactionSymbolCompact]}>{meta.symbol}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    right: 12,
    bottom: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(5,10,18,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dockCompact: { right: 10, bottom: 58, gap: 4, padding: 4 },
  reactionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  reactionButtonCompact: { width: 32, height: 32, borderRadius: 16 },
  reactionSymbol: { fontSize: 19 },
  reactionSymbolCompact: { fontSize: 16 },
  disabled: { opacity: 0.38 },
  pressed: { transform: [{ scale: 0.9 }], backgroundColor: 'rgba(255,255,255,0.16)' },
  burst: { position: 'absolute', bottom: 108 },
  burstText: { fontSize: 34, textShadowColor: 'rgba(0,0,0,0.44)', textShadowRadius: 6 },
});
