import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CommunityExperience } from '@/features/community/CommunityExperience';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
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
        <View style={[styles.feedIntro, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
          <View style={styles.headingRow}>
            <View style={[styles.feedIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="layers-outline" size={20} color={colors.interactive} />
            </View>
            <View style={styles.flex}>
              <View style={styles.eyebrowRow}>
                <Icon name="lock-closed-outline" size={10} color={colors.interactive} />
                <Text style={[styles.eyebrow, { color: colors.interactive }]}>EXPRESSION FEED</Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{expressionName}</Text>
              <Text style={[styles.copy, { color: colors.textMuted }]}>Posts and member activity use the same familiar COT feed design, while staying private to this Expression.</Text>
            </View>
            <Pressable
              onPress={() => router.push(`/expressions/${id}` as any)}
              accessibilityRole="button"
              accessibilityLabel="Expression home"
              style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
            >
              <Icon name="home-outline" size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => router.push(`/expressions/${id}/chat` as any)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
            >
              <Icon name="chatbubbles-outline" size={15} color={colors.interactive} />
              <Text style={[styles.actionText, { color: colors.text }]}>General discussion</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/expressions/${id}/reels` as any)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
            >
              <Icon name="flash-outline" size={15} color={colors.interactive} />
              <Text style={[styles.actionText, { color: colors.text }]}>Reels</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/expressions/${id}/members` as any)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
            >
              <Icon name="people-outline" size={15} color={colors.interactive} />
              <Text style={[styles.actionText, { color: colors.text }]}>People</Text>
            </Pressable>
          </View>
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
  feedIntro: { marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feedIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrow: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 17, lineHeight: 21, fontWeight: '900', letterSpacing: -0.3, marginTop: 2 },
  copy: { fontSize: 10.5, lineHeight: 15, marginTop: 2, maxWidth: 620 },
  roundButton: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actionButton: { minHeight: 38, flexGrow: 1, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionText: { fontSize: 10, fontWeight: '800' },
  feed: { flex: 1, minHeight: 0 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
});
