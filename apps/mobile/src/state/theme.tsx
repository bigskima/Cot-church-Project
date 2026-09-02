import React, { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getThemeColors, type ColorMode } from '../design-system/tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  preference: ThemePreference;
  mode: ColorMode;
  isDark: boolean;
  colors: ReturnType<typeof getThemeColors>;
  setPreference: (preference: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = 'church-os-theme-preference';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

async function readThemePreference(): Promise<ThemePreference | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return null;
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      return isThemePreference(saved) ? saved : null;
    }

    const available = await SecureStore.isAvailableAsync().catch(() => false);
    if (!available) return null;
    const saved = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
    return isThemePreference(saved) ? saved : null;
  } catch {
    return null;
  }
}

async function persistThemePreference(preference: ThemePreference) {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_STORAGE_KEY, preference);
      }
      return;
    }

    const available = await SecureStore.isAvailableAsync().catch(() => false);
    if (available) await SecureStore.setItemAsync(THEME_STORAGE_KEY, preference);
  } catch {
    // Theme persistence must never block rendering or user navigation.
  }
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void readThemePreference().then((saved) => {
      if (saved) setPreferenceState(saved);
    });
  }, []);

  const setPreference = async (newPref: ThemePreference) => {
    setPreferenceState(newPref);
    await persistThemePreference(newPref);
  };

  const mode: ColorMode =
    preference === 'system'
      ? systemColorScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;

  const toggleTheme = async () => {
    await setPreference(mode === 'dark' ? 'light' : 'dark');
  };

  const isDark = mode === 'dark';
  const colors = getThemeColors(isDark);

  return (
    <ThemeContext.Provider
      value={{
        preference,
        mode,
        isDark,
        colors,
        setPreference,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;

  return {
    preference: 'system' as ThemePreference,
    mode: 'light' as ColorMode,
    isDark: false,
    colors: getThemeColors(false),
    setPreference: async () => {},
    toggleTheme: async () => {},
  };
}
