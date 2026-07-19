import React from 'react';
import Svg, { Rect, Path, Line, Circle } from 'react-native-svg';

/**
 * The Scramble mark — S-shaped fairway with flag and cup.
 * Middle variant from the branding board: mist-blue rounded square, navy mark.
 *
 * Pass `variant="mark"` to render just the mark on transparent bg (useful for
 * placing on custom-colored surfaces).
 */
export type ScrambleMarkProps = {
  size?: number;
  variant?: 'icon' | 'mark';
  /** For variant='mark': color of the stroke, flag, and cup. */
  markColor?: string;
  /** For variant='icon': color of the rounded-square background. */
  backgroundColor?: string;
};

export default function ScrambleMark({
  size = 96,
  variant = 'icon',
  markColor = '#0F1622',
  backgroundColor = '#8FA0B5',
}: ScrambleMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      {variant === 'icon' && (
        <Rect x={0} y={0} width={1024} height={1024} rx={230} ry={230} fill={backgroundColor} />
      )}

      <Path
        d="M 720 300 C 720 220, 620 180, 500 200 C 380 220, 300 300, 300 380 C 300 460, 380 500, 500 520 C 620 540, 720 580, 720 660 C 720 740, 620 780, 500 780"
        fill="none"
        stroke={markColor}
        strokeWidth={76}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Line x1={720} y1={120} x2={720} y2={300} stroke={markColor} strokeWidth={14} strokeLinecap="round" />
      <Path d="M 720 130 L 830 165 L 720 200 Z" fill={markColor} />
      <Circle cx={500} cy={780} r={20} fill={markColor} />
    </Svg>
  );
}
