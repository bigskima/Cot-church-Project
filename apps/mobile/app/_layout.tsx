import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/state/session';
import { ThemeProvider, useTheme } from '@/state/theme';
import { BrandingProvider } from '@/state/branding';
import { fetchPlatformBranding } from '@/services/branding';

// Keep the native splash visible only until the React application shell mounts.
// Remote configuration must never block every route from rendering.
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  const { isDark } = useTheme();

  useEffect(() => {
    // Warm runtime branding in the background. The branding service owns its
    // local fallback, so offline/CORS/provider failures cannot blank the app.
    void fetchPlatformBranding();
    SplashScreen.hideAsync().catch(() => {});
  }, []);

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

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorScreen}>
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>We couldn’t open this screen</Text>
        <Text style={styles.errorMessage}>
          {error?.message || 'An unexpected application error occurred.'}
        </Text>
        <Pressable onPress={retry} style={styles.retryButton} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
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
            <AppContent />
          </BrandingProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: '#07111F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#21344B',
    backgroundColor: '#0C1929',
    padding: 24,
  },
  errorTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#2F6FED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
