import React, { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

const GeneralProfileExperience = React.lazy(() => import('@/features/general/GeneralProfileExperience'));

export default function GeneralProfileRoute() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <Suspense fallback={<View style={[styles.loading, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.interactive} /><Text style={[styles.copy, { color: colors.textMuted }]}>Preparing your COT space…</Text></View>}>
        <GeneralProfileExperience />
      </Suspense>
      <TourAnchor targetKey="general.profile.header" style={[styles.headerTarget, { top: insets.top + 6 }]}>
        <View style={styles.fill} />
      </TourAnchor>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  copy: { fontSize: 11.5, fontWeight: '700' },
  headerTarget: { position: 'absolute', left: 12, right: 12, height: 74, zIndex: 30 },
  fill: { flex: 1 },
});
