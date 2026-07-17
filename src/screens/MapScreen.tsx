import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.placeholder}>
        <Text style={styles.emoji}>🗺️</Text>
        <Text style={styles.title}>Course Map</Text>
        <Text style={styles.subtitle}>
          Local golf courses within your search radius will show here.
        </Text>
        <Text style={styles.note}>
          Next: wire up react-native-maps + course data.
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
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 24,
    fontStyle: 'italic',
  },
});
