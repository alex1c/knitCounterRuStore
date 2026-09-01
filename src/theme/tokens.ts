/**
 * Design tokens for Phase 1 UI foundations.
 * Warm, calm palette suited for a knitting/craft application.
 */

export const colors = {
  primary: '#B45309',
  primaryMuted: '#D97706',
  primarySoft: '#FEF3E2',

  text: '#1C1917',
  textSecondary: '#57534E',
  textMuted: '#A8A29E',

  background: '#FFFBF5',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F0E8',

  border: '#E7E5E4',
  danger: '#B91C1C',
  warning: '#B45309',
  success: '#047857',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

export const tokens = {
  colors,
  spacing,
  typography,
  radii,
} as const;

export default tokens;
