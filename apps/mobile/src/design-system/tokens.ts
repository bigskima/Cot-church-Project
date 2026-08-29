import type { ViewStyle } from 'react-native';

// Brown & Yellow Luxury Design System Tokens with Dark/Light Mode support
export type ColorMode = 'light' | 'dark';

export const palette = {
  // Brand Yellow / Gold Scale
  yellow: '#F59E0B',
  yellowLight: '#FCD34D',
  yellowDark: '#B45309',
  gold: '#F59E0B',
  goldLight: '#FDE047',
  goldDark: '#B45309',

  // Rich Brown Scale
  brownDarkest: '#140C07', // Dark mode main background
  brownDark: '#22140C',    // Dark mode card surface
  brownElevated: '#2E1C11', // Dark mode elevated components
  brownBorderDark: '#452A1A', // Dark mode border
  brownWarm: '#78350F',     // Warm saddle accent
  brownLight: '#F8EDE2',    // Light mode main background
  brownSurface: '#FFFDF9',  // Light mode card surface
  brownBorderLight: '#E8D5C4', // Light mode border
  brownMuted: '#8C6549',    // Light mode muted text
  brownText: '#26140A',     // Light mode primary text

  // Semantic Status Colors
  live: '#EF4444',
  liveGlow: 'rgba(239, 68, 68, 0.4)',
  success: '#10B981',
  warning: '#F59E0B',
  prayer: '#8B5CF6',
  blue: '#3B82F6',

  // Legacy mappings for backwards compatibility
  cream: '#F8EDE2',
  midnight: '#140C07',
  navy: '#22140C',
  surface: '#FFFDF9',
  surfaceSubtle: '#F1E3D3',
  surfaceDark: '#22140C',
  surfaceDarkElevated: '#2E1C11',
  ink: '#26140A',
  inkSecondary: '#5C3D28',
  muted: '#8C6549',
  mutedLight: '#C4AFA0',
  white: '#FFFDF9',
  line: '#E8D5C4',
};

export const getThemeColors = (isDark: boolean) => ({
  isDark,
  bg: isDark ? '#140C07' : '#F8EDE2',
  bgElevated: isDark ? '#2E1C11' : '#F1E3D3',
  card: isDark ? '#22140C' : '#FFFDF9',
  cardElevated: isDark ? '#2E1C11' : '#FFFFFF',
  cardBorder: isDark ? '#452A1A' : '#E8D5C4',
  text: isDark ? '#FFFDF9' : '#26140A',
  textSecondary: isDark ? '#E6CCB2' : '#5C3D28',
  textMuted: isDark ? '#A68A75' : '#8C6549',
  border: isDark ? '#452A1A' : '#E8D5C4',
  primary: '#F59E0B', // Vibrant Yellow
  primaryLight: '#FDE047',
  primaryDark: '#B45309',
  accent: '#78350F', // Rich Saddle Brown
  live: '#EF4444',
  success: '#10B981',
  prayer: '#8B5CF6',
  inputBg: isDark ? '#1C1009' : '#FFFFFF',
  inputBorder: isDark ? '#452A1A' : '#E8D5C4',
  tagBg: isDark ? '#2E1C11' : '#F1E3D3',
  activeTabBg: isDark ? '#2E1C11' : '#FFFDF9',
});

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 9999,
};

export const shadows: Record<string, any> = {
  sm: {
    shadowColor: '#140C07',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#140C07',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#140C07',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  glowGold: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  glowLive: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 6,
  },
};
