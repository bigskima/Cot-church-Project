import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BottomSheet } from '@/components/BottomSheet';
import { CompactRouteGrid } from '@/components/navigation/CompactRouteGrid';
import { Icon } from '@/components/primitives/Icon';
import { radius, spacing } from '@/design-system/tokens';
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

const destinations: Array<{ key: PeopleSection; label: string; icon: string }> = [
  { key: 'groups', label: 'Groups', icon: 'people-circle-outline' },
  { key: 'members', label: 'Members', icon: 'people-outline' },
  { key: 'leadership', label: 'Leaders', icon: 'ribbon-outline' },
  { key: 'chat', label: 'Discussion', icon: 'chatbubbles-outline' },
  { key: 'birthdays', label: 'Birthdays', icon: 'gift-outline' },
];

function routeFor(expressionId: string, key: PeopleSection) {
  return `/expressions/${expressionId}/${key === 'groups' ? 'groups' : key}`;
}

export function ExpressionPeopleHeader({ expressionId, expressionName, active, title, subtitle, icon }: Props) {
  const { colors } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const openDestination = (key: PeopleSection) => {
    setMenuOpen(false);
    if (key === active) return;
    router.push(routeFor(expressionId, key) as any);
  };

  return (
    <>
      <View
        accessibilityRole="header"
        accessibilityLabel={`${title}. ${subtitle}`}
        style={[styles.bar, { backgroundColor: colors.bg, borderBottomColor: colors.borderSubtle }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name={icon as any} size={17} color={colors.interactive} />
        </View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>

        <Pressable
          onPress={() => router.push(`/expressions/${expressionId}` as any)}
          accessibilityRole="button"
          accessibilityLabel="Expression home"
          style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
        >
          <Icon name="home-outline" size={16} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open Expression quick routes"
          style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
        >
          <Icon name="ellipsis-horizontal" size={19} color={colors.interactive} />
        </Pressable>
      </View>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Quick routes" maxHeightPercent={60}>
        <CompactRouteGrid
          compact
          items={destinations.map((destination) => ({
            key: destination.key,
            label: destination.label,
            icon: destination.icon,
            selected: destination.key === active,
            accessibilityLabel: `${destination.label} in ${expressionName}`,
            onPress: () => openDestination(destination.key),
          }))}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 50,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconWrap: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 19, fontWeight: '900', letterSpacing: -0.25 },
  roundButton: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
