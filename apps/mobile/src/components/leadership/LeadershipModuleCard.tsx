import React from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/state/theme';
import { radius, spacing, typography, shadows } from '@/design-system/tokens';
import { Icon } from '../primitives/Icon';
import { Badge } from '../Badge';

export interface LeadershipModuleCardProps {
  title: string;
  description: string;
  iconName?: string;
  icon?: string; // backwards compatibility
  badge?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function LeadershipModuleCard({
  title,
  description,
  iconName = 'construct-outline',
  badge,
  onPress,
  style,
}: LeadershipModuleCardProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        shadows.sm,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Leadership module: ${title}`}
    >
      <View style={[styles.iconWrapper, { backgroundColor: colors.primarySoft }]}>
        <Icon name={iconName} size={22} color={colors.interactive} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {badge ? <Badge label={badge} variant="primary" /> : null}
        </View>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      </View>

      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.8,
  },
});
