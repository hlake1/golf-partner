import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

// Mock current user - will come from auth/Supabase later
type PlayingStyle = 'competitive' | 'casual';
interface CurrentUser {
  name: string;
  age: number;
  handicap: number;
  clubs: string[];
  playingStyle: PlayingStyle;
  upForDrink: boolean;
  occupation: string;
  photoUrl: string | null;
}
const CURRENT_USER: CurrentUser = {
  name: 'Herbie Lake',
  age: 20,
  handicap: 14,
  clubs: ['Frilford Heath'],
  playingStyle: 'casual',
  upForDrink: true,
  occupation: 'Restaurant Manager',
  photoUrl: null,
};

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Photo + Name header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {CURRENT_USER.name.charAt(0)}
            </Text>
          </View>
          <Text style={styles.name}>{CURRENT_USER.name}</Text>
          <Text style={styles.age}>Age {CURRENT_USER.age}</Text>

          <TouchableOpacity style={styles.editPhotoButton}>
            <Text style={styles.editPhotoText}>📷 Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard label="Handicap" value={String(CURRENT_USER.handicap)} />
          <StatCard label="Style" value={CURRENT_USER.playingStyle === 'competitive' ? '🏆' : '😌'} />
          <StatCard label="Drinks After" value={CURRENT_USER.upForDrink ? '✅' : '❌'} />
        </View>

        {/* Sections */}
        <Section title="Club Memberships">
          {CURRENT_USER.clubs.map((club) => (
            <View key={club} style={styles.clubChip}>
              <Text style={styles.clubChipText}>⛳ {club}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.addClubButton}>
            <Text style={styles.addClubText}>+ Add Club</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Occupation">
          <Text style={styles.plainText}>
            💼 {CURRENT_USER.occupation}
          </Text>
          <Text style={styles.helperText}>
            Optional - helps with networking with fellow golfers
          </Text>
        </Section>

        <Section title="Playing Preferences">
          <PreferenceRow
            label="Playing Style"
            value={CURRENT_USER.playingStyle === 'competitive' ? 'Competitive' : 'Casual'}
          />
          <PreferenceRow
            label="Drinks Afterwards"
            value={CURRENT_USER.upForDrink ? 'Yes' : 'No'}
          />
        </Section>

        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PreferenceRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.preferenceRow}>
      <Text style={styles.preferenceLabel}>{label}</Text>
      <Text style={styles.preferenceValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: {
    fontSize: 44,
    fontWeight: '700',
    color: colors.white,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  age: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 2,
  },
  editPhotoButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
  },
  editPhotoText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  clubChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
  },
  clubChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
  addClubButton: {
    marginTop: 4,
  },
  addClubText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  plainText: {
    fontSize: 14,
    color: colors.text,
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  preferenceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  preferenceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  editButton: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
