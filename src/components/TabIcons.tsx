import React from 'react';
import AppIcon, { AppIconName } from './AppIcon';

/**
 * Bottom-tab icons — Gabriel's Scramble icon set.
 *
 * The PNGs have baked-in colour (navy + sage), so we can't tint them for
 * active/inactive states like SVGs. Instead we render them at full colour
 * always and dim the inactive ones with opacity. The active state is also
 * communicated via the tab label colour (sage accent) and the tab bar
 * underline.
 */

export type TabIconProps = {
  size?: number;
  color: string; // kept for API compatibility with react-navigation; drives opacity, not tint
  focused?: boolean;
};

// Inactive state = slightly dimmed so the active tab pops.
const INACTIVE_OPACITY = 0.4;
const ACTIVE_OPACITY = 1;

function tabOpacity(focused?: boolean, color?: string) {
  // react-navigation passes color=activeTintColor when focused, inactive tint when not.
  // We treat any focused=true as fully opaque; otherwise dimmed.
  if (focused === true) return ACTIVE_OPACITY;
  if (focused === false) return INACTIVE_OPACITY;
  // Fallback: guess from the colour — active tabs get the sage accent.
  return color && color.toLowerCase().startsWith('#a') ? ACTIVE_OPACITY : INACTIVE_OPACITY;
}

function makeTabIcon(name: AppIconName) {
  return function TabIcon({ size = 28, color, focused }: TabIconProps) {
    return <AppIcon name={name} size={size} style={{ opacity: tabOpacity(focused, color) }} />;
  };
}

export const HomeTabIcon = makeTabIcon('flag-green');
export const MapTabIcon = makeTabIcon('map-pin');
export const CalendarTabIcon = makeTabIcon('calendar');
export const ChatTabIcon = makeTabIcon('chat');
export const ProfileTabIcon = makeTabIcon('profile');
