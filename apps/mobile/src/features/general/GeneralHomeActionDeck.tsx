import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CompactRouteGrid } from '@/components';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { useTheme } from '@/state/theme';

/**
 * General Home keeps navigation deliberately shallow. Secondary church routes
 * live in General Tools/Discover so Home remains content-first.
 */
export function GeneralHomeActionDeck() {
  const { colors } = useTheme();

  return (
    <TourAnchor targetKey="general.home.actions">
      <View style={styles.root}>
        <Text style={[styles.headingTitle, { color: colors.text }]}>Explore COT</Text>

        <CompactRouteGrid
          compact
          items={[
            {
              key: 'sermons',
              label: 'Sermons',
              icon: 'book-outline',
              accessibilityLabel: 'Sermons',
              onPress: () => router.push('/general/sermons' as any),
            },
            {
              key: 'events',
              label: 'Events',
              icon: 'calendar-outline',
              accessibilityLabel: 'Events',
              onPress: () => router.push('/general/events' as any),
            },
            {
              key: 'live',
              label: 'Live',
              icon: 'radio-outline',
              accessibilityLabel: 'Live',
              onPress: () => router.push('/general/live' as any),
            },
            {
              key: 'library',
              label: 'Library',
              icon: 'library-outline',
              accessibilityLabel: 'COT Library',
              onPress: () => router.push('/general/library' as any),
            },
            {
              key: 'devotional',
              label: 'Devotional',
              icon: 'sunny-outline',
              accessibilityLabel: 'Daily Devotional',
              onPress: () => router.push('/general/devotional' as any),
            },
            {
              key: 'more',
              label: 'More',
              icon: 'grid-outline',
              accessibilityLabel: 'More COT tools and routes',
              onPress: () => router.push('/general/tools' as any),
            },
          ]}
        />
      </View>
    </TourAnchor>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  headingTitle: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: -0.15,
    paddingHorizontal: 2,
  },
});
