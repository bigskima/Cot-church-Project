import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CommunityExperience } from '@/features/community/CommunityExperience';
import { Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

const shortcuts = [
  { key: 'announcements', label: 'Updates', icon: 'megaphone-outline', route: 'announcements' },
  { key: 'prayer', label: 'Prayer', icon: 'heart-outline', route: 'prayer' },
  { key: 'events', label: 'Events', icon: 'calendar-outline', route: 'events' },
  { key: 'members', label: 'People', icon: 'people-outline', route: 'members' },
] as const;

export default function ExpressionFeedScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { context } = useSession();
  const { colors } = useTheme();
  const expression = context?.expressions?.find((item) => item.id === id)
    ?? (context?.expression?.id === id ? context.expression : undefined);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.channelHeader, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={styles.titleRow}>
          <View style={[styles.channelMark, { backgroundColor: colors.primarySoft }]}>
            <Icon name="chatbubbles-outline" size={20} color={colors.interactive} />
          </View>
          <View style={styles.titleCopy}>
            <View style={styles.eyebrowRow}>
              <Icon name="lock-closed-outline" size={11} color={colors.interactive} />
              <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION CHANNEL</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>Community feed</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {expression?.name ?? 'Your Expression'} · Members only
            </Text>
          </View>
          <Pressable
            onPress={() => router.push(`/expressions/${id}` as any)}
            accessibilityRole="button"
            accessibilityLabel="Expression home"
            style={({ pressed }) => [
              styles.homeButton,
              { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
              pressed ? styles.pressed : null,
            ]}
          >
            <Icon name="home-outline" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.shortcuts}>
          {shortcuts.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => router.push(`/expressions/${id}/${item.route}` as any)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={({ pressed }) => [
                styles.shortcut,
                { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
                pressed ? styles.pressed : null,
              ]}
            >
              <Icon name={item.icon as any} size={15} color={colors.textSecondary} />
              <Text style={[styles.shortcutText, { color: colors.textSecondary }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.feed}>
        <CommunityExperience scope="expression" embedded />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  channelHeader: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  channelMark: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.8 },
  title: { fontSize: 18, lineHeight: 22, fontWeight: '900', letterSpacing: -0.35, marginTop: 1 },
  subtitle: { fontSize: 10, lineHeight: 14, marginTop: 1 },
  homeButton: { width: 38, height: 38, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  shortcuts: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  shortcut: { flex: 1, minHeight: 34, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  shortcutText: { fontSize: 9, lineHeight: 12, fontWeight: '800' },
  feed: { flex: 1, minHeight: 0 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
