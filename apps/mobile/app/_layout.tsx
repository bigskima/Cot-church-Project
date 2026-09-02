import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SessionProvider } from '@/state/session';
import { ThemeProvider, useTheme } from '@/state/theme';
import { BrandingProvider } from '@/state/branding';
import { fetchPlatformBranding } from '@/services/branding';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  const { isDark } = useTheme();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
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
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="reels" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="live/index" options={{ headerShown: false }} />
        <Stack.Screen name="live/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="watch/index" options={{ headerShown: false }} />
        <Stack.Screen name="watch/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="sermon/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="church-story" options={{ headerShown: false }} />
        <Stack.Screen name="giving/index" options={{ headerShown: false }} />
        <Stack.Screen name="prayer/index" options={{ headerShown: false }} />
        <Stack.Screen name="settings/index" options={{ headerShown: false }} />
        <Stack.Screen name="expression/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="assistant" options={{ headerShown: false }} />
        <Stack.Screen name="studio/index" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/index" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/media-studio" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/pastoral-triage" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/sermons" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/events" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/giving" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/expressions" options={{ headerShown: false }} />
        <Stack.Screen name="leadership/directory" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <BrandingProvider>
          <AppContent />
        </BrandingProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
