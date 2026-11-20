/**
 * Theme Provider - Updated to use new semantic tokens
 * Supports light/dark mode with persisted preferences
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { semanticTokens, spacing, radius, typography, elevation, brandTokens } from './tokens';
import type { SemanticTokens } from './tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

interface Theme {
  mode: 'light' | 'dark';
  colors: SemanticTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  isDark: boolean;
}

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  themeMode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isHydrated, setIsHydrated] = useState(false);

  // Load persisted theme preference
  useEffect(() => {
    async function loadThemePreference() {
      try {
        const saved = await SecureStore.getItemAsync('themeMode');
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setThemeModeState(saved);
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      } finally {
        setIsHydrated(true);
      }
    }
    loadThemePreference();
  }, []);

  // Determine effective theme mode
  const effectiveMode: 'light' | 'dark' =
    themeMode === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : themeMode;

  const colors = semanticTokens[effectiveMode];

  const theme: Theme = {
    mode: effectiveMode,
    colors,
    spacing,
    radius,
    typography,
    elevation,
    isDark: effectiveMode === 'dark',
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await SecureStore.setItemAsync('themeMode', mode);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  };

  if (!isHydrated) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme.isDark,
        setThemeMode,
        themeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme & { setThemeMode: (mode: ThemeMode) => Promise<void>; themeMode: ThemeMode } {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return {
    ...context.theme,
    setThemeMode: context.setThemeMode,
    themeMode: context.themeMode,
  };
}

export { brandTokens };
