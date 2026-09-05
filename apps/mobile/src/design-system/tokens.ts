export type ColorMode = 'light' | 'dark';

export const brand = {
  ink: '#07111F',
  navy950: '#050B14',
  navy900: '#0B1320',
  navy800: '#111C2D',
  navy700: '#17263C',
  navy600: '#213653',
  blue600: '#0877D8',
  blue500: '#1597F3',
  blue400: '#43B5FF',
  violet500: '#7657FF',
  white: '#FFFFFF',
};

export const palette = {
  black: '#000000',

  // Deep social surfaces. Near-black rather than flat navy keeps media vivid.
  darkBg: '#070B12',
  darkBgSecondary: '#0B111B',
  darkCard: '#0D1420',
  darkCardElevated: '#121C2A',
  darkBorder: '#202C3D',
  darkBorderSubtle: '#151F2D',
  darkGlass: 'rgba(13, 20, 32, 0.92)',
  darkPressed: '#182334',

  // Light surfaces use tonal separation instead of heavy borders.
  white: '#FFFFFF',
  lightBg: '#F7F9FC',
  lightBgSecondary: '#EEF3F8',
  lightCard: '#FFFFFF',
  lightCardElevated: '#FFFFFF',
  lightBorder: '#DCE4EE',
  lightBorderSubtle: '#EAF0F6',
  lightGlass: 'rgba(255, 255, 255, 0.94)',
  lightPressed: '#E8EEF5',

  // Product accent. Strong enough for social actions without dominating content.
  blue: '#168FF0',
  blueHover: '#0877D8',
  blueSoft: 'rgba(22, 143, 240, 0.12)',
  blueSoftStrong: 'rgba(22, 143, 240, 0.18)',
  violet: '#7657FF',
  violetSoft: 'rgba(118, 87, 255, 0.13)',

  // Semantic states.
  live: '#F04452',
  liveSoft: 'rgba(240, 68, 82, 0.14)',
  success: '#19A66A',
  successSoft: 'rgba(25, 166, 106, 0.13)',
  warning: '#E99A12',
  warningSoft: 'rgba(233, 154, 18, 0.14)',
  prayer: '#8A63F6',
  prayerSoft: 'rgba(138, 99, 246, 0.13)',

  textDarkPrimary: '#F7FAFC',
  textDarkSecondary: '#A7B4C5',
  textDarkMuted: '#738196',

  textLightPrimary: '#0D1726',
  textLightSecondary: '#48586C',
  textLightMuted: '#7A899D',
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
  section: 40,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  card: 22,
  sheet: 28,
  pill: 9999,
} as const;

export const typography = {
  display: {
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -1,
    lineHeight: 36,
  },
  h1: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.7,
    lineHeight: 30,
  },
  h2: {
    fontSize: 20,
    fontWeight: '750' as const,
    letterSpacing: -0.45,
    lineHeight: 26,
  },
  h3: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.25,
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    letterSpacing: -0.08,
  },
  bodyStrong: {
    fontSize: 15,
    fontWeight: '650' as const,
    lineHeight: 21,
    letterSpacing: -0.12,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 19,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 17,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '750' as const,
    letterSpacing: 0.7,
    lineHeight: 15,
    textTransform: 'uppercase' as const,
  },
} as const;

export const shadows = {
  none: {},
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 9,
  },
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  live: {
    shadowColor: '#F04452',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 5,
  },
} as const;

export const motion = {
  fast: 120,
  normal: 180,
  deliberate: 260,
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
    borderStrong: '#C8D4E2',
    borderSubtle: palette.lightBorderSubtle,
    text: palette.textLightPrimary,
    textSecondary: palette.textLightSecondary,
    textMuted: palette.textLightMuted,
    textInverse: palette.textDarkPrimary,
    interactive: palette.blue,
    interactiveHover: palette.blueHover,
    primarySoft: palette.blueSoft,
    primarySoftStrong: palette.blueSoftStrong,
    accent: palette.violet,
    accentSoft: palette.violetSoft,
    inputBg: '#FFFFFF',
    inputBorder: '#DCE4EE',
    inputBorderFocus: palette.blue,
    glass: palette.lightGlass,
    pressed: palette.lightPressed,
    scrim: 'rgba(4, 10, 18, 0.52)',
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
    bgElevated: palette.darkBgSecondary,
    bgSecondary: palette.darkBgSecondary,
    card: palette.darkCard,
    cardElevated: palette.darkCardElevated,
    cardBorder: palette.darkBorder,
    border: palette.darkBorder,
    borderStrong: '#314156',
    borderSubtle: palette.darkBorderSubtle,
    text: palette.textDarkPrimary,
    textSecondary: palette.textDarkSecondary,
    textMuted: palette.textDarkMuted,
    textInverse: palette.textLightPrimary,
    interactive: palette.blue,
    interactiveHover: palette.blueHover,
    primarySoft: palette.blueSoft,
    primarySoftStrong: palette.blueSoftStrong,
    accent: palette.violet,
    accentSoft: palette.violetSoft,
    inputBg: palette.darkCard,
    inputBorder: palette.darkBorder,
    inputBorderFocus: palette.blue,
    glass: palette.darkGlass,
    pressed: palette.darkPressed,
    scrim: 'rgba(0, 0, 0, 0.68)',
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
  primarySoftStrong: string;
  accent: string;
  accentSoft: string;
  inputBg: string;
  inputBorder: string;
  inputBorderFocus: string;
  glass: string;
  pressed: string;
  scrim: string;
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
