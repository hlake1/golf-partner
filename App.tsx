import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { useProfile, isProfileComplete } from './src/hooks/useProfile';
import RootNavigator from './src/navigation/RootNavigator';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { colors } from './src/theme/colors';

function Splash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function ProfileGate() {
  const { profile, loading, refresh } = useProfile();

  if (loading) return <Splash />;
  if (!isProfileComplete(profile)) return <OnboardingScreen onDone={refresh} />;
  return <RootNavigator />;
}

function RootGate() {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  return session ? <ProfileGate /> : <AuthScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <RootGate />
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
