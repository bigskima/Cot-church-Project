/**
 * Church Digital Platform Design Tokens
 * 
 * Semantic design system with navy + white + accent blue
 * Supports light and dark modes with proper contrast
 * No hardcoded colours in screens - use tokens exclusively
 */

export const brandTokens = {
  // Brand foundation
  navy: {
    950: '#061426',
    900: '#091B33',
    800: '#0D294B',
    700: '#123A66',
    600: '#18528B',
  },
  blue: {
    500: '#2F6FED',
    400: '#5C8FF5',
  },
  white: '#FFFFFF',
} as const;

export const semanticTokens = {
  light: {
    // Surfaces
    background: '#F7F9FC',
    surface: '#FFFFFF',
    surfaceSecondary: '#F1F5F9',
    surfaceElevated: '#FFFFFF',
    surfaceOverlay: 'rgba(6, 20, 38, 0.8)',

    // Text
    textPrimary: '#0B1628',
    textSecondary: '#475467',
    textMuted: '#667085',
    textInverse: '#FFFFFF',

    // Borders & dividers
    border: '#E4E7EC',
    borderStrong: '#D0D5DD',
    divider: '#F1F5F9',

    // Interactive
    primary: '#0D294B',
    primaryPressed: '#091B33',
    primarySoft: '#EAF1FA',
    interactive: '#2F6FED',
    interactivePressed: '#18528B',
    interactiveSoft: '#EAF1FA',

    // Links
    link: '#18528B',
    linkVisited: '#18528B',

    // Semantic
    destructive: '#E5484D',
    destructiveSoft: '#FEE2E4',
    success: '#16A36A',
    successSoft: '#D3FAE0',
    warning: '#E9A23B',
    warningSoft: '#FEF0E4',
    info: '#2F6FED',
    infoSoft: '#EAF1FA',

    // Special
    live: '#E5484D',
    livePulse: '#FF6B6B',
  },

  dark: {
    // Surfaces
    background: '#07111F',
    surface: '#0C1929',
    surfaceSecondary: '#112238',
    surfaceElevated: '#152A43',
    surfaceOverlay: 'rgba(0, 0, 0, 0.8)',

    // Text
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    textInverse: '#0B1628',

    // Borders & dividers
    border: '#21344B',
    borderStrong: '#304762',
    divider: '#112238',

    // Interactive
    primary: '#FFFFFF',
    primaryPressed: '#E4E7EC',
    primarySoft: '#152A43',
    interactive: '#6EA8FF',
    interactivePressed: '#5C8FF5',
    interactiveSoft: '#152A43',

    // Links
    link: '#6EA8FF',
    linkVisited: '#5C8FF5',

    // Semantic
    destructive: '#E5484D',
    destructiveSoft: '#7E2B2F',
    success: '#16A36A',
    successSoft: '#0F5C3D',
    warning: '#E9A23B',
    warningSoft: '#7E5820',
    info: '#6EA8FF',
    infoSoft: '#1E3A5F',

    // Special
    live: '#E5484D',
    livePulse: '#FF6B6B',
  },
} as const;

export const spacing = {
  0: 0,
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  56: 56,
  64: 64,
  72: 72,
  80: 80,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
  },
  h1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600' as const,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  buttonSmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
} as const;

export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: 'rgba(6, 20, 38, 0.05)',
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: 'rgba(6, 20, 38, 0.08)',
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: 'rgba(6, 20, 38, 0.12)',
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: 'rgba(6, 20, 38, 0.16)',
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export type SemanticTokens = typeof semanticTokens.light;
export type TypographyToken = typeof typography[keyof typeof typography];
export type SpacingToken = typeof spacing[keyof typeof spacing];
export type RadiusToken = typeof radius[keyof typeof radius];
