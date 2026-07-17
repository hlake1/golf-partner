// Golf Partner brand colors
// Inspired by a golf course: greens, sky blues, warm accents

export const colors = {
  // Primary - deep golf green
  primary: '#0F5132',
  primaryLight: '#198754',
  primaryDark: '#0A3D22',

  // Accent - warm sunset (for CTAs, matches)
  accent: '#F59E0B',
  accentLight: '#FBBF24',

  // Background
  background: '#F8FAF8',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F1',

  // Text
  text: '#1A1F1A',
  textSecondary: '#5A625A',
  textMuted: '#8A928A',

  // Borders / dividers
  border: '#E1E7E1',
  divider: '#EDF1ED',

  // Semantic
  success: '#198754',
  danger: '#DC3545',
  warning: '#F59E0B',
  info: '#0DCAF0',

  // UI states
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export type ColorKey = keyof typeof colors;
