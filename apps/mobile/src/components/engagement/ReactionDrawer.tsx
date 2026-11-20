import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';

// Keys are canonical backend values. Only the presentation labels are church-friendly.
const reactions = [
  { key: 'like', label: 'Amen', icon: 'heart' },
  { key: 'pray', label: 'Pray', icon: 'hand-left-outline' },
  { key: 'celebrate', label: 'Praise', icon: 'sparkles-outline' },
  { key: 'support', label: 'Support', icon: 'people-outline' },
] as const;

export interface ReactionDrawerProps {
  currentReaction?: string | null;
  onReact: (reactionKey: string) => void;
}

export function ReactionDrawer({ currentReaction, onReact }: ReactionDrawerProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.md]}>
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
                borderColor: isSelected ? colors.interactive : colors.borderSubtle,
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`React ${reaction.label}`}
            accessibilityState={{ selected: isSelected }}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: isSelected ? colors.interactive : colors.cardElevated,
                  borderColor: isSelected ? colors.interactive : colors.borderSubtle,
                },
              ]}
            >
              <Icon name={reaction.icon} size={15} color={isSelected ? '#FFFFFF' : colors.textSecondary} />
            </View>
            <Text
              numberOfLines={1}
              style={[styles.label, { color: isSelected ? colors.interactive : colors.textSecondary }]}
            >
              {reaction.label}
            </Text>
            {isSelected ? <View style={[styles.selectedDot, { backgroundColor: colors.interactive }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    padding: 5,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: 5,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    maxWidth: '100%',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  selectedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
});
