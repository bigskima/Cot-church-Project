import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { spacing } from '@/design-system/tokens';
import { useSession } from '@/state/session';
import { useTheme } from '@/state/theme';

type QuickAction = { key: string; label: string; icon: string; route: string; authenticated?: boolean };

/**
 * General Home route center.
 *
 * Creation intentionally does not live here. Home stays focused on discovery;
 * the global floating + owns the create entry point.
 */
export function GeneralHomeActionDeck() {
  const { colors } = useTheme();
  const { mode } = useSession();
  const authenticated = mode === 'authenticated';

  const quickActions = useMemo<QuickAction[]>(() => [
    { key: 'sermons', label: 'Sermons', icon: 'book-outline', route: '/general/sermons' },
    { key: 'events', label: 'Events', icon: 'calendar-outline', route: '/general/events' },
    { key: 'updates', label: 'Updates', icon: 'notifications-outline', route: '/general/announcements' },
    { key: 'participate', label: 'Join in', icon: 'chatbubbles-outline', route: '/general/participate' },
    { key: 'prayer', label: 'Prayer', icon: 'heart-outline', route: '/general/prayer' },
    { key: 'giving', label: 'Giving', icon: 'gift-outline', route: '/general/giving' },
    { key: 'live', label: 'Live', icon: 'radio-outline', route: '/general/live' },
    { key: 'groups', label: 'Groups', icon: 'people-circle-outline', route: '/general/groups', authenticated: true },
    { key: 'saved', label: 'Saved', icon: 'bookmark-outline', route: '/general/saved', authenticated: true },
    { key: 'tools', label: 'More', icon: 'grid-outline', route: '/general/tools' },
  ], []);

  const visibleActions = quickActions.filter((item) => !item.authenticated || authenticated);

  return (
    <TourAnchor targetKey="general.home.actions">
      <View style={styles.root}>
        <View style={styles.heading}>
          <Text style={[styles.headingTitle, { color: colors.text }]}>Explore COT</Text>
        </View>

        <View style={styles.grid}>
          {visibleActions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => router.push(action.route as any)}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <View style={[styles.icon, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftStrong }]}>
                <Icon name={action.icon as any} size={20} color={colors.interactive} />
              </View>
              <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={2}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </TourAnchor>
  );
}

const styles = StyleSheet.create({
  root: { gap: 7 },
  heading: { minHeight: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  headingTitle: { fontSize: 13.5, lineHeight: 18, fontWeight: '900', letterSpacing: -0.2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', rowGap: spacing.sm },
  action: { width: '25%', minHeight: 66, alignItems: 'center', justifyContent: 'flex-start', gap: 5, paddingHorizontal: 3 },
  icon: { width: 43, height: 43, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { minHeight: 24, fontSize: 9.5, lineHeight: 12, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
