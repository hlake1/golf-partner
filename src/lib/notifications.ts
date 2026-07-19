// ============================================================================
// Push notification setup for Scramble.
//
// Responsibilities:
//   1. Configure the Expo notification handler (how notifications appear when
//      the app is in the foreground).
//   2. Request permission from the user.
//   3. Fetch the Expo push token for this device.
//   4. Register that token against the current user in Supabase (push_tokens).
//   5. Clean up the token on logout so we don't push to a stale device.
//
// NOTE: Actually SENDING push notifications requires wiring up either:
//   (a) A Supabase Edge Function that reads new rows from public.notifications
//       and forwards them to Expo's push service (https://exp.host/--/api/v2/push/send),
//       OR
//   (b) A trigger on public.notifications that uses pg_net to hit Expo's API directly.
// That work happens once we do the EAS build. For now, in-app notifications
// (bell icon + realtime subscription) will still work end-to-end.
// ============================================================================

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// How notifications behave when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // iOS 14+ has separate banner/list settings; keeping both true = show banner + add to list
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Ask for notification permission and return the Expo push token if granted.
 * Returns null if permission was denied or we're on a simulator that can't get one.
 */
export async function requestPushToken(): Promise<string | null> {
  // Push tokens only work on real devices (not the iOS/Android simulator).
  // Constants.isDevice is defined at runtime but not always in the type defs,
  // so we access it loosely and default to true if the flag is missing.
  const isDevice = (Constants as any).isDevice ?? true;
  if (!isDevice && Platform.OS !== 'web') {
    // Simulator - Expo can't issue a real token. Not fatal.
    console.log('[notifications] Skipping push token (not a physical device)');
    return null;
  }

  // On Android we need a channel BEFORE requesting permission for the sound/vibration to work.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F1622',
    });
  }

  // Check existing permission; only prompt if not yet decided.
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Permission not granted');
    return null;
  }

  // The projectId is required when using EAS. It's read from app.json / eas.json.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;

  try {
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResp.data ?? null;
  } catch (err) {
    // Common in dev on Expo Go without an EAS project - not fatal.
    console.warn('[notifications] Failed to get Expo push token:', err);
    return null;
  }
}

/**
 * Register (upsert) the given push token against the current user.
 * Safe to call repeatedly - unique constraint on (user_id, expo_push_token) dedupes.
 */
export async function registerPushToken(userId: string, token: string): Promise<void> {
  const deviceInfo = {
    os: Platform.OS,
    osVersion: Platform.Version,
    model: (Constants.deviceName as string | undefined) ?? null,
  };

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id: userId,
        expo_push_token: token,
        device_info: deviceInfo,
      },
      { onConflict: 'user_id,expo_push_token' }
    );

  if (error) {
    console.warn('[notifications] Failed to register push token:', error.message);
  }
}

/**
 * Convenience: full "on login" flow. Ask, get token, register.
 * Silent on failure so we never block sign-in.
 */
export async function setupPushForUser(userId: string): Promise<string | null> {
  try {
    const token = await requestPushToken();
    if (token) {
      await registerPushToken(userId, token);
    }
    return token;
  } catch (err) {
    console.warn('[notifications] setupPushForUser failed:', err);
    return null;
  }
}

/**
 * Remove this device's token(s) on logout so we don't push to it anymore.
 */
export async function unregisterPushTokensForUser(userId: string): Promise<void> {
  try {
    const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId);
    if (error) console.warn('[notifications] Failed to clear push tokens:', error.message);
  } catch (err) {
    console.warn('[notifications] unregisterPushTokensForUser failed:', err);
  }
}
