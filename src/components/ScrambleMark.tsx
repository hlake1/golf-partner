import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

/**
 * The Scramble mark — official logo.
 *
 * Renders the real logo asset (assets/logo.png). Kept the same API as the
 * previous SVG version so callers (HomeScreen, AuthScreen) don't need to
 * change:
 *   - `size`: bounding-box size in pt.
 *   - `variant`: 'icon' wraps the logo in a coloured rounded-square tile
 *     (matches the old on-brand look); 'mark' renders the logo transparent.
 *   - `backgroundColor`: tile colour when variant === 'icon'.
 *   - `markColor`: kept for API compatibility but no longer used — the real
 *     logo has fixed colours baked into the PNG.
 */
export type ScrambleMarkProps = {
  size?: number;
  variant?: 'icon' | 'mark';
  /** Retained for API compatibility; ignored (colours are baked into the PNG). */
  markColor?: string;
  /** For variant='icon': color of the rounded-square background. */
  backgroundColor?: string;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO_SOURCE = require('../../assets/logo.png');

export default function ScrambleMark({
  size = 96,
  variant = 'icon',
  backgroundColor = '#8FA0B5',
}: ScrambleMarkProps) {
  // Inner logo takes ~78% of the outer tile so it has a comfortable margin
  // inside the rounded square (mirrors what the app icon does on the home
  // screen).
  const innerSize = variant === 'icon' ? Math.round(size * 0.78) : size;
  const radius = Math.round(size * 0.22);

  if (variant === 'mark') {
    return (
      <Image
        source={LOGO_SOURCE}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor,
        },
      ]}
    >
      <Image
        source={LOGO_SOURCE}
        style={{ width: innerSize, height: innerSize }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
