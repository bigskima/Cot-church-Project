import React, { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';

const GeneralProfileExperience = React.lazy(() => import('@/features/general/GeneralProfileExperience'));

export default function GeneralProfileRoute() {
  const { colors } = useTheme();
  return (
    <Suspense fallback={<View style={[styles.loading, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.interactive} /><Text style={[styles.copy, { color: colors.textMuted }]}>Preparing your COT space…</Text></View>}>
      <GeneralProfileExperience />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  copy: { fontSize: 11.5, fontWeight: '700' },
});
