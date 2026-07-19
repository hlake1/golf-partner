import React from 'react';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

/**
 * Bottom-tab icons — simple silhouettes rendered inline as SVG.
 * Sized at 26 by default; color driven by the caller (active vs inactive).
 */

export type TabIconProps = {
  size?: number;
  color: string;
};

// ─── Home: flag on green ────────────────────────────────────────────────────
export function HomeTabIcon({ size = 26, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Flag pole */}
      <Line x1={7} y1={3} x2={7} y2={21} stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Flag */}
      <Path d="M 7 4 L 17 7 L 7 10 Z" fill={color} />
      {/* Ground / green */}
      <Path
        d="M 3 20 Q 12 17 21 20"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// ─── Map: pin ───────────────────────────────────────────────────────────────
export function MapTabIcon({ size = 26, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M 12 2 C 8 2 5 5 5 9 C 5 14 12 22 12 22 C 12 22 19 14 19 9 C 19 5 16 2 12 2 Z"
        fill={color}
      />
      <Circle cx={12} cy={9} r={2.5} fill="#FFFFFF" />
    </Svg>
  );
}

// ─── Calendar: calendar grid ────────────────────────────────────────────────
export function CalendarTabIcon({ size = 26, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={16} rx={2.5} stroke={color} strokeWidth={2} fill="none" />
      {/* Top binder */}
      <Line x1={3} y1={9} x2={21} y2={9} stroke={color} strokeWidth={2} />
      {/* Rings */}
      <Line x1={8} y1={3} x2={8} y2={7} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={16} y1={3} x2={16} y2={7} stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* A single date dot */}
      <Circle cx={12} cy={15} r={1.6} fill={color} />
    </Svg>
  );
}

// ─── Chat: speech bubble ────────────────────────────────────────────────────
export function ChatTabIcon({ size = 26, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M 4 5 C 4 3.9 4.9 3 6 3 L 18 3 C 19.1 3 20 3.9 20 5 L 20 15 C 20 16.1 19.1 17 18 17 L 10 17 L 5.5 21 L 5.5 17 L 6 17 C 4.9 17 4 16.1 4 15 Z"
        fill={color}
      />
    </Svg>
  );
}

// ─── Profile: person silhouette ─────────────────────────────────────────────
export function ProfileTabIcon({ size = 26, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} fill={color} />
      <Path
        d="M 4 21 C 4 16.5 7.5 13 12 13 C 16.5 13 20 16.5 20 21 Z"
        fill={color}
      />
    </Svg>
  );
}
