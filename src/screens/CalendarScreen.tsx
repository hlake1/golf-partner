import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const MOCK_ROUNDS = [
  {
    id: '1',
    host: 'James Wilson',
    club: 'Frilford Heath',
    date: 'Sat 25th Jul',
    time: '09:30',
    playersNeeded: 2,
    playersJoined: 1,
  },
  {
    id: '2',
    host: 'Sarah Mitchell',
    club: 'The Oxfordshire',
    date: 'Sun 26th Jul',
    time: '14:00',
    playersNeeded: 3,
    playersJoined: 0,
  },
];

export default function CalendarScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Upcoming Rounds</Text>
          <Text style={styles.subtitle}>
            Join a future round, or post your own
          </Text>
        </View>

        <TouchableOpacity style={styles.createButton}>
          <Text style={styles.createButtonText}>+ Post a Round</Text>
        </TouchableOpacity>

        <View style={styles.roundList}>
          {MOCK_ROUNDS.map((round) => (
            <View key={round.id} style={styles.roundCard}>
              <View style={styles.dateBlock}>
                <Text style={styles.dateText}>{round.date}</Text>
                <Text style={styles.timeText}>{round.time}</Text>
              </View>

              <View style={styles.roundBody}>
                <Text style={styles.roundClub}>{round.club}</Text>
                <Text style={styles.roundHost}>Hosted by {round.host}</Text>
                <Text style={styles.roundSpots}>
                  {round.playersJoined} of {round.playersNeeded + 1} spots filled
                </Text>

                <TouchableOpacity style={styles.joinRoundButton}>
                  <Text style={styles.joinRoundText}>Request to Join</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  createButton: {
    marginHorizontal: 20,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  roundList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  roundCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dateBlock: {
    width: 80,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  timeText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  roundBody: {
    flex: 1,
  },
  roundClub: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  roundHost: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roundSpots: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  joinRoundButton: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  joinRoundText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
});
