import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BottomSheet } from '@/components/BottomSheet';
import { CompactRouteGrid } from '@/components/navigation/CompactRouteGrid';
import { Icon } from '@/components/primitives/Icon';
import { radius, spacing } from '@/design-system/tokens';
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

const destinations: Array<{ key: ExpressionMediaSection; label: string; description: string; icon: string }> = [
  { key: 'live', label: 'Live', description: 'Current, upcoming and recent Expression broadcasts', icon: 'radio-outline' },
  { key: 'sermons', label: 'Sermons', description: 'Messages shared with this Expression', icon: 'mic-outline' },
  { key: 'videos', label: 'Videos', description: 'Long-form Expression media and teaching', icon: 'videocam-outline' },
  { key: 'reels', label: 'Reels', description: 'Short videos from this Expression', icon: 'flash-outline' },
];

function routeFor(expressionId: string, key: ExpressionMediaSection) {
  return `/expressions/${expressionId}/${key}`;
}

/**
 * Media routes share one compact toolbar. The Expression shell already tells
 * users which Expression they are in, so this component avoids repeating
 * membership/scope explanations on every media screen.
 */
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
  const [menuOpen, setMenuOpen] = useState(false);

  const openDestination = (key: ExpressionMediaSection) => {
    setMenuOpen(false);
    if (key === active) return;
    router.push(routeFor(expressionId, key) as any);
  };

  return (
    <>
      <View
        accessibilityRole="header"
        accessibilityLabel={`${title}. ${subtitle}. ${expressionName}`}
        style={[styles.bar, { backgroundColor: colors.bg, borderBottomColor: colors.borderSubtle }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name={icon as any} size={17} color={colors.interactive} />
        </View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>

        {onAction && actionLabel ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
          >
            <Icon name={actionIcon as any} size={17} color={colors.interactive} />
          </Pressable>
        ) : null}

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
          accessibilityLabel="Open Expression media routes"
          style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.primarySoft, borderColor: colors.borderSubtle }, pressed && styles.pressed]}
        >
          <Icon name="ellipsis-horizontal" size={19} color={colors.interactive} />
        </Pressable>
      </View>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Media" maxHeightPercent={58} compact>
        <CompactRouteGrid
          compact
          items={destinations.map((destination) => ({
            key: destination.key,
            label: destination.label,
            icon: destination.icon,
            selected: destination.key === active,
            accessibilityLabel: `${destination.label}. ${destination.description}`,
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
