import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

export type UrgentHomeAnnouncement = {
  id: string;
  title: string;
  body: string;
  published_at?: string | null;
  created_at?: string | null;
};

export function UrgentUpdatesRail({ announcements }: { announcements: UrgentHomeAnnouncement[] }) {
  const { colors } = useTheme();
  const items = announcements.slice(0, 8);
  if (!items.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={[styles.liveMark, { backgroundColor: colors.liveSoft }]}><Icon name="alert-circle" size={17} color={colors.live} /></View>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, { color: colors.live }]}>IMPORTANT UPDATES</Text>
          <Text style={[styles.title, { color: colors.text }]}>What COT needs you to know</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Official updates published from Ministry Workspace. Swipe sideways to see more.</Text>
        </View>
        <Pressable onPress={() => router.push('/general/announcements' as any)} hitSlop={8} style={({ pressed }) => [styles.allButton, { borderColor: colors.borderSubtle, backgroundColor: colors.card }, pressed && styles.pressed]}>
          <Text style={[styles.allText, { color: colors.text }]}>All</Text><Icon name="arrow-forward" size={13} color={colors.interactive} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} decelerationRate="fast" snapToAlignment="start">
        {items.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => router.push('/general/announcements' as any)}
            style={({ pressed }) => [styles.card, { backgroundColor: index === 0 ? colors.primarySoft : colors.card, borderColor: index === 0 ? colors.primarySoftStrong : colors.borderSubtle }, shadows.sm, pressed && styles.pressed]}
          >
            <View style={styles.cardTop}>
              <View style={[styles.number, { backgroundColor: colors.cardElevated }]}><Text style={[styles.numberText, { color: colors.interactive }]}>{String(index + 1).padStart(2, '0')}</Text></View>
              <Text style={[styles.date, { color: colors.textMuted }]}>{new Date(item.published_at || item.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={3}>{item.body}</Text>
            <View style={styles.footer}><Text style={[styles.open, { color: colors.interactive }]}>Open update</Text><Icon name="chevron-forward" size={14} color={colors.interactive} /></View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveMark: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.35, marginTop: 1 },
  subtitle: { fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  allButton: { minHeight: 35, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  allText: { fontSize: 10, fontWeight: '900' },
  rail: { gap: spacing.sm, paddingRight: spacing.lg, paddingBottom: 2 },
  card: { width: 276, minHeight: 154, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: 7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { minWidth: 32, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  numberText: { fontSize: 9, fontWeight: '900' },
  date: { fontSize: 9.5, fontWeight: '700' },
  cardTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '900' },
  body: { fontSize: 11, lineHeight: 16 },
  footer: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  open: { fontSize: 10.5, fontWeight: '900' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
