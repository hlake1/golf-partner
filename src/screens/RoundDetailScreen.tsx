import React from 'react';
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
import type { MyRound } from '../hooks/useMyRounds';

interface Props {
  round: MyRound;
  onBack: () => void;
}

export default function RoundDetailScreen({ round, onBack }: Props) {
  const date = new Date(round.scheduled_for);
  const dateText = date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeText = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalSpots = round.players_needed + 1;
  const filled = round.accepted_players.length + 1;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Round details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Big date + time headline */}
        <View style={styles.headline}>
          <Text style={styles.headlineDate}>{dateText}</Text>
          <Text style={styles.headlineTime}>Tee time · {timeText}</Text>
        </View>

        {/* Role badge */}
        <View
          style={[
            styles.roleBadge,
            round.role === 'host' ? styles.roleBadgeHost : styles.roleBadgeAccepted,
          ]}
        >
          <Text style={styles.roleBadgeText}>
            {round.role === 'host' ? "🏆 You're hosting" : "✅ You're playing"}
          </Text>
        </View>

        {/* Club */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Club</Text>
          <Text style={styles.sectionValue}>⛳ {round.club?.name ?? 'Unknown'}</Text>
        </View>

        {/* Host */}
        {round.role === 'accepted' && round.host && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Host</Text>
            <View style={styles.playerRow}>
              {round.host.photo_url ? (
                <Image source={{ uri: round.host.photo_url }} style={styles.playerAvatar} />
              ) : (
                <View style={styles.playerAvatarPlaceholder}>
                  <Text style={styles.playerAvatarInitial}>
                    {round.host.full_name.charAt(0)}
                  </Text>
                </View>
              )}
              <Text style={styles.playerName}>{round.host.full_name}</Text>
            </View>
          </View>
        )}

        {/* Players */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Players ({filled}/{totalSpots})
          </Text>
          {round.role === 'host' && round.host && (
            <View style={styles.playerRow}>
              {round.host.photo_url ? (
                <Image source={{ uri: round.host.photo_url }} style={styles.playerAvatar} />
              ) : (
                <View style={styles.playerAvatarPlaceholder}>
                  <Text style={styles.playerAvatarInitial}>
                    {round.host.full_name.charAt(0)}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>{round.host.full_name}</Text>
                <Text style={styles.playerSubtext}>Host (you)</Text>
              </View>
            </View>
          )}
          {round.accepted_players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              {p.photo_url ? (
                <Image source={{ uri: p.photo_url }} style={styles.playerAvatar} />
              ) : (
                <View style={styles.playerAvatarPlaceholder}>
                  <Text style={styles.playerAvatarInitial}>{p.full_name.charAt(0)}</Text>
                </View>
              )}
              <Text style={styles.playerName}>{p.full_name}</Text>
            </View>
          ))}
          {filled < totalSpots && (
            <Text style={styles.openSpots}>
              {totalSpots - filled} {totalSpots - filled === 1 ? 'spot' : 'spots'} still open
            </Text>
          )}
        </View>

        {/* Notes */}
        {round.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notesText}>💬 {round.notes}</Text>
          </View>
        )}

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Status</Text>
          <Text style={styles.sectionValue}>
            {round.status === 'open' ? '🟢 Open — still looking for players' : ''}
            {round.status === 'full' ? '🔵 Full — ready to play' : ''}
            {round.status === 'completed' ? '⚪ Completed' : ''}
            {round.status === 'cancelled' ? '❌ Cancelled' : ''}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backChevron: { fontSize: 32, color: colors.primary, width: 32, lineHeight: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  content: { padding: 20, paddingBottom: 40 },
  headline: { marginBottom: 16 },
  headlineDate: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  headlineTime: { fontSize: 16, color: colors.textSecondary, marginTop: 4, fontWeight: '600' },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  roleBadgeHost: { backgroundColor: '#FEF3C7' },
  roleBadgeAccepted: { backgroundColor: '#D1FAE5' },
  roleBadgeText: { fontSize: 13, fontWeight: '700', color: colors.text },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  playerAvatar: { width: 40, height: 40, borderRadius: 20 },
  playerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerAvatarInitial: { fontSize: 16, fontWeight: '700', color: colors.white },
  playerName: { fontSize: 15, fontWeight: '600', color: colors.text },
  playerSubtext: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  openSpots: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  notesText: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
