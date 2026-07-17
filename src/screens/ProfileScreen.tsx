import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';
import { uploadProfilePhoto } from '../lib/uploadProfilePhoto';

interface ClubRow {
  club_id: string;
  clubs: { id: string; name: string } | null;
}

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const { profile, loading, refresh } = useProfile();
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [photoUpdating, setPhotoUpdating] = useState(false);

  async function handleChangePhoto() {
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to add a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setPhotoUpdating(true);
    try {
      const url = await uploadProfilePhoto(result.assets[0].uri, user.id);
      const { error } = await supabase
        .from('profiles')
        .update({ photo_url: url })
        .eq('id', user.id);
      if (error) throw new Error(error.message);
      await refresh();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Something went wrong.');
    } finally {
      setPhotoUpdating(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      setClubsLoading(true);
      const { data, error } = await supabase
        .from('profile_clubs')
        .select('club_id, clubs(id, name)')
        .eq('profile_id', user.id);
      if (!error && data) {
        const cleaned = (data as unknown as ClubRow[])
          .map((row) => row.clubs)
          .filter((c): c is { id: string; name: string } => !!c);
        setClubs(cleaned);
      }
      setClubsLoading(false);
    })();
  }, [user, profile?.id]);

  function handleSignOut() {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const initial = profile.full_name?.charAt(0)?.toUpperCase() ?? '⛳';
  const styleLabel = profile.playing_style === 'competitive' ? '🏆' : '😌';
  const drinkLabel = profile.up_for_drink_afterwards ? '✅' : '❌';

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={undefined}
      >
        {/* Photo + Name header */}
        <View style={styles.header}>
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <Text style={styles.name}>{profile.full_name}</Text>
          {profile.age !== null && (
            <Text style={styles.age}>Age {profile.age}</Text>
          )}

          <TouchableOpacity
            style={styles.editPhotoButton}
            onPress={handleChangePhoto}
            disabled={photoUpdating}
          >
            {photoUpdating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.editPhotoText}>
                📷 {profile.photo_url ? 'Change Photo' : 'Add Photo'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard
            label="Handicap"
            value={profile.handicap !== null ? String(profile.handicap) : '—'}
          />
          <StatCard label="Style" value={styleLabel} />
          <StatCard label="Drinks After" value={drinkLabel} />
        </View>

        {/* Club Memberships */}
        <Section title="Club Memberships">
          {clubsLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : clubs.length === 0 ? (
            <Text style={styles.emptyText}>No clubs added yet</Text>
          ) : (
            <View style={styles.clubChipsRow}>
              {clubs.map((club) => (
                <View key={club.id} style={styles.clubChip}>
                  <Text style={styles.clubChipText}>⛳ {club.name}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Occupation */}
        <Section title="Occupation">
          {profile.occupation ? (
            <>
              <Text style={styles.plainText}>💼 {profile.occupation}</Text>
              <Text style={styles.helperText}>
                Helps with networking with fellow golfers
              </Text>
            </>
          ) : (
            <Text style={styles.emptyText}>Not set (optional)</Text>
          )}
        </Section>

        {/* Playing Preferences */}
        <Section title="Playing Preferences">
          <PreferenceRow
            label="Playing Style"
            value={profile.playing_style === 'competitive' ? 'Competitive' : 'Casual'}
          />
          <PreferenceRow
            label="Drinks Afterwards"
            value={profile.up_for_drink_afterwards ? 'Yes' : 'No'}
          />
          <PreferenceRow
            label="Search Radius"
            value={`${profile.search_radius_miles} miles`}
          />
        </Section>

        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit Profile (coming soon)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {user?.email && (
          <Text style={styles.emailFootnote}>Signed in as {user.email}</Text>
        )}
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  clubChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  clubChip: {
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
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
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
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  signOutButton: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  emailFootnote: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
});
