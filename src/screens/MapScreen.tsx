import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

/**
 * TEMPORARY STUB — 2026-07-28
 *
 * The real MapScreen (backed up as MapScreen.tsx.original) imports
 * `react-native-maps`, which is suspected of crashing the Expo Go bundle
 * on load (blank white screen). This stub lets us verify whether removing
 * the react-native-maps import fixes the load. If yes, we bring back the
 * map behind a proper native-only guard / dev-client build.
 */
export default function MapScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Map coming soon</Text>
        <Text style={styles.subtitle}>
          We're rebuilding this screen. Head to the Home tab to find nearby players
          in the meantime.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    color: colors.text ?? '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: colors.textMuted ?? '#9BA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
});
