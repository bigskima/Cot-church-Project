import React, { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
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

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    SecureStore.getItemAsync(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setPreferenceState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = async (newPref: ThemePreference) => {
    setPreferenceState(newPref);
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, newPref);
    } catch {}
  };

  const toggleTheme = async () => {
    const nextPref = mode === 'dark' ? 'light' : 'dark';
    await setPreference(nextPref);
  };

  const mode: ColorMode =
    preference === 'system'
      ? systemColorScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;

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
  if (!ctx) {
    const isDark = false;
    return {
      preference: 'system' as ThemePreference,
      mode: 'light' as ColorMode,
      isDark: false,
      colors: getThemeColors(false),
      setPreference: async () => {},
      toggleTheme: async () => {},
    };
  }
  return ctx;
}
