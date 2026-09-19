import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CommunityExperience } from '@/features/community/CommunityExperience';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { Icon } from '@/components';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

export default function ExpressionFeedScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { context } = useSession();
  const { colors } = useTheme();
  const expression = context?.expressions?.find((item) => item.id === id)
    ?? (context?.expression?.id === id ? context.expression : undefined);
  const expressionName = expression?.name ?? 'Your Expression';

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <TourAnchor targetKey="expression.feed.header">
        <View style={styles.feedIntro}>
          <Pressable
            onPress={() => router.push(`/expressions/${id}` as any)}
            accessibilityRole="button"
            accessibilityLabel="Expression home"
            style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
          >
            <Icon name="arrow-back" size={18} color={colors.text} />
          </Pressable>

          <View style={styles.flex}>
            <View style={styles.eyebrowRow}>
              <Icon name="lock-closed-outline" size={10} color={colors.interactive} />
              <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION FEED</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{expressionName}</Text>
          </View>

          <Pressable
            onPress={() => router.push(`/expressions/${id}/chat` as any)}
            accessibilityRole="button"
            accessibilityLabel="Open Expression chat"
            style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
          >
            <Icon name="chatbubbles-outline" size={18} color={colors.interactive} />
          </Pressable>
          <Pressable
            onPress={() => router.push(`/expressions/${id}/members` as any)}
            accessibilityRole="button"
            accessibilityLabel="Open Expression people"
            style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
          >
            <Icon name="people-outline" size={18} color={colors.text} />
          </Pressable>
        </View>
      </TourAnchor>

      <View style={styles.feed}>
        <CommunityExperience scope="expression" embedded />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  feedIntro: {
    minHeight: 58,
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: 2,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrow: { fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 16, lineHeight: 20, fontWeight: '900', letterSpacing: -0.25, marginTop: 1 },
  roundButton: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  feed: { flex: 1, minHeight: 0 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
});
