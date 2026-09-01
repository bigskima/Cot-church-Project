export type ColorMode = 'light' | 'dark';

// Brand Foundation Tokens
export const brand = {
  navy: {
    950: '#061426',
    900: '#091B33',
    800: '#0D294B',
    700: '#123A66',
    600: '#18528B',
    500: '#2062A5',
  },
  blue: {
    600: '#205BD6',
    500: '#2F6FED',
    400: '#5C8FF5',
    300: '#8FB4F8',
    100: '#EAF1FA',
  },
  white: '#FFFFFF',
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475467',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
};

// Semantic Status Colors
export const semantic = {
  live: '#E5484D',
  liveGlow: 'rgba(229, 72, 77, 0.35)',
  success: '#16A36A',
  successSoft: 'rgba(22, 163, 106, 0.12)',
  warning: '#E9A23B',
  warningSoft: 'rgba(233, 162, 59, 0.12)',
  info: '#2F6FED',
  infoSoft: 'rgba(47, 111, 237, 0.12)',
  prayer: '#8B5CF6',
  prayerSoft: 'rgba(139, 92, 246, 0.12)',
};

// Theme Color Token Generator
export const getThemeColors = (isDark: boolean) => ({
  isDark,
  // Canvas & Backgrounds
  bg: isDark ? '#07111F' : '#F7F9FC',
  bgElevated: isDark ? '#0C1929' : '#FFFFFF',
  bgSecondary: isDark ? '#112238' : '#F1F5F9',

  // Surfaces & Cards
  card: isDark ? '#0C1929' : '#FFFFFF',
  cardElevated: isDark ? '#152A43' : '#FFFFFF',
  cardBorder: isDark ? '#21344B' : '#E4E7EC',

  // Typography
  text: isDark ? '#F8FAFC' : '#0B1628',
  textSecondary: isDark ? '#CBD5E1' : '#475467',
  textMuted: isDark ? '#94A3B8' : '#667085',
  textInverse: isDark ? '#0B1628' : '#FFFFFF',

  // Borders & Dividers
  border: isDark ? '#21344B' : '#E4E7EC',
  borderStrong: isDark ? '#304762' : '#D0D5DD',
  borderSubtle: isDark ? '#16283E' : '#EEF2F6',

  // Interactive & Brand
  primary: isDark ? '#FFFFFF' : '#0D294B',
  primaryPressed: isDark ? '#E2E8F0' : '#091B33',
  primaryInverse: isDark ? '#0D294B' : '#FFFFFF',
  primarySoft: isDark ? '#122844' : '#EAF1FA',
  accent: '#2F6FED',
  accentLight: '#5C8FF5',
  interactive: isDark ? '#6EA8FF' : '#2F6FED',
  link: isDark ? '#6EA8FF' : '#18528B',

  // Form Inputs
  inputBg: isDark ? '#0C1929' : '#FFFFFF',
  inputBorder: isDark ? '#21344B' : '#D0D5DD',
  inputFocus: '#2F6FED',

  // UI Tags & Active Elements
  tagBg: isDark ? '#152A43' : '#F1F5F9',
  activeTabBg: isDark ? '#152A43' : '#EAF1FA',

  // Status Colors
  live: semantic.live,
  liveGlow: semantic.liveGlow,
  success: semantic.success,
  warning: semantic.warning,
  info: semantic.info,
  prayer: semantic.prayer,
});

// 4/8pt Spacing Scale
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

// Corner Radii (Disciplined, avoiding excessive 24 everywhere)
export const radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
};

// Subtle Modern Shadows
export const shadows: Record<string, any> = {
  sm: {
    shadowColor: '#061426',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#061426',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#061426',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  live: {
    shadowColor: '#E5484D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Clean Typography Scale
export const typography = {
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
  },
  h1: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
  },
  h2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600' as const,
    letterSpacing: -0.4,
  },
  h3: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  kicker: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
};

// Legacy mappings for transitional safety
export const palette = {
  ...semantic,
  navy: brand.navy[800],
  navyDarkest: brand.navy[950],
  navyDark: brand.navy[900],
  blue: brand.blue[500],
  blueLight: brand.blue[400],
  white: brand.white,
  slate: brand.slate[600],
  surface: '#FFFFFF',
  line: '#E4E7EC',
  cream: '#F7F9FC',
  midnight: '#07111F',
  gold: brand.blue[500], // retired gold mapping to blue
  yellow: brand.blue[500],
  yellowDark: brand.navy[700],
};
