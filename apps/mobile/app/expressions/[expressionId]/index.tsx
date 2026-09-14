import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components';
import { ExpressionLayeredHomeExperience } from '@/features/expression/ExpressionLayeredHomeExperience';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

export default function ExpressionHomeScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId?: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { colors } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Pressable
        onPress={() => id && router.push(`/expressions/${id}/notifications` as any)}
        accessibilityRole="button"
        accessibilityLabel="Open Expression notifications"
        style={({ pressed }) => [
          styles.notificationBar,
          { backgroundColor: colors.card, borderColor: colors.borderSubtle },
          shadows.sm,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name="notifications-outline" size={18} color={colors.interactive} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>Expression notifications</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Only updates from this Expression</Text>
        </View>
        <Icon name="chevron-forward" size={17} color={colors.textMuted} />
      </Pressable>
      <View style={styles.content}>
        <ExpressionLayeredHomeExperience expressionId={id} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1 },
  notificationBar: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    minHeight: 58,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 12.5, fontWeight: '800' },
  subtitle: { fontSize: 10.5, marginTop: 2 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
