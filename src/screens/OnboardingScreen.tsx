import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Switch,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { uploadProfilePhoto } from '../lib/uploadProfilePhoto';
import { useAuth } from '../contexts/AuthContext';
import type { PlayingStyle } from '../hooks/useProfile';

interface Club {
  id: string;
  name: string;
  county: string | null;
}

type Step = 'photo' | 'basics' | 'style' | 'clubs' | 'location';
const STEPS: Step[] = ['photo', 'basics', 'style', 'clubs', 'location'];

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('photo');

  // Form state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [handicap, setHandicap] = useState('');
  const [age, setAge] = useState('');
  const [playingStyle, setPlayingStyle] = useState<PlayingStyle>('casual');
  const [upForDrink, setUpForDrink] = useState(true);
  const [occupation, setOccupation] = useState('');
  const [selectedClubIds, setSelectedClubIds] = useState<Set<string>>(new Set());
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubFilter, setClubFilter] = useState('');
  const [clubsListOpen, setClubsListOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredClubs = useMemo(() => {
    const q = clubFilter.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.county ?? '').toLowerCase().includes(q)
    );
  }, [clubs, clubFilter]);

  const stepIndex = STEPS.indexOf(step);
  const isLastStep = step === 'location';

  // Load clubs when we hit the clubs step
  useEffect(() => {
    if (step !== 'clubs' || clubs.length > 0) return;
    setClubsLoading(true);
    supabase
      .from('clubs')
      .select('id, name, county')
      .order('name')
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setClubs(data ?? []);
        setClubsLoading(false);
      });
  }, [step, clubs.length]);

  function next() {
    setError(null);
    // Per-step validation
    if (step === 'basics') {
      const h = parseFloat(handicap);
      const a = parseInt(age, 10);
      if (isNaN(h) || h < -10 || h > 54) {
        setError('Handicap must be a number between -10 and 54.');
        return;
      }
      if (isNaN(a) || a < 13 || a > 120) {
        setError('Age must be between 13 and 120.');
        return;
      }
    }
    const idx = STEPS.indexOf(step);
    setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  }

  function back() {
    setError(null);
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  async function pickPhoto() {
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
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function grabLocation() {
    setGettingLocation(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('Location permission denied. We need this to find local players.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e: any) {
      setError(e.message || 'Failed to get location.');
    } finally {
      setGettingLocation(false);
    }
  }

  function toggleClub(id: string) {
    setSelectedClubIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!user) return;
    if (!location) {
      setError('Please share your location to continue.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Upload photo (if provided) to Supabase Storage
      let photoUrl: string | null = null;
      if (photoUri) {
        photoUrl = await uploadProfilePhoto(photoUri, user.id);
      }

      // 2. Update the profile row
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          photo_url: photoUrl,
          handicap: parseFloat(handicap),
          age: parseInt(age, 10),
          playing_style: playingStyle,
          up_for_drink_afterwards: upForDrink,
          occupation: occupation.trim() || null,
          // PostGIS geography stored via WKT text; Supabase accepts this form.
          home_location: `SRID=4326;POINT(${location.lng} ${location.lat})`,
        })
        .eq('id', user.id);

      if (profileErr) throw new Error(profileErr.message);

      // 3. Insert club memberships (if any)
      if (selectedClubIds.size > 0) {
        const rows = Array.from(selectedClubIds).map((club_id) => ({
          profile_id: user.id,
          club_id,
        }));
        const { error: clubsErr } = await supabase
          .from('profile_clubs')
          .insert(rows);
        if (clubsErr) throw new Error(clubsErr.message);
      }

      onDone();
    } catch (e: any) {
      setError(e.message || 'Failed to save profile.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((stepIndex + 1) / STEPS.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          Step {stepIndex + 1} of {STEPS.length}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'photo' && (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Add a profile photo</Text>
            <Text style={styles.subtitle}>
              Optional — but helps other golfers recognise you at the course.
            </Text>

            <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderEmoji}>📷</Text>
                  <Text style={styles.photoPlaceholderText}>Tap to add</Text>
                </View>
              )}
            </TouchableOpacity>

            {photoUri && (
              <TouchableOpacity onPress={() => setPhotoUri(null)}>
                <Text style={styles.linkText}>Remove photo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {step === 'basics' && (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Your golfing basics</Text>
            <Text style={styles.subtitle}>
              These help match you with players of a similar level.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Handicap</Text>
              <TextInput
                style={styles.input}
                value={handicap}
                onChangeText={setHandicap}
                placeholder="e.g. 14 or 22.5 (use - for plus handicaps)"
                placeholderTextColor={colors.textMuted}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
              />
              <Text style={styles.hint}>Enter 54 if you're new to the game. Use a minus sign (e.g. -2) for plus handicaps.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder="e.g. 30"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
          </View>
        )}

        {step === 'style' && (
          <View style={styles.stepContent}>
            <Text style={styles.title}>How do you play?</Text>
            <Text style={styles.subtitle}>
              This helps match you with like-minded golfers.
            </Text>

            <Text style={styles.label}>Playing style</Text>
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
                <Text style={styles.choiceSubtext}>
                  Score matters, playing to improve
                </Text>
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
                <Text style={styles.choiceSubtext}>
                  Relaxed round, enjoying the day
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Up for a drink afterwards?</Text>
                <Text style={styles.hint}>Great way to make friends at the 19th</Text>
              </View>
              <Switch
                value={upForDrink}
                onValueChange={setUpForDrink}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Occupation (optional)</Text>
              <TextInput
                style={styles.input}
                value={occupation}
                onChangeText={setOccupation}
                placeholder="e.g. Restaurant Manager"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.hint}>Handy for networking with fellow golfers</Text>
            </View>
          </View>
        )}

        {step === 'clubs' && (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Your club memberships</Text>
            <Text style={styles.subtitle}>
              Pick any clubs you're a member of. Skip if none.
            </Text>

            {clubsLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
            ) : (
              <>
                {/* Selected chips — so users can see what they've picked without
                    scrolling through the whole list. */}
                {selectedClubIds.size > 0 && (
                  <View style={styles.chipRow}>
                    {clubs
                      .filter((c) => selectedClubIds.has(c.id))
                      .map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.chip}
                          onPress={() => toggleClub(c.id)}
                        >
                          <Text style={styles.chipText}>{c.name}</Text>
                          <Text style={styles.chipRemove}>✕</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}

                {/* Search bar + Done button */}
                <View style={styles.searchRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={clubFilter}
                    onChangeText={setClubFilter}
                    onFocus={() => setClubsListOpen(true)}
                    placeholder="Search clubs by name or county…"
                    placeholderTextColor={colors.textMuted}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                  />
                  {(clubsListOpen || clubFilter.length > 0) && (
                    <TouchableOpacity
                      style={styles.doneButton}
                      onPress={() => {
                        Keyboard.dismiss();
                        if (clubFilter.trim() === '') setClubsListOpen(false);
                      }}
                    >
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Browse all trigger when list is collapsed */}
                {clubFilter.trim() === '' && !clubsListOpen && (
                  <TouchableOpacity
                    onPress={() => setClubsListOpen(true)}
                    style={styles.expandLink}
                  >
                    <Text style={styles.expandLinkText}>Browse all clubs ↓</Text>
                  </TouchableOpacity>
                )}

                {/* Results list — only when searching or explicitly opened */}
                {(clubFilter.trim() !== '' || clubsListOpen) && (
                  <View style={styles.clubList}>
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

                    {clubsListOpen && (
                      <TouchableOpacity
                        onPress={() => {
                          setClubsListOpen(false);
                          setClubFilter('');
                          Keyboard.dismiss();
                        }}
                        style={styles.hideLink}
                      >
                        <Text style={styles.hideLinkText}>Hide list ↑</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {step === 'location' && (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Share your location</Text>
            <Text style={styles.subtitle}>
              We use this to find golfers near you. We never share your exact
              location — just an approximate distance.
            </Text>

            {!location ? (
              <TouchableOpacity
                style={styles.locationButton}
                onPress={grabLocation}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.locationEmoji}>📍</Text>
                    <Text style={styles.locationButtonText}>
                      Use my current location
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.locationConfirmed}>
                <Text style={styles.locationConfirmedEmoji}>✅</Text>
                <Text style={styles.locationConfirmedText}>Location set</Text>
                <TouchableOpacity onPress={grabLocation}>
                  <Text style={styles.linkText}>Update</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {error && <Text style={styles.errorText}>⚠️ {error}</Text>}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.actionBar}>
        {stepIndex > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={back}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            stepIndex === 0 && { marginLeft: 0 },
            submitting && styles.nextButtonDisabled,
          ]}
          onPress={isLastStep ? submit : next}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.nextButtonText}>
              {isLastStep ? 'Finish' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  stepContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    fontStyle: 'italic',
  },
  // Photo picker
  photoPicker: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  photoPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  photoPlaceholderText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  photoPreview: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  // Style choice cards
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  choiceCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  choiceCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSelected,
  },
  choiceEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  choiceLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  choiceSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  // Clubs
  clubList: {
    gap: 8,
    marginTop: 8,
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  clubItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSelected,
  },
  clubName: {
    fontSize: 15,
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
    fontSize: 20,
    color: colors.primary,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceSelected,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipRemove: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  doneButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  expandLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  expandLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  hideLink: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  hideLinkText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  // Location
  locationButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  locationEmoji: {
    fontSize: 24,
  },
  locationButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  locationConfirmed: {
    alignItems: 'center',
    padding: 20,
  },
  locationConfirmedEmoji: {
    fontSize: 60,
    marginBottom: 8,
  },
  locationConfirmedText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginHorizontal: 20,
    marginTop: 8,
    fontWeight: '500',
  },
  // Action bar
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 10,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  nextButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
});
