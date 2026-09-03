import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';

// Keys match the backend reaction contract. Labels remain church-friendly presentation copy.
const reactions = [
  { key: 'like', label: 'Amen', icon: 'heart' },
  { key: 'pray', label: 'Pray', icon: 'hand-left-outline' },
  { key: 'celebrate', label: 'Praise', icon: 'sparkles-outline' },
  { key: 'support', label: 'Support', icon: 'people-outline' },
];

export interface ReactionDrawerProps {
  currentReaction?: string | null;
  onReact: (reactionKey: string) => void;
}

export function ReactionDrawer({ currentReaction, onReact }: ReactionDrawerProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}>
      {reactions.map((reaction) => {
        const isSelected = currentReaction === reaction.key;
        return (
          <Pressable
            key={reaction.key}
            onPress={() => onReact(reaction.key)}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: isSelected ? colors.primarySoft : colors.bgSecondary,
                borderColor: isSelected ? colors.interactive : colors.border,
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`React ${reaction.label}`}
          >
            <Icon name={reaction.icon} size={15} color={isSelected ? colors.interactive : colors.textSecondary} />
            <Text style={[styles.label, { color: isSelected ? colors.interactive : colors.textSecondary }]}>{reaction.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  label: { fontSize: 12, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.95 }] },
});
