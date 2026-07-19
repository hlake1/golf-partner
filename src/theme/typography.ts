/**
 * Scramble typography — Poppins family, matching the branding board.
 *
 * Only use these named tokens; don't set `fontFamily` inline.
 * Loaded once in App.tsx via `@expo-google-fonts/poppins` + `useFonts`.
 */

export const fonts = {
  // Body / UI
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
} as const;

/**
 * Convenience style presets for common text roles.
 * Import and spread these into StyleSheet objects, e.g.
 *   greeting: { ...text.h1, color: colors.primary }
 */
export const text = {
  display: { fontFamily: fonts.extrabold, fontSize: 34, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.semibold, fontSize: 17 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13 },
  micro: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.4 },
} as const;
