import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CompactRouteGrid } from '@/components';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { useTheme } from '@/state/theme';
import { useFeatureControls } from '@/features/availability/useFeatureControls';

/**
 * General Home keeps navigation deliberately shallow. Secondary church routes
 * live in General Tools/Discover so Home remains content-first.
 */
export function GeneralHomeActionDeck() {
  const { colors } = useTheme();
  const features = useFeatureControls();
  const priorityItems = [
    features.isEnabled('sermons') ? {
      key: 'sermons',
      label: 'Sermons',
      icon: 'book-outline',
      accessibilityLabel: 'Sermons',
      onPress: () => router.push('/general/sermons' as any),
    } : null,
    features.isEnabled('events_gatherings') ? {
      key: 'events',
      label: 'Events',
      icon: 'calendar-outline',
      accessibilityLabel: 'Events',
      onPress: () => router.push('/general/events' as any),
    } : null,
    features.isEnabled('live_streaming') && features.isEnabled('general_live') ? {
      key: 'live',
      label: 'Live',
      icon: 'radio-outline',
      accessibilityLabel: 'Live',
      onPress: () => router.push('/general/live' as any),
    } : null,
    features.isEnabled('library_books') ? {
      key: 'library',
      label: 'Library',
      icon: 'library-outline',
      accessibilityLabel: 'COT Library',
      onPress: () => router.push('/general/library' as any),
    } : null,
    features.isEnabled('devotionals') ? {
      key: 'devotional',
      label: 'Devotional',
      icon: 'sunny-outline',
      accessibilityLabel: 'Daily Devotional',
      onPress: () => router.push('/general/devotional' as any),
    } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; icon: string; accessibilityLabel: string; onPress: () => void }>;

  const items = [
    ...priorityItems.slice(0, 3),
    {
      key: 'more',
      label: 'View more',
      icon: 'grid-outline',
      accessibilityLabel: 'View more COT routes',
      onPress: () => router.push('/general/tools' as any),
    },
  ];

  return (
    <TourAnchor targetKey="general.home.actions">
      <View style={styles.root}>
        <Text style={[styles.headingTitle, { color: colors.text }]}>Explore COT</Text>

        <CompactRouteGrid compact items={items} />
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
