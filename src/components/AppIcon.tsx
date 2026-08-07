import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

/**
 * AppIcon — canonical wrapper for Gabriel's Scramble icon set.
 *
 * All PNGs live in `assets/icons-gabriel/` and share a consistent
 * navy-outline + sage-fill visual style. They render at their baked-in
 * colours — do not attempt to tint via the `tintColor` style prop
 * (they aren't monochrome). If you need a dimmed state (e.g. inactive
 * tab), use `style={{ opacity: 0.45 }}` on the icon.
 */

// Static require map so Metro can resolve every asset at build time.
// Add new keys here as Gabriel ships more icons.
const ICONS = {
  bell:          require('../../assets/icons-gabriel/bell.png'),
  'map-pin':     require('../../assets/icons-gabriel/map-pin.png'),
  'find-players': require('../../assets/icons-gabriel/find-players.png'),
  calendar:      require('../../assets/icons-gabriel/calendar.png'),
  chat:          require('../../assets/icons-gabriel/chat.png'),
  profile:       require('../../assets/icons-gabriel/profile.png'),
  stats:         require('../../assets/icons-gabriel/stats.png'),
  history:       require('../../assets/icons-gabriel/history.png'),
  search:        require('../../assets/icons-gabriel/search.png'),
  'flag-green':  require('../../assets/icons-gabriel/flag-green.png'),
  trophy:        require('../../assets/icons-gabriel/trophy.png'),
  golfer:        require('../../assets/icons-gabriel/golfer.png'),
  pin:           require('../../assets/icons-gabriel/pin.png'),
  briefcase:     require('../../assets/icons-gabriel/briefcase.png'), // repurposed: Terms of Service
  camera:        require('../../assets/icons-gabriel/camera.png'),
  lock:          require('../../assets/icons-gabriel/lock.png'),
  scorecard:     require('../../assets/icons-gabriel/scorecard.png'),
  cookie:        require('../../assets/icons-gabriel/cookie.png'),
  handshake:     require('../../assets/icons-gabriel/handshake.png'),
} as const;

export type AppIconName = keyof typeof ICONS;

export type AppIconProps = {
  name: AppIconName;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export default function AppIcon({ name, size = 20, style }: AppIconProps) {
  return (
    <Image
      source={ICONS[name]}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}
