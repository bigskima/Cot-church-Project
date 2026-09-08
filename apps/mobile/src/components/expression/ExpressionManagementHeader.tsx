import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

export type ExpressionManagementSection =
  | 'tools'
  | 'studio'
  | 'live'
  | 'sermons'
  | 'events'
  | 'leadership'
  | 'invites'
  | 'access'
  | 'giving'
  | 'finance'
  | 'settings';

type Props = {
  expressionId: string;
  expressionName: string;
  active: ExpressionManagementSection;
  title: string;
  subtitle: string;
  icon: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
};

const tabs: Array<{ key: ExpressionManagementSection; label: string; icon: string }> = [
  { key: 'tools', label: 'Tools', icon: 'grid-outline' },
  { key: 'studio', label: 'Studio', icon: 'color-wand-outline' },
  { key: 'live', label: 'Live', icon: 'radio-outline' },
  { key: 'sermons', label: 'Sermons', icon: 'book-outline' },
  { key: 'events', label: 'Events', icon: 'calendar-outline' },
  { key: 'leadership', label: 'Leaders', icon: 'people-circle-outline' },
  { key: 'invites', label: 'Invites', icon: 'key-outline' },
  { key: 'access', label: 'Access', icon: 'shield-checkmark-outline' },
  { key: 'giving', label: 'Giving', icon: 'gift-outline' },
  { key: 'finance', label: 'Reports', icon: 'analytics-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline' },
];

function sectionPath(expressionId: string, key: ExpressionManagementSection) {
  if (key === 'tools') return `/expressions/${expressionId}/manage`;
  if (key === 'studio') return `/expressions/${expressionId}/manage/studio`;
  if (key === 'live') return `/expressions/${expressionId}/manage/live`;
  if (key === 'sermons') return `/expressions/${expressionId}/manage/sermons`;
  if (key === 'events') return `/expressions/${expressionId}/manage/events`;
  if (key === 'leadership') return `/expressions/${expressionId}/manage/leadership`;
  if (key === 'invites') return `/expressions/${expressionId}/manage/invite-codes`;
  if (key === 'access') return `/expressions/${expressionId}/manage/access`;
  if (key === 'giving') return `/expressions/${expressionId}/manage/giving`;
  if (key === 'finance') return `/expressions/${expressionId}/manage/finance`;
  return `/expressions/${expressionId}/manage/settings`;
}

export function ExpressionManagementHeader({
  expressionId,
  expressionName,
  active,
  title,
  subtitle,
  icon,
  actionLabel,
  actionIcon = 'add-outline',
  onAction,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name={icon as any} size={21} color={colors.interactive} />
        </View>
        <View style={styles.copy}>
          <View style={styles.eyebrowRow}>
            <Icon name="shield-checkmark-outline" size={11} color={colors.interactive} />
            <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION OPERATIONS</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>{subtitle}</Text>
          <Text style={[styles.expression, { color: colors.textMuted }]} numberOfLines={1}>{expressionName}</Text>
        </View>

        {onAction && actionLabel ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.primarySoft, borderColor: colors.interactive },
              pressed ? styles.pressed : null,
            ]}
          >
            <Icon name={actionIcon as any} size={15} color={colors.interactive} />
            <Text style={[styles.actionText, { color: colors.interactive }]}>{actionLabel}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push(`/expressions/${expressionId}` as any)}
            accessibilityRole="button"
            accessibilityLabel="Expression home"
            style={({ pressed }) => [
              styles.homeButton,
              { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
              pressed ? styles.pressed : null,
            ]}
          >
            <Icon name="home-outline" size={17} color={colors.text} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <Pressable
              key={tab.key}
              onPress={() => router.push(sectionPath(expressionId, tab.key) as any)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              style={({ pressed }) => [
                styles.tab,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.bgSecondary,
                  borderColor: selected ? colors.interactive : colors.borderSubtle,
                },
                pressed ? styles.pressed : null,
              ]}
            >
              <Icon name={tab.icon as any} size={14} color={selected ? colors.interactive : colors.textSecondary} />
              <Text style={[styles.tabText, { color: selected ? colors.interactive : colors.textSecondary }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  iconWrap: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.8 },
  title: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.35, marginTop: 1 },
  subtitle: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  expression: { fontSize: 10, lineHeight: 14, marginTop: 3, fontWeight: '700' },
  homeButton: { width: 38, height: 38, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionButton: { minHeight: 36, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionText: { fontSize: 9, lineHeight: 12, fontWeight: '900' },
  tabs: { gap: spacing.xs, paddingTop: spacing.md, paddingRight: spacing.sm },
  tab: { minHeight: 34, minWidth: 76, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  tabText: { fontSize: 9, lineHeight: 12, fontWeight: '800' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
