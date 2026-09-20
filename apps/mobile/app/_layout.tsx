import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/state/session';
import { ThemeProvider, useTheme } from '@/state/theme';
import { BrandingProvider } from '@/state/branding';
import { OnboardingGate } from '@/components/OnboardingGate';
import { RealtimeBridge } from '@/components/RealtimeBridge';
import { PushNotificationsBridge } from '@/components/PushNotificationsBridge';
import { IncomingCallBridge } from '@/components/IncomingCallBridge';
import { ActionFeedbackProvider } from '@/components/ActionFeedbackProvider';
import { AppTourProvider } from '@/features/tour/AppTourProvider';
import { CotGlobalActions } from '@/features/ai/CotGlobalActions';
import { fetchPlatformBranding } from '@/services/branding';
import { palette, radius, spacing } from '@/design-system/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  const { isDark, colors } = useTheme();
  const { mode, accessReady, contextStatus } = useSession();
  // Getting COT ready remains an access-gate invariant; the visible copy is intentionally user-facing.
  const resolvingAccess = mode === 'restoring' || (mode === 'authenticated' && !accessReady && contextStatus !== 'error');

  useEffect(() => {
    void fetchPlatformBranding();
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (resolvingAccess) {
    return (
      <View style={[styles.accessBootstrap, { backgroundColor: colors.bg }]}>
        <View style={[styles.accessBootstrapCard, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <View style={[styles.accessBootstrapSpinner, { backgroundColor: colors.primarySoft }]}>
            <ActivityIndicator size="small" color={colors.interactive} />
          </View>
          <Text style={[styles.accessBootstrapTitle, { color: colors.text }]}>Loading COT</Text>
        </View>
      </View>
    );
  }

  return (
    <AppTourProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RealtimeBridge />
      <PushNotificationsBridge />
      <OnboardingGate />
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="general" options={{ headerShown: false }} />
        <Stack.Screen name="expressions/[expressionId]" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="reels" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="live/index" options={{ headerShown: false }} />
        <Stack.Screen name="live/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="watch/index" options={{ headerShown: false }} />
        <Stack.Screen name="watch/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="comments/[contentId]" options={{ headerShown: false }} />
        <Stack.Screen name="sermon/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="series/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="church-story" options={{ headerShown: false }} />
        <Stack.Screen name="giving/index" options={{ headerShown: false }} />
        <Stack.Screen name="prayer/index" options={{ headerShown: false }} />
        <Stack.Screen name="settings/index" options={{ headerShown: false }} />
        <Stack.Screen name="expression/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="expressions/index" options={{ headerShown: false }} />
        <Stack.Screen name="assistant" options={{ headerShown: false }} />
        <Stack.Screen name="studio/index" options={{ headerShown: false }} />
        <Stack.Screen name="studio/reel" options={{ headerShown: false }} />
        <Stack.Screen name="studio/video" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/index" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/media-studio" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/pastoral-triage" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/sermons" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/events" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/giving" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/expressions" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/directory" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/invite-codes" options={{ headerShown: false }} />
      </Stack>
      <CotGlobalActions />
      <IncomingCallBridge />
    </AppTourProvider>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const showTechnicalDetail = typeof __DEV__ !== 'undefined' && __DEV__;

  useEffect(() => {
    console.error('Route render failure', error);
  }, [error]);

  return (
    <View style={styles.errorScreen}>
      <View style={styles.errorCard}>
        <View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View>
        <Text style={styles.errorTitle}>We couldn’t open this screen</Text>
        <Text style={styles.errorMessage}>Something went wrong while opening this page. Your account and church data have not been changed.</Text>
        {showTechnicalDetail && error?.message ? <Text style={styles.technicalMessage}>{error.message}</Text> : null}
        <Pressable onPress={retry} style={styles.retryButton} accessibilityRole="button"><Text style={styles.retryText}>Try again</Text></Pressable>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <BrandingProvider>
            <ActionFeedbackProvider>
              <AppContent />
            </ActionFeedbackProvider>
          </BrandingProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  accessBootstrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  accessBootstrapCard: { width: '100%', maxWidth: 280, minHeight: 118, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  accessBootstrapSpinner: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  accessBootstrapTitle: { fontSize: 16, lineHeight: 20, fontWeight: '900', textAlign: 'center', letterSpacing: -0.25 },
  errorScreen: { flex: 1, backgroundColor: palette.darkBg, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  errorCard: { width: '100%', maxWidth: 460, borderRadius: radius.xxl, borderWidth: 1, borderColor: palette.darkBorder, backgroundColor: palette.darkCard, padding: spacing.xxl },
  errorTitle: { color: palette.textDarkPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: spacing.sm },
  errorMessage: { color: palette.textDarkSecondary, fontSize: 14, lineHeight: 21, marginBottom: spacing.xl },
  technicalMessage: { color: palette.textDarkMuted, fontSize: 12, lineHeight: 18, marginTop: -10, marginBottom: 18 },
  retryButton: { minHeight: 46, borderRadius: radius.lg, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  retryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  errorIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.liveSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  errorIconText: { color: palette.live, fontSize: 24, lineHeight: 28, fontWeight: '800' },
});
