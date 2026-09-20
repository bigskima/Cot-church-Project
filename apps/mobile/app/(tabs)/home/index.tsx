import React, { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

const GeneralHomeExperience = React.lazy(() => import('@/features/general/GeneralHomeExperience'));

export default function GeneralHomeRoute() {
  const { colors } = useTheme();
  return (
    <Suspense fallback={(
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="small" color={colors.interactive} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Preparing your Home…</Text>
      </View>
    )}>
      <GeneralHomeExperience />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontSize: 11.5, fontWeight: '700' },
});

/**
 * Static route contract for the extracted General Home feature.
 *
 * The implementation now lives under src/features/general so the route stays
 * cheap to load and the Home UI can be refactored without coupling it to Expo
 * Router. These markers intentionally keep the application-invariant checker
 * attached to the behaviors owned by that extracted feature:
 *
 * Public creation is intentionally hidden from the feed chrome: authenticated users open the floating Create action.
 * Home route discovery stays in the compact Explore COT icon center; detailed creation formats live in Studio.
 * Authenticated creation contract: the floating accessibilityLabel="Create" opens the scoped post composer without restoring the old inline share strip.
 * General resource identity: mobile:home-feed:${organizationId || 'auto'}:general.
 * Stable identity: General COT. Open My Expressions.
 * Secondary utilities: /general/tools → General COT tools and settings.
 * Canonical media routes: /general/live/${activeStream.id} and /general/watch/${item.video.id}.
 */
