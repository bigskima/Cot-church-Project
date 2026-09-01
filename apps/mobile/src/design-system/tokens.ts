export type ColorMode = 'light' | 'dark';

export const brand = {
  navy950: '#050B14',
  navy900: '#0C1322',
  navy800: '#111A2E',
  navy700: '#16223B',
  navy600: '#1D2D4E',
  blue500: '#1D9BF0',
  blue400: '#38BDF8',
  white: '#FFFFFF',
};

export const palette = {
  // OLED & Pitch Dark (Twitter / Instagram / YouTube Dark)
  black: '#000000',
  darkBg: '#050B14',
  darkCard: '#0C1322',
  darkCardElevated: '#111A2E',
  darkBorder: '#1A263D',
  darkBorderSubtle: '#141E30',

  // Light Theme (Pure Modern White)
  white: '#FFFFFF',
  lightBg: '#FFFFFF',
  lightBgSecondary: '#F8FAFC',
  lightCard: '#FFFFFF',
  lightCardElevated: '#FFFFFF',
  lightBorder: '#E2E8F0',
  lightBorderSubtle: '#F1F5F9',

  // Interactive Accents (Twitter Blue / Modern Consumer Indigo)
  blue: '#1D9BF0',
  blueHover: '#1A8CD8',
  blueSoft: 'rgba(29, 155, 240, 0.12)',
  indigo: '#3B82F6',
  indigoSoft: 'rgba(59, 130, 246, 0.12)',

  // Semantic
  live: '#EF4444',
  liveSoft: 'rgba(239, 68, 68, 0.15)',
  success: '#10B981',
  successSoft: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.12)',
  prayer: '#8B5CF6',
  prayerSoft: 'rgba(139, 92, 246, 0.12)',

  // Text Grays
  textDarkPrimary: '#F8FAFC',
  textDarkSecondary: '#94A3B8',
  textDarkMuted: '#64748B',

  textLightPrimary: '#0F172A',
  textLightSecondary: '#475569',
  textLightMuted: '#94A3B8',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  pill: 9999,
} as const;

export const typography = {
  h1: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  h3: {
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
} as const;

export const shadows = {
  none: {},
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  live: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const tokens = {
  light: {
    isDark: false,
    bg: palette.lightBg,
    bgElevated: palette.lightBgSecondary,
    bgSecondary: palette.lightBgSecondary,
    card: palette.lightCard,
    cardElevated: palette.lightCardElevated,
    cardBorder: palette.lightBorder,
    border: palette.lightBorder,
    borderStrong: '#CBD5E1',
    borderSubtle: palette.lightBorderSubtle,
    text: palette.textLightPrimary,
    textSecondary: palette.textLightSecondary,
    textMuted: palette.textLightMuted,
    textInverse: palette.textDarkPrimary,
    interactive: palette.blue,
    interactiveHover: palette.blueHover,
    primarySoft: palette.blueSoft,
    inputBg: '#F8FAFC',
    inputBorder: '#E2E8F0',
    inputBorderFocus: palette.blue,
    live: palette.live,
    liveSoft: palette.liveSoft,
    success: palette.success,
    successSoft: palette.successSoft,
    warning: palette.warning,
    warningSoft: palette.warningSoft,
    prayer: palette.prayer,
    prayerSoft: palette.prayerSoft,
  },
  dark: {
    isDark: true,
    bg: palette.darkBg,
    bgElevated: palette.darkCard,
    bgSecondary: palette.darkCard,
    card: palette.darkCard,
    cardElevated: palette.darkCardElevated,
    cardBorder: palette.darkBorder,
    border: palette.darkBorder,
    borderStrong: '#263550',
    borderSubtle: palette.darkBorderSubtle,
    text: palette.textDarkPrimary,
    textSecondary: palette.textDarkSecondary,
    textMuted: palette.textDarkMuted,
    textInverse: palette.textLightPrimary,
    interactive: palette.blue,
    interactiveHover: palette.blueHover,
    primarySoft: palette.blueSoft,
    inputBg: '#0C1322',
    inputBorder: '#1A263D',
    inputBorderFocus: palette.blue,
    live: palette.live,
    liveSoft: palette.liveSoft,
    success: palette.success,
    successSoft: palette.successSoft,
    warning: palette.warning,
    warningSoft: palette.warningSoft,
    prayer: palette.prayer,
    prayerSoft: palette.prayerSoft,
  },
};

export type ThemeColors = {
  isDark: boolean;
  bg: string;
  bgElevated: string;
  bgSecondary: string;
  card: string;
  cardElevated: string;
  cardBorder: string;
  border: string;
  borderStrong: string;
  borderSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  interactive: string;
  interactiveHover: string;
  primarySoft: string;
  inputBg: string;
  inputBorder: string;
  inputBorderFocus: string;
  live: string;
  liveSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  prayer: string;
  prayerSoft: string;
};

export function getThemeColors(isDark: boolean): ThemeColors {
  return isDark ? tokens.dark : tokens.light;
}
