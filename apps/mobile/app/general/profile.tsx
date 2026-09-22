import React, { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { radius, spacing } from '@/design-system/tokens';
import { Icon } from '@/components';
import { useTheme } from '@/state/theme';
import { useSession } from '@/state/session';

const GeneralProfileExperience = React.lazy(() => import('@/features/general/GeneralProfileExperience'));

export default function GeneralProfileRoute() {
  const { colors } = useTheme();
  const { mode } = useSession();

  // The profile tab is an account destination. Visitors should never have to
  // load the authenticated profile bundle just to reach sign-in.
  if (mode === 'visitor') {
    return <Redirect href={{ pathname: '/(auth)/login', params: { returnTo: '/general/profile' } } as any} />;
  }

  return (
    <View style={styles.screen}>
      <Suspense fallback={(
        <View style={[styles.loading, { backgroundColor: colors.bg }]}>
          <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <View style={[styles.loadingIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="person-outline" size={23} color={colors.interactive} />
            </View>
            <Text style={[styles.loadingTitle, { color: colors.text }]}>Preparing your COT space</Text>
            <Text style={[styles.copy, { color: colors.textMuted }]}>Loading your account, ministry access and church context.</Text>
            <ActivityIndicator color={colors.interactive} />
            <View style={styles.loadingLines}>
              <View style={[styles.loadingLine, { backgroundColor: colors.bgSecondary }]} />
              <View style={[styles.loadingLineShort, { backgroundColor: colors.bgSecondary }]} />
            </View>
          </View>
        </View>
      )}>
        <GeneralProfileExperience />
      </Suspense>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  loadingCard: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  loadingIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  loadingTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', textAlign: 'center' },
  copy: { maxWidth: 300, fontSize: 11.5, lineHeight: 17, fontWeight: '600', textAlign: 'center' },
  loadingLines: { width: '100%', marginTop: spacing.sm, gap: 7 },
  loadingLine: { width: '100%', height: 10, borderRadius: 5 },
  loadingLineShort: { width: '68%', height: 10, borderRadius: 5, alignSelf: 'center' },
});
