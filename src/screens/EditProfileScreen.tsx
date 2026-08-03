import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useProfile, type PlayingStyle } from '../hooks/useProfile';

interface Club {
  id: string;
  name: string;
  county: string | null;
}

interface Props {
  onCancel: () => void;
  onSaved: () => void;
}

const RADIUS_CHOICES = [5, 10, 25, 50];

export default function EditProfileScreen({ onCancel, onSaved }: Props) {
  const { user } = useAuth();
  const { profile, refresh } = useProfile();

  // Editable state — seeded from the current profile.
  const [handicap, setHandicap] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [playingStyle, setPlayingStyle] = useState<PlayingStyle>('casual');
  const [upForDrink, setUpForDrink] = useState<boolean>(false);
  const [occupation, setOccupation] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [searchRadius, setSearchRadius] = useState<number>(10);

  // Location — only replaced if the user hits "Update location".
  const [newLocation, setNewLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Clubs
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [selectedClubIds, setSelectedClubIds] = useState<Set<string>>(new Set());
  const [originalClubIds, setOriginalClubIds] = useState<Set<string>>(new Set());
  const [clubFilter, setClubFilter] = useState<string>('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed form state from the profile once it loads.
  useEffect(() => {
    if (!profile) return;
    setHandicap(profile.handicap !== null ? String(profile.handicap) : '');
    setAge(profile.age !== null ? String(profile.age) : '');
    setPlayingStyle(profile.playing_style);
    setUpForDrink(profile.up_for_drink_afterwards);
    setOccupation(profile.occupation ?? '');
    setBio(profile.bio ?? '');
    setSearchRadius(profile.search_radius_miles ?? 10);
  }, [profile?.id]);

  // Load all clubs + the user's current memberships.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setClubsLoading(true);
      const [{ data: clubData, error: clubErr }, { data: memberData, error: memberErr }] =
        await Promise.all([
          supabase.from('clubs').select('id, name, county').order('name'),
          supabase.from('profile_clubs').select('club_id').eq('profile_id', user.id),
        ]);
      if (cancelled) return;
      if (clubErr) setError(clubErr.message);
      if (memberErr) setError(memberErr.message);
      setAllClubs(clubData ?? []);
      const ids = new Set<string>((memberData ?? []).map((r: any) => r.club_id));
      setSelectedClubIds(ids);
      setOriginalClubIds(new Set(ids));
      setClubsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const filteredClubs = useMemo(() => {
    const q = clubFilter.trim().toLowerCase();
    if (!q) return allClubs;
    return allClubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.county ?? '').toLowerCase().includes(q)
    );
  }, [allClubs, clubFilter]);

  function toggleClub(id: string) {
    setSelectedClubIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function grabLocation() {
    setGettingLocation(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('Location permission denied.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setNewLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e: any) {
      setError(e.message || 'Failed to get location.');
    } finally {
      setGettingLocation(false);
    }
  }

  async function save() {
    if (!user || !profile) return;

    // Validation
    const h = parseFloat(handicap);
    const a = parseInt(age, 10);
    if (handicap.trim() === '' || isNaN(h) || h < -10 || h > 54) {
      setError('Handicap must be a number between -10 and 54.');
      return;
    }
    if (age.trim() === '' || isNaN(a) || a < 13 || a > 120) {
      setError('Age must be between 13 and 120.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Update profile fields
      const updates: Record<string, any> = {
        handicap: h,
        age: a,
        playing_style: playingStyle,
        up_for_drink_afterwards: upForDrink,
        occupation: occupation.trim() || null,
        bio: bio.trim() || null,
        search_radius_miles: searchRadius,
      };
      if (newLocation) {
        updates.home_location = `SRID=4326;POINT(${newLocation.lng} ${newLocation.lat})`;
      }

      const { error: updateErr } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (updateErr) throw new Error(updateErr.message);

      // 2. Diff club memberships
      const toAdd: string[] = [];
      const toRemove: string[] = [];
      selectedClubIds.forEach((id) => {
        if (!originalClubIds.has(id)) toAdd.push(id);
      });
      originalClubIds.forEach((id) => {
        if (!selectedClubIds.has(id)) toRemove.push(id);
      });

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from('profile_clubs')
          .delete()
          .eq('profile_id', user.id)
          .in('club_id', toRemove);
        if (delErr) throw new Error(delErr.message);
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map((club_id) => ({ profile_id: user.id, club_id }));
        const { error: insErr } = await supabase.from('profile_clubs').insert(rows);
        if (insErr) throw new Error(insErr.message);
      }

      await refresh();
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    // Small friction if there are unsaved changes — cheap dirty-check.
    const dirty =
      !!profile &&
      (String(profile.handicap ?? '') !== handicap.trim() ||
        String(profile.age ?? '') !== age.trim() ||
        profile.playing_style !== playingStyle ||
        profile.up_for_drink_afterwards !== upForDrink ||
        (profile.occupation ?? '') !== occupation.trim() ||
        (profile.bio ?? '') !== bio.trim() ||
        (profile.search_radius_miles ?? 10) !== searchRadius ||
        !!newLocation ||
        toDiff(selectedClubIds, originalClubIds));

    if (!dirty) return onCancel();

    Alert.alert('Discard changes?', 'Your edits will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ]);
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} hitSlop={10}>
          <Text style={styles.headerBtnText} numberOfLines={1}>
            Cancel
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={save} disabled={saving} hitSlop={10}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={[styles.headerBtnText, styles.headerBtnSave]} numberOfLines={1}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basics */}
          <Section title="Basics">
            <Field label="Handicap">
              <TextInput
                style={styles.input}
                value={handicap}
                onChangeText={setHandicap}
                placeholder="e.g. 14 or 22.5"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.hint}>Enter 54 if you're new to the game.</Text>
            </Field>

            <Field label="Age">
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder="e.g. 30"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </Field>

            <Field label="Occupation (optional)">
              <TextInput
                style={styles.input}
                value={occupation}
                onChangeText={setOccupation}
                placeholder="e.g. Restaurant Manager"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.hint}>Handy for networking on the course.</Text>
            </Field>

            <Field label={`About Me / Interests (optional) — ${500 - bio.length} left`}>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, 500))}
                placeholder="A short bio. What are you into on and off the course? What kind of round are you after?"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>
                Give other players a feel for who you are. Interests, goals, playing frequency —
                whatever you want them to know.
              </Text>
            </Field>
          </Section>

          {/* Playing style */}
          <Section title="Playing Style">
            <View style={styles.choiceRow}>
              <TouchableOpacity
                style={[
                  styles.choiceCard,
                  playingStyle === 'competitive' && styles.choiceCardActive,
                ]}
                onPress={() => setPlayingStyle('competitive')}
              >
                <Text style={styles.choiceEmoji}>🏆</Text>
                <Text style={styles.choiceLabel}>Competitive</Text>
                <Text style={styles.choiceSubtext}>Score matters</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.choiceCard,
                  playingStyle === 'casual' && styles.choiceCardActive,
                ]}
                onPress={() => setPlayingStyle('casual')}
              >
                <Text style={styles.choiceEmoji}>😌</Text>
                <Text style={styles.choiceLabel}>Casual</Text>
                <Text style={styles.choiceSubtext}>Relaxed round</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Up for a drink afterwards?</Text>
                <Text style={styles.hint}>Great way to make friends at the 19th.</Text>
              </View>
              <Switch
                value={upForDrink}
                onValueChange={setUpForDrink}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={colors.white}
              />
            </View>
          </Section>

          {/* Discovery */}
          <Section title="Discovery">
            <Field label="Search radius">
              <View style={styles.pillRow}>
                {RADIUS_CHOICES.map((r) => {
                  const active = r === searchRadius;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setSearchRadius(r)}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {r} mi
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.hint}>
                Used across Find Players, Courses, and Discover.
              </Text>
            </Field>

            <Field label="Home location">
              {newLocation ? (
                <View style={styles.locationRow}>
                  <Text style={styles.locationText}>
                    ✅ Will update on save (
                    {newLocation.lat.toFixed(3)}, {newLocation.lng.toFixed(3)})
                  </Text>
                  <TouchableOpacity onPress={() => setNewLocation(null)}>
                    <Text style={styles.linkText}>Undo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.locationRow}>
                  <Text style={styles.locationText}>
                    📍 Using your saved location
                  </Text>
                  <TouchableOpacity
                    onPress={grabLocation}
                    disabled={gettingLocation}
                    style={styles.smallBtn}
                  >
                    {gettingLocation ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.smallBtnText}>Update</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.hint}>
                Only an approximate distance is ever shared with other players.
              </Text>
            </Field>
          </Section>

          {/* Clubs */}
          <Section title={`Club Memberships (${selectedClubIds.size})`}>
            {clubsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={clubFilter}
                  onChangeText={setClubFilter}
                  placeholder="Search clubs by name or county…"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={{ marginTop: 10, gap: 6 }}>
                  {filteredClubs.length === 0 && (
                    <Text style={styles.hint}>No clubs match "{clubFilter}"</Text>
                  )}
                  {filteredClubs.map((club) => {
                    const active = selectedClubIds.has(club.id);
                    return (
                      <TouchableOpacity
                        key={club.id}
                        style={[styles.clubItem, active && styles.clubItemActive]}
                        onPress={() => toggleClub(club.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.clubName, active && styles.clubNameActive]}
                          >
                            {club.name}
                          </Text>
                          {club.county && (
                            <Text style={styles.clubCounty}>{club.county}</Text>
                          )}
                        </View>
                        {active && <Text style={styles.checkmark}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </Section>

          {error && <Text style={styles.errorText}>⚠️ {error}</Text>}

          {/* Big save button at the bottom too for reachability */}
          <TouchableOpacity
            style={[styles.saveBigBtn, saving && styles.saveBigBtnDisabled]}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveBigBtnText}>Save changes</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Utility: are two Sets different? */
function toDiff(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return true;
  for (const x of a) if (!b.has(x)) return true;
  return false;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  headerBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    minWidth: 60,
  },
  headerBtnSave: {
    textAlign: 'right',
    fontWeight: '800',
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionBody: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  bioInput: {
    minHeight: 96,
    paddingTop: 12,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    fontStyle: 'italic',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  choiceCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  choiceCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSelected,
  },
  choiceEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  choiceLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  choiceSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.white,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  smallBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  smallBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  clubItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSelected,
  },
  clubName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  clubNameActive: {
    color: colors.primary,
  },
  clubCounty: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '800',
    marginLeft: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginVertical: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  saveBigBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBigBtnDisabled: {
    opacity: 0.6,
  },
  saveBigBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});
