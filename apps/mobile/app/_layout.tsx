import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SessionProvider } from '@/state/session';
import { ThemeProvider, useTheme } from '@/state/theme';
import { fetchPlatformBranding } from '@/services/branding';

// Prevent native splash from auto-hiding until initial state and branding are ready
SplashScreen.preventAutoHideAsync().catch(() => {
  // Catch splash screen prevention errors in development/web
});

function AppContent() {
  const { isDark } = useTheme();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-fetch platform dynamic branding config in parallel with auth restoration
        await fetchPlatformBranding();
      } catch (_e) {
        // Fallback handles branding gracefully
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      // Smoothly dismiss the native splash screen with no flash
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </ThemeProvider>
  );
}
