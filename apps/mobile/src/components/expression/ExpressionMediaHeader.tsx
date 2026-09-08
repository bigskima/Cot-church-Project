import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

export type ExpressionMediaSection = 'live' | 'sermons' | 'videos' | 'reels';

type Props = {
  expressionId: string;
  expressionName: string;
  active: ExpressionMediaSection;
  title: string;
  subtitle: string;
  icon: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
};

const tabs: Array<{ key: ExpressionMediaSection; label: string; icon: string }> = [
  { key: 'live', label: 'Live', icon: 'radio-outline' },
  { key: 'sermons', label: 'Sermons', icon: 'mic-outline' },
  { key: 'videos', label: 'Videos', icon: 'videocam-outline' },
  { key: 'reels', label: 'Reels', icon: 'flash-outline' },
];

export function ExpressionMediaHeader({
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
            <Icon name="lock-closed-outline" size={11} color={colors.interactive} />
            <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION MEDIA</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>{subtitle}</Text>
          <Text style={[styles.expression, { color: colors.textMuted }]} numberOfLines={1}>{expressionName} · Members only</Text>
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

      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <Pressable
              key={tab.key}
              onPress={() => router.push(`/expressions/${expressionId}/${tab.key}` as any)}
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
      </View>

      {onAction && actionLabel ? (
        <Pressable
          onPress={() => router.push(`/expressions/${expressionId}` as any)}
          style={({ pressed }) => [styles.homeLink, pressed ? styles.pressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Expression home"
        >
          <Icon name="home-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.homeLinkText, { color: colors.textMuted }]}>Expression home</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.xs, padding: spacing.md, borderWidth: 1, borderRadius: radius.xl },
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
  tabs: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  tab: { flex: 1, minHeight: 34, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabText: { fontSize: 9, lineHeight: 12, fontWeight: '800' },
  homeLink: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 26 },
  homeLinkText: { fontSize: 9, fontWeight: '800' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
