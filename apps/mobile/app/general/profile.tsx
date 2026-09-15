import React, { Suspense } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components';
import { TourAnchor } from '@/features/tour/AppTourProvider';
import { radius, shadows, spacing } from '@/design-system/tokens';
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
      <Pressable
        onPress={() => router.push('/general/tour' as any)}
        accessibilityRole="button"
        accessibilityLabel="Open app tour and help"
        style={({ pressed }) => [
          styles.tourShortcut,
          { bottom: Math.max(insets.bottom + 86, 98), backgroundColor: colors.card, borderColor: colors.borderSubtle },
          shadows.floating,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.tourIcon, { backgroundColor: colors.primarySoft }]}><Icon name="navigate-circle-outline" size={18} color={colors.interactive} /></View>
        <Text style={[styles.tourText, { color: colors.text }]}>App tour</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  copy: { fontSize: 11.5, fontWeight: '700' },
  headerTarget: { position: 'absolute', left: 12, right: 12, height: 74, zIndex: 30 },
  fill: { flex: 1 },
  tourShortcut: { position: 'absolute', right: spacing.md, zIndex: 35, minHeight: 46, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tourIcon: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tourText: { fontSize: 10.5, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
