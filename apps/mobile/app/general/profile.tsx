import React, { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme';
import { useSession } from '@/state/session';

const GeneralProfileExperience = React.lazy(() => import('@/features/general/GeneralProfileExperience'));

export default function GeneralProfileRoute() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { mode } = useSession();

  // The profile tab is an account destination. Visitors should never have to
  // load the authenticated profile bundle just to reach sign-in.
  if (mode === 'visitor') {
    return <Redirect href={{ pathname: '/(auth)/login', params: { returnTo: '/general/profile' } } as any} />;
  }

  return (
    <View style={styles.screen}>
      <Suspense fallback={<View style={[styles.loading, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.interactive} /><Text style={[styles.copy, { color: colors.textMuted }]}>Preparing your COT space…</Text></View>}>
        <GeneralProfileExperience />
      </Suspense>
      <View pointerEvents="none" style={[styles.headerTarget, { top: insets.top + 6 }]}>
        <TourAnchor targetKey="general.profile.header" style={styles.fill}>
          <View style={styles.fill} />
        </TourAnchor>
      </View>
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
