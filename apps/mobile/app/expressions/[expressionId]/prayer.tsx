import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components';
import { PrayerExperience } from '@/features/prayer/PrayerExperience';
import { radius, spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

const links = [
  { label: 'Feed', icon: 'chatbubbles-outline', route: 'feed' },
  { label: 'Updates', icon: 'megaphone-outline', route: 'announcements' },
  { label: 'Events', icon: 'calendar-outline', route: 'events' },
] as const;

export default function ExpressionPrayerScreen() {
  const { expressionId } = useLocalSearchParams<{ expressionId: string }>();
  const id = typeof expressionId === 'string' ? expressionId : '';
  const { context } = useSession();
  const { colors } = useTheme();
  const expression = context?.expressions?.find((item) => item.id === id)
    ?? (context?.expression?.id === id ? context.expression : undefined);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.channelBar, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        <View style={styles.identity}>
          <View style={[styles.iconWrap, { backgroundColor: colors.prayerSoft }]}>
            <Icon name="heart" size={18} color={colors.prayer} />
          </View>
          <View style={styles.copy}>
            <View style={styles.scopeRow}>
              <Icon name="lock-closed-outline" size={10} color={colors.textMuted} />
              <Text style={[styles.kicker, { color: colors.textMuted }]}>PRAYER CHANNEL</Text>
            </View>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{expression?.name ?? 'Expression'}</Text>
          </View>
        </View>
        <View style={styles.links}>
          {links.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(`/expressions/${id}/${item.route}` as any)}
              style={({ pressed }) => [
                styles.link,
                { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle },
                pressed ? styles.pressed : null,
              ]}
            >
              <Icon name={item.icon as any} size={14} color={colors.textSecondary} />
              <Text style={[styles.linkText, { color: colors.textSecondary }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.experience}>
        <PrayerExperience scope="expression" embedded />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  channelBar: { marginHorizontal: spacing.md, marginTop: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm, gap: spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kicker: { fontSize: 8, lineHeight: 10, fontWeight: '900', letterSpacing: 0.8 },
  name: { fontSize: 14, lineHeight: 18, fontWeight: '900', marginTop: 1 },
  links: { flexDirection: 'row', gap: spacing.xs },
  link: { flex: 1, minHeight: 32, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  linkText: { fontSize: 9, lineHeight: 12, fontWeight: '800' },
  experience: { flex: 1, minHeight: 0 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
