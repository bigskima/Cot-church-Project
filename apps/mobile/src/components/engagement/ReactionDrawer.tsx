import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/state/theme';
import { palette, radius, shadows, spacing } from '@/design-system/tokens';

const reactions = [
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'pray', emoji: '🙏', label: 'Pray' },
  { key: 'celebrate', emoji: '🔥', label: 'Fire' },
  { key: 'amen', emoji: '🕊️', label: 'Amen' },
  { key: 'support', emoji: '🤝', label: 'Support' },
];

interface ReactionDrawerProps {
  currentReaction?: string | null;
  onReact: (reactionKey: string) => void;
}

export function ReactionDrawer({ currentReaction, onReact }: ReactionDrawerProps) {
  const { isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#1C1008' : '#FFFDF9',
          borderColor: isDark ? '#3D2415' : palette.line,
        },
        shadows.sm,
      ] as any}
    >
      {reactions.map((r) => {
        const isSelected = currentReaction === r.key;
        return (
          <Pressable
            key={r.key}
            onPress={() => onReact(r.key)}
            style={({ pressed }) => [
              styles.pill,
              isSelected ? styles.pillSelected : null,
              pressed ? styles.pressed : null,
            ] as any}
          >
            <Text style={{ fontSize: 16 } as any}>{r.emoji}</Text>
            <Text
              style={[
                styles.label,
                { color: isSelected ? palette.gold : isDark ? '#A68A75' : '#8C6549' },
              ] as any}
            >
              {r.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  pillSelected: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: palette.gold,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
});
