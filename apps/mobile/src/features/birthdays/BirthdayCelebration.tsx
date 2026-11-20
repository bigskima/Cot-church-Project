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

const celebrationSeeds = [
  { emoji: '🎈', left: 5, delay: 0, duration: 5200, size: 31 },
  { emoji: '✨', left: 18, delay: 540, duration: 3900, size: 21 },
  { emoji: '🎊', left: 31, delay: 920, duration: 4700, size: 25 },
  { emoji: '🎈', left: 46, delay: 250, duration: 5700, size: 28 },
  { emoji: '🎉', left: 61, delay: 1180, duration: 4300, size: 23 },
  { emoji: '✨', left: 73, delay: 680, duration: 3600, size: 19 },
  { emoji: '🎈', left: 84, delay: 1450, duration: 5400, size: 30 },
  { emoji: '🎊', left: 93, delay: 350, duration: 4500, size: 22 },
];

export function BirthdayBalloons({ active }: { active: boolean }) {
  const values = useRef(celebrationSeeds.map(() => new Animated.Value(0))).current;
  const glow = useRef(new Animated.Value(0)).current;
  const animations = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    animations.current.forEach((animation) => animation.stop());
    animations.current = [];
    values.forEach((value) => value.setValue(0));
    glow.setValue(0);
    if (!active) return;

    const floating = values.map((value, index) => {
      const seed = celebrationSeeds[index];
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(seed.delay),
          Animated.timing(value, { toValue: 1, duration: seed.duration, useNativeDriver: true }),
          Animated.delay(700 + (index % 3) * 280),
          Animated.timing(value, { toValue: 0, duration: 1, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return loop;
    });
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ]));
    pulse.start();
    animations.current = [...floating, pulse];
    return () => animations.current.forEach((animation) => animation.stop());
  }, [active, glow, values]);

  if (!active) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <Animated.View
        style={[
          styles.celebrationGlow,
          {
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.12] }) }],
          },
        ]}
      />
      {values.map((value, index) => {
        const seed = celebrationSeeds[index];
        return (
          <Animated.Text
            key={`${seed.emoji}-${index}`}
            style={[
              styles.balloon,
              {
                left: `${seed.left}%`,
                fontSize: seed.size,
                opacity: value.interpolate({ inputRange: [0, 0.07, 0.84, 1], outputRange: [0, 0.92, 0.88, 0] }),
                transform: [
                  { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [250 + (index % 2) * 45, -190 - (index % 3) * 28] }) },
                  { translateX: value.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [0, index % 2 ? 12 : -10, index % 2 ? -8 : 11, 0] }) },
                  { rotate: value.interpolate({ inputRange: [0, 0.5, 1], outputRange: [index % 2 ? '-10deg' : '8deg', index % 2 ? '9deg' : '-7deg', '3deg'] }) },
                  { scale: value.interpolate({ inputRange: [0, 0.12, 0.8, 1], outputRange: [0.55, 1, 1.08, 0.9] }) },
                ],
              },
            ]}
          >
            {seed.emoji}
          </Animated.Text>
        );
      })}
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
    // Birthday wishes are private person-to-person messages. The Expression
    // discussion route is the shared room, so DMs continue through General chat.
    router.push({ pathname: '/general/chat', params: { username: entry.username } } as any);
  };

  return (
    <View style={[styles.shelf, { backgroundColor: colors.primarySoft, borderColor: colors.interactive }, shadows.sm]}>
      <BirthdayBalloons active />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.eyebrowRow}><Icon name="gift-outline" size={15} color={colors.interactive} /><Text style={[styles.eyebrow, { color: colors.interactive }]}>BIRTHDAYS TODAY</Text></View>
          <Text style={[styles.title, { color: colors.text }]}>{today.length === 1 ? 'Celebrate with them 🎉' : `Celebrate ${today.length} people today 🎉`}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>No birthday post is required. COT celebrates members automatically from the privacy choice they saved.</Text>
        </View>
        {onSeeAll ? <Pressable onPress={onSeeAll}><Text style={[styles.seeAll, { color: colors.interactive }]}>See all</Text></Pressable> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {today.map((entry) => (
          <Pressable key={entry.profile_id} onPress={() => openProfile(entry)} style={[styles.personCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
            <View style={[styles.avatarCelebration, { backgroundColor: colors.primarySoft }]}><Text style={styles.sparkle}>✨</Text><Avatar url={entry.avatar_url} name={entry.display_name} size="lg" /></View>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{entry.display_name}</Text>
            {entry.username ? <Text style={[styles.username, { color: colors.textMuted }]} numberOfLines={1}>@{entry.username}</Text> : null}
            <View style={styles.actions}>
              {entry.username ? <Button label="Message" onPress={() => message(entry)} variant="outline" size="sm" /> : null}
              {entry.username ? (
                <Pressable onPress={() => openProfile(entry)} style={[styles.profileButton, { backgroundColor: colors.bgSecondary }]} accessibilityLabel={`Open ${entry.display_name} profile`}>
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
  balloon: { position: 'absolute', bottom: -18 },
  celebrationGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -70, top: -105, backgroundColor: '#FFFFFF' },
  shelf: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderRadius: radius.xxl, paddingVertical: spacing.md, marginVertical: spacing.sm },
  header: { paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, zIndex: 2 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 3 },
  subtitle: { fontSize: 10.8, lineHeight: 16, marginTop: 3 },
  seeAll: { fontSize: 11, fontWeight: '800', paddingTop: 4 },
  cards: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm, zIndex: 2 },
  personCard: { width: 176, minHeight: 215, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, alignItems: 'center' },
  avatarCelebration: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  sparkle: { position: 'absolute', right: 1, top: -6, fontSize: 20, zIndex: 3 },
  name: { fontSize: 13.5, lineHeight: 18, fontWeight: '900', textAlign: 'center', marginTop: spacing.sm },
  username: { fontSize: 10.5, marginTop: 2 },
  actions: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 'auto', paddingTop: spacing.sm },
  profileButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
