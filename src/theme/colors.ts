// Scramble brand colors
// Palette: navy → steel → ocean → mist, with sage as the natural (temporary) accent.
// A punchier accent color (Gabriel's pick) will slot into `accent` later.

export const colors = {
  // Primary - deep navy (headers, primary buttons, brand)
  primary: '#0F1622',
  primaryLight: '#243447', // Steel Blue - secondary surfaces/depth
  primaryDark: '#080D15', // Deeper navy for pressed states

  // Mid tones - ocean & mist
  ocean: '#60738A', // Ocean Blue - mid-tone accents, secondary text on dark
  mist: '#DCE5EF', // Mist Blue - card surfaces, subtle backgrounds

  // Accent - sage (placeholder until Gabriel's final accent color lands)
  // For CTAs, matched/joined states, brand highlights.
  accent: '#AEB8A7',
  accentLight: '#C5CEBF', // Softer sage for hover / subtle highlights

  // Background & surfaces
  // Gabriel's direction (2026-08-07): whole page is white; depth comes from
  // shadows on cards, not tinted background zones.
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#F5F7FA', // Slightly lifted surface (subtle, off-white)
  surfaceSelected: '#DCE5EF', // Selected chip / filter background (mist)

  // Text
  text: '#0F1622', // Same as primary - premium feel
  textSecondary: '#4A5568', // Muted navy-gray
  textMuted: '#8A94A3', // Ocean-tinted mute

  // Borders / dividers
  border: '#D8DFE8',
  divider: '#E4E9F0',

  // Semantic
  success: '#4A7C59', // Muted fairway green (tied to sage family)
  danger: '#DC3545',
  warning: '#E0A800',
  info: '#60738A', // Uses ocean blue

  // UI states
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 22, 34, 0.55)', // Navy-tinted overlay
} as const;

export type ColorKey = keyof typeof colors;
