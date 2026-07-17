import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

// Mock data - we'll replace this with Supabase queries soon
const MOCK_PLAYERS = [
  {
    id: '1',
    name: 'James Wilson',
    age: 34,
    handicap: 12,
    club: 'Frilford Heath',
    playingStyle: 'competitive' as const,
    distanceMiles: 3.2,
    upForDrink: true,
    occupation: 'Restaurant Manager',
  },
  {
    id: '2',
    name: 'Sarah Mitchell',
    age: 28,
    handicap: 18,
    club: 'The Oxfordshire',
    playingStyle: 'casual' as const,
    distanceMiles: 5.8,
    upForDrink: true,
  },
  {
    id: '3',
    name: 'Dave Thompson',
    age: 42,
    handicap: 8,
    club: 'Frilford Heath',
    playingStyle: 'competitive' as const,
    distanceMiles: 4.1,
    upForDrink: false,
    occupation: 'Solicitor',
  },
];

const RADIUS_OPTIONS = [5, 10, 25, 50];

export default function HomeScreen() {
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [clubFilter, setClubFilter] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Local players near you</Text>
          <Text style={styles.subtitle}>
            Tap a player to invite them to a round
          </Text>
        </View>

        {/* Radius filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Search radius</Text>
          <View style={styles.filterRow}>
            {RADIUS_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.filterChip,
                  radiusMiles === r && styles.filterChipActive,
                ]}
                onPress={() => setRadiusMiles(r)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    radiusMiles === r && styles.filterChipTextActive,
                  ]}
                >
                  {r} mi
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Player cards */}
        <View style={styles.playerList}>
          {MOCK_PLAYERS.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlayerCard({ player }: { player: (typeof MOCK_PLAYERS)[0] }) {
  return (
    <View style={styles.card}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>
            {player.name.charAt(0)}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.playerName}>{player.name}</Text>
          <Text style={styles.distance}>{player.distanceMiles} mi</Text>
        </View>

        <Text style={styles.playerMeta}>
          Age {player.age} · HCP {player.handicap} · {player.club}
        </Text>

        {player.occupation && (
          <Text style={styles.playerOccupation}>💼 {player.occupation}</Text>
        )}

        <View style={styles.tagRow}>
          <View
            style={[
              styles.tag,
              player.playingStyle === 'competitive'
                ? styles.tagCompetitive
                : styles.tagCasual,
            ]}
          >
            <Text style={styles.tagText}>
              {player.playingStyle === 'competitive'
                ? '🏆 Competitive'
                : '😌 Casual'}
            </Text>
          </View>
          {player.upForDrink && (
            <View style={[styles.tag, styles.tagDrink]}>
              <Text style={styles.tagText}>🍺 Drinks after</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.joinButton}>
          <Text style={styles.joinButtonText}>⛳ Invite to a Round</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  playerList: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 8,
  },
  card: {
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
  avatarWrap: {
    width: 60,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
  },
  cardBody: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  playerName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  distance: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  playerMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  playerOccupation: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagCompetitive: {
    backgroundColor: '#FEF3C7',
  },
  tagCasual: {
    backgroundColor: '#D1FAE5',
  },
  tagDrink: {
    backgroundColor: '#FEE2E2',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  joinButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  joinButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
