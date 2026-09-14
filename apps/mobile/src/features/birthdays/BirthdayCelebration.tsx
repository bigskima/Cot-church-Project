import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Button, Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

export type BirthdayEntry = {
  profile_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  birthday_month: number;
  birthday_day: number;
  next_birthday: string;
  days_until: number;
};

const balloonSeeds = [0, 1, 2, 3, 4, 5];

export function BirthdayBalloons({ active }: { active: boolean }) {
  const values = useRef(balloonSeeds.map(() => new Animated.Value(0))).current;
  const animations = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    animations.current.forEach((animation) => animation.stop());
    animations.current = [];
    values.forEach((value) => value.setValue(0));
    if (!active) return;

    animations.current = values.map((value, index) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 620),
          Animated.timing(value, { toValue: 1, duration: 5200 + index * 240, useNativeDriver: true }),
          Animated.delay(900 + ((index + 2) % 3) * 420),
          Animated.timing(value, { toValue: 0, duration: 1, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return loop;
    });

    return () => animations.current.forEach((animation) => animation.stop());
  }, [active, values]);

  if (!active) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {values.map((value, index) => (
        <Animated.Text
          key={index}
          style={[
            styles.balloon,
            {
              left: `${6 + ((index * 17) % 88)}%`,
              opacity: value.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] }),
              transform: [
                { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [240, -170] }) },
                { rotate: value.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-7deg', '7deg', '-4deg'] }) },
                { scale: value.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0.72, 1, 1.05] }) },
              ],
            },
          ]}
        >
          🎈
        </Animated.Text>
      ))}
    </View>
  );
}

export function BirthdayShelf({
  entries,
  scope,
  expressionId,
  onSeeAll,
}: {
  entries: BirthdayEntry[];
  scope: 'general' | 'expression';
  expressionId?: string;
  onSeeAll?: () => void;
}) {
  const { colors } = useTheme();
  const today = useMemo(() => entries.filter((entry) => entry.days_until === 0), [entries]);
  if (!today.length) return null;

  const openProfile = (entry: BirthdayEntry) => {
    if (!entry.username) return;
    router.push({ pathname: '/general/member/[username]', params: { username: entry.username } } as any);
  };
  const message = (entry: BirthdayEntry) => {
    if (!entry.username) return;
    router.push({
      pathname: scope === 'expression' && expressionId ? `/expressions/${expressionId}/chat` : '/general/chat',
      params: { username: entry.username },
    } as any);
  };

  return (
    <View style={[styles.shelf, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }, shadows.sm]}>
      <BirthdayBalloons active />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.eyebrowRow}><Icon name="gift-outline" size={15} color={colors.interactive} /><Text style={[styles.eyebrow, { color: colors.interactive }]}>BIRTHDAYS TODAY</Text></View>
          <Text style={[styles.title, { color: colors.text }]}>{today.length === 1 ? 'Celebrate with them 🎉' : `Celebrate ${today.length} people today 🎉`}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>No one needs to make a birthday post. COT shows people automatically from the birthday visibility they chose.</Text>
        </View>
        {onSeeAll ? <Pressable onPress={onSeeAll}><Text style={[styles.seeAll, { color: colors.interactive }]}>See all</Text></Pressable> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {today.map((entry) => (
          <Pressable key={entry.profile_id} onPress={() => openProfile(entry)} style={[styles.personCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <Avatar url={entry.avatar_url} name={entry.display_name} size="lg" />
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{entry.display_name}</Text>
            {entry.username ? <Text style={[styles.username, { color: colors.textMuted }]} numberOfLines={1}>@{entry.username}</Text> : null}
            <View style={styles.actions}>
              {entry.username ? <Button label="Message" onPress={() => message(entry)} variant="outline" size="sm" /> : null}
              {entry.username ? (
                <Pressable onPress={() => openProfile(entry)} style={[styles.profileButton, { backgroundColor: colors.bgSecondary }]}>
                  <Icon name="person-outline" size={15} color={colors.interactive} />
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  balloon: { position: 'absolute', bottom: 0, fontSize: 29 },
  shelf: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderRadius: radius.xxl, paddingVertical: spacing.md, marginVertical: spacing.sm },
  header: { paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, zIndex: 2 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 3 },
  subtitle: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  seeAll: { fontSize: 11, fontWeight: '800', paddingTop: 4 },
  cards: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm, zIndex: 2 },
  personCard: { width: 176, minHeight: 215, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, alignItems: 'center' },
  name: { fontSize: 13.5, lineHeight: 18, fontWeight: '900', textAlign: 'center', marginTop: spacing.sm },
  username: { fontSize: 10.5, marginTop: 2 },
  actions: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 'auto', paddingTop: spacing.sm },
  profileButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
