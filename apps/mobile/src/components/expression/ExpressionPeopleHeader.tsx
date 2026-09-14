import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BottomSheet, Icon } from '@/components';
import { radius, shadows, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

type PeopleSection = 'groups' | 'members' | 'leadership' | 'birthdays' | 'chat';

type Props = {
  expressionId: string;
  expressionName: string;
  active: PeopleSection;
  title: string;
  subtitle: string;
  icon: string;
};

const destinations: Array<{ key: PeopleSection; label: string; description: string; icon: string }> = [
  { key: 'groups', label: 'Groups', description: 'Smaller communities inside this Expression', icon: 'people-circle-outline' },
  { key: 'members', label: 'Members', description: 'People who belong to this Expression', icon: 'people-outline' },
  { key: 'leadership', label: 'Leaders', description: 'Expression leaders and ministry roles', icon: 'ribbon-outline' },
  { key: 'chat', label: 'Discussion', description: 'The shared conversation for all Expression members', icon: 'chatbubbles-outline' },
  { key: 'birthdays', label: 'Birthdays', description: 'Private-by-choice member celebrations', icon: 'gift-outline' },
];

function routeFor(expressionId: string, key: PeopleSection) {
  return `/expressions/${expressionId}/${key === 'groups' ? 'groups' : key}`;
}

export function ExpressionPeopleHeader({ expressionId, expressionName, active, title, subtitle, icon }: Props) {
  const { colors } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeDestination = destinations.find((item) => item.key === active);

  const openDestination = (key: PeopleSection) => {
    setMenuOpen(false);
    if (key === active) return;
    router.push(routeFor(expressionId, key) as any);
  };

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }, shadows.sm]}>
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <Icon name={icon as any} size={19} color={colors.interactive} />
          </View>
          <View style={styles.copy}>
            <View style={styles.eyebrowRow}>
              <Icon name="lock-closed-outline" size={10} color={colors.interactive} />
              <Text style={[styles.eyebrow, { color: colors.interactive }]}>{active === 'chat' ? 'EXPRESSION DISCUSSION' : 'EXPRESSION PEOPLE'}</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
            <Text style={[styles.expression, { color: colors.textMuted }]} numberOfLines={1}>{expressionName} · Members only</Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push(`/expressions/${expressionId}` as any)}
              accessibilityRole="button"
              accessibilityLabel="Expression home"
              style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed ? styles.pressed : null]}
            >
              <Icon name="home-outline" size={16} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open Expression people menu"
              style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }, pressed ? styles.pressed : null]}
            >
              <Icon name="ellipsis-horizontal" size={19} color={colors.interactive} />
            </Pressable>
          </View>
        </View>
        {activeDestination ? (
          <Pressable onPress={() => setMenuOpen(true)} style={styles.currentRow} accessibilityRole="button" accessibilityLabel={`Current section ${activeDestination.label}. Open menu`}>
            <Text style={[styles.currentText, { color: colors.textMuted }]}>People menu</Text>
            <Text style={[styles.currentDot, { color: colors.textMuted }]}>·</Text>
            <Text style={[styles.currentActive, { color: colors.interactive }]}>{activeDestination.label}</Text>
            <Icon name="chevron-down" size={13} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Expression people" subtitle={`${expressionName} · choose where you want to go`} maxHeightPercent={72}>
        <View style={styles.menuList}>
          {destinations.map((destination) => {
            const selected = destination.key === active;
            return (
              <Pressable
                key={destination.key}
                onPress={() => openDestination(destination.key)}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    backgroundColor: selected ? colors.primarySoft : colors.card,
                    borderColor: selected ? colors.interactive : colors.borderSubtle,
                  },
                  pressed ? styles.pressed : null,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={[styles.menuIcon, { backgroundColor: selected ? colors.card : colors.bgSecondary }]}>
                  <Icon name={destination.icon as any} size={19} color={selected ? colors.interactive : colors.textSecondary} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.menuLabel, { color: colors.text }]}>{destination.label}</Text>
                  <Text style={[styles.menuDescription, { color: colors.textMuted }]} numberOfLines={1}>{destination.description}</Text>
                </View>
                {selected ? <Icon name="checkmark-circle" size={18} color={colors.interactive} /> : <Icon name="chevron-forward" size={16} color={colors.textMuted} />}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.xs, padding: spacing.sm, borderWidth: 1, borderRadius: radius.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrow: { fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.75 },
  title: { fontSize: 17, lineHeight: 21, fontWeight: '900', letterSpacing: -0.3, marginTop: 1 },
  subtitle: { fontSize: 10, lineHeight: 14, marginTop: 1 },
  expression: { fontSize: 9, lineHeight: 12, marginTop: 2, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  roundButton: { width: 35, height: 35, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  currentRow: { minHeight: 24, paddingTop: 5, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  currentText: { fontSize: 8.5, fontWeight: '700' }, currentDot: { fontSize: 9 }, currentActive: { fontSize: 8.5, fontWeight: '900' },
  menuList: { gap: spacing.xs },
  menuItem: { minHeight: 62, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  menuIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 13, fontWeight: '900' }, menuDescription: { fontSize: 9.5, lineHeight: 13, marginTop: 2 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
