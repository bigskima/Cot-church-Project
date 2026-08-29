export const palette = {
  // Brand & Foundation
  midnight: '#071329',
  midnightDark: '#030A17',
  midnightLight: '#0D2040',
  navy: '#10264B',
  navyLight: '#1A3B73',
  blue: '#194F91',
  blueLight: '#2563EB',
  blueGlow: '#3B82F633',
  
  // Neutral & Surfaces
  cream: '#F6F4ED',
  creamDark: '#EDE8DB',
  surface: '#FFFFFF',
  surfaceSubtle: '#F8FAFC',
  surfaceDark: '#0F1E36',
  surfaceDarkElevated: '#172D52',
  glassDark: '#071329CC',
  glassLight: '#FFFFFFE0',
  glassBorder: '#FFFFFF1A',
  glassBorderDark: '#22385C',

  // Accent & Luxury
  gold: '#E7BB4D',
  goldLight: '#F3D27E',
  goldDark: '#C79A2B',
  goldGlow: '#E7BB4D33',
  
  // Typography
  ink: '#101828',
  inkSecondary: '#344054',
  muted: '#667085',
  mutedLight: '#94A3B8',
  white: '#FFFFFF',
  
  // System & Borders
  line: '#E8E9ED',
  lineDark: '#1E355B',
  
  // Status Colors
  live: '#E73554',
  liveGlow: '#E735544D',
  success: '#168A67',
  successGlow: '#168A6733',
  warning: '#F59E0B',
  warningGlow: '#F59E0B33',
  prayer: '#7257B5',
  prayerGlow: '#7257B533',
  giving: '#10B981',
  givingGlow: '#10B98133',
};

export const gradients = {
  heroDark: ['#07132900', '#071329B3', '#071329'],
  goldShimmer: ['#F3D27E', '#E7BB4D', '#C79A2B'],
  blueGlow: ['#194F91', '#10264B', '#071329'],
  liveStream: ['#E73554', '#991B1B'],
  glassOverlay: ['#FFFFFF10', '#FFFFFF05'],
  cardDark: ['#172D52', '#0F1E36'],
  accentPurple: ['#8B5CF6', '#6D28D9'],
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
  hero: 56,
};

export const radius = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  glowGold: {
    shadowColor: '#E7BB4D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  glowLive: {
    shadowColor: '#E73554',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
};
