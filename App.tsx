import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { useProfile, isProfileComplete } from './src/hooks/useProfile';
import RootNavigator from './src/navigation/RootNavigator';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { colors } from './src/theme/colors';
import { setupPushForUser } from './src/lib/notifications';

function Splash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function ProfileGate() {
  const { profile, loading, refresh } = useProfile();
  const { user } = useAuth();
  const setupRef = useRef<string | null>(null);

  // Kick off push notification setup once the user has a complete profile.
  // We deliberately wait until onboarding is done so the permission prompt
  // doesn't show up before the user has invested anything in the app.
  useEffect(() => {
    if (!user) {
      setupRef.current = null;
      return;
    }
    if (!isProfileComplete(profile)) return;
    if (setupRef.current === user.id) return; // already set up this session

    setupRef.current = user.id;
    setupPushForUser(user.id).catch(() => {
      // Silent - never block the app on push setup
      setupRef.current = null;
    });
  }, [user, profile]);

  if (loading) return <Splash />;
  if (!isProfileComplete(profile)) return <OnboardingScreen onDone={refresh} />;
  return <RootNavigator />;
}

function RootGate() {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  return session ? <ProfileGate /> : <AuthScreen />;
}

/**
 * Handle taps on push notifications while the app is running/backgrounded.
 * When we later add deep-linking, this listener will route to the right screen.
 */
function usePushNotificationTapHandler() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      // TODO: deep-link routing based on data.type / data.round_id / data.conversation_id
      // For now the bell icon + notifications screen surface everything anyway.
      console.log('[notifications] tapped', data);
    });
    return () => sub.remove();
  }, []);
}

function AppInner() {
  usePushNotificationTapHandler();
  return <RootGate />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  if (!fontsLoaded) {
    // Very brief flash before fonts are ready; use the splash-style loader.
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Splash />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
