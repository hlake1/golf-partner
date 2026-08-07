import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';

interface Club {
  id: string;
  name: string;
  county: string | null;
}

interface Props {
  onCancel: () => void;
  onCreated: () => void;
  /** Optional pre-selected club id (e.g. tapped from the map). */
  prefillClubId?: string | null;
  /** Optional pre-selected date (e.g. tapped from the schedule empty state). ISO date or Date. */
  prefillDate?: Date | string | null;
}

export default function CreateRoundScreen({
  onCancel,
  onCreated,
  prefillClubId,
  prefillDate,
}: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubModal, setClubModal] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [clubSearch, setClubSearch] = useState('');

  const filteredClubs = useMemo(() => {
    const q = clubSearch.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.county && c.county.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [clubs, clubSearch]);
  const [scheduledFor, setScheduledFor] = useState<Date>(() => {
    // If a prefill date was supplied, use it (at 10:00 local time).
    if (prefillDate) {
      const base =
        typeof prefillDate === 'string' ? new Date(prefillDate) : new Date(prefillDate);
      base.setHours(10, 0, 0, 0);
      return base;
    }
    const d = new Date();
    d.setDate(d.getDate() + 1); // default: tomorrow
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [playersNeeded, setPlayersNeeded] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Helper: set an error AND scroll the user to the top so they actually see it.
  const showError = (msg: string) => {
    setError(msg);
    // Give React a tick to render, then scroll.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  useEffect(() => {
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
  }, []);

  // If a prefillClubId is provided, snap the selection once clubs are loaded.
  useEffect(() => {
    if (!prefillClubId || selectedClub) return;
    const match = clubs.find((c) => c.id === prefillClubId);
    if (match) setSelectedClub(match);
  }, [prefillClubId, clubs, selectedClub]);

  async function submit() {
    if (!user) return;
    if (!selectedClub) {
      showError('Please pick a club.');
      return;
    }
    if (scheduledFor.getTime() < Date.now()) {
      showError('Please pick a future date and time.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: err } = await supabase.from('rounds').insert({
      host_id: user.id,
      club_id: selectedClub.id,
      scheduled_for: scheduledFor.toISOString(),
      players_needed: playersNeeded,
      notes: notes.trim() || null,
      status: 'open',
    });

    setSubmitting(false);

    if (err) {
      setError(err.message);
      return;
    }

    onCreated();
  }

  const dateLabel = scheduledFor.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeLabel = scheduledFor.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
      <View style={[styles.header, { paddingTop: 12 + insets.top }]}>
        <TouchableOpacity
          onPress={onCancel}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText} numberOfLines={1}>
            Cancel
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Round</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Club picker */}
        <View style={styles.field}>
          <Text style={styles.label}>Golf club</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setClubModal(true)}
            disabled={clubsLoading}
          >
            {clubsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.pickerText,
                  !selectedClub && styles.pickerPlaceholder,
                ]}
              >
                {selectedClub ? `⛳ ${selectedClub.name}` : 'Choose a club'}
              </Text>
            )}
            <Text style={styles.pickerChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Date + time */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Date</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={styles.pickerRow}>
                <AppIcon name="calendar" size={18} />
                <Text style={styles.pickerText}>{dateLabel}</Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Tee time</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.pickerText}>🕐 {timeLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showDatePicker && (
          Platform.OS === 'ios' ? (
            <Modal
              transparent
              animationType="fade"
              visible={showDatePicker}
              onRequestClose={() => setShowDatePicker(false)}
            >
              <TouchableOpacity
                style={styles.pickerBackdrop}
                activeOpacity={1}
                onPress={() => setShowDatePicker(false)}
              >
                <TouchableOpacity activeOpacity={1} style={styles.pickerSheet}>
                  <View style={styles.pickerSheetHeader}>
                    <Text style={styles.pickerSheetTitle}>Select date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.pickerSheetDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={scheduledFor}
                    mode="date"
                    display="inline"
                    minimumDate={new Date()}
                    onChange={(_, d) => {
                      if (d) {
                        const next = new Date(scheduledFor);
                        next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                        setScheduledFor(next);
                      }
                    }}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          ) : (
            <DateTimePicker
              value={scheduledFor}
              mode="date"
              minimumDate={new Date()}
              onChange={(_, d) => {
                setShowDatePicker(false);
                if (d) {
                  const next = new Date(scheduledFor);
                  next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                  setScheduledFor(next);
                }
              }}
            />
          )
        )}
        {showTimePicker && (
          Platform.OS === 'ios' ? (
            <Modal
              transparent
              animationType="fade"
              visible={showTimePicker}
              onRequestClose={() => setShowTimePicker(false)}
            >
              <TouchableOpacity
                style={styles.pickerBackdrop}
                activeOpacity={1}
                onPress={() => setShowTimePicker(false)}
              >
                <TouchableOpacity activeOpacity={1} style={styles.pickerSheet}>
                  <View style={styles.pickerSheetHeader}>
                    <Text style={styles.pickerSheetTitle}>Select tee time</Text>
                    <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.pickerSheetDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={scheduledFor}
                    mode="time"
                    display="spinner"
                    is24Hour
                    onChange={(_, d) => {
                      if (d) {
                        const next = new Date(scheduledFor);
                        next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                        setScheduledFor(next);
                      }
                    }}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          ) : (
            <DateTimePicker
              value={scheduledFor}
              mode="time"
              is24Hour
              onChange={(_, d) => {
                setShowTimePicker(false);
                if (d) {
                  const next = new Date(scheduledFor);
                  next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                  setScheduledFor(next);
                }
              }}
            />
          )
        )}

        {/* Players needed */}
        <View style={styles.field}>
          <Text style={styles.label}>Players needed</Text>
          <Text style={styles.hint}>
            How many extra players are you looking for? (You count as 1)
          </Text>
          <View style={styles.stepperRow}>
            {[1, 2, 3].map((n) => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.stepperChoice,
                  playersNeeded === n && styles.stepperChoiceActive,
                ]}
                onPress={() => setPlayersNeeded(n)}
              >
                <Text
                  style={[
                    styles.stepperText,
                    playersNeeded === n && styles.stepperTextActive,
                  ]}
                >
                  {n}
                </Text>
                <Text
                  style={[
                    styles.stepperSubtext,
                    playersNeeded === n && styles.stepperSubtextActive,
                  ]}
                >
                  {n === 1 ? '2-ball' : n === 2 ? '3-ball' : '4-ball'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Casual round, happy for beginners"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={280}
          />
        </View>

      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={submit}
          disabled={submitting || clubsLoading}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitText}>Post Round</Text>
          )}
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>

      {/* Club selection modal */}
      <Modal visible={clubModal} animationType="slide" onRequestClose={() => setClubModal(false)}>
        <SafeAreaView style={styles.container} edges={['left', 'right']}>
          <View style={[styles.header, { paddingTop: 12 + insets.top }]}>
            <TouchableOpacity
              onPress={() => setClubModal(false)}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText} numberOfLines={1}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Choose a Club</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Search bar */}
          <View style={styles.searchWrap}>
            <AppIcon name="search" size={16} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search clubs…"
              placeholderTextColor={colors.textMuted}
              value={clubSearch}
              onChangeText={setClubSearch}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {clubSearch.length > 0 && (
              <TouchableOpacity onPress={() => setClubSearch('')} hitSlop={8}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {filteredClubs.length === 0 && (
              <Text style={styles.emptySearchText}>
                No clubs match “{clubSearch}”. Try a different spelling?
              </Text>
            )}
            {filteredClubs.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.clubOption,
                  selectedClub?.id === c.id && styles.clubOptionActive,
                ]}
                onPress={() => {
                  setSelectedClub(c);
                  setClubModal(false);
                  setClubSearch('');
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.clubOptionName}>{c.name}</Text>
                  {c.county && <Text style={styles.clubOptionCounty}>{c.county}</Text>}
                </View>
                {selectedClub?.id === c.id && (
                  <Text style={styles.clubOptionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    paddingBottom: 12,
    minHeight: 56,
    // paddingTop is applied inline (12 + safe-area top) so the coloured
    // header extends up to the notch — no ugly white gap above.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  cancelText: { color: colors.primary, fontSize: 15, fontWeight: '600', minWidth: 60 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderRadius: 10,
    gap: 8,
  },
  searchIcon: {
    marginRight: 2,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  searchClear: {
    fontSize: 16,
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  emptySearchText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 32,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  scroll: { padding: 20, paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 8, fontStyle: 'italic' },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  pickerPlaceholder: { color: colors.textMuted, fontWeight: '400' },
  pickerChevron: { fontSize: 20, color: colors.textMuted },
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
  notesInput: { minHeight: 90, textAlignVertical: 'top' },
  stepperRow: { flexDirection: 'row', gap: 8 },
  stepperChoice: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  stepperChoiceActive: { borderColor: colors.primary, backgroundColor: colors.surfaceSelected },
  stepperText: { fontSize: 24, fontWeight: '800', color: colors.text },
  stepperTextActive: { color: colors.primary },
  stepperSubtext: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  stepperSubtextActive: { color: colors.primary, fontWeight: '600' },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  errorBanner: {
    backgroundColor: colors.danger + '15', // ~8% opacity tint
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  pickerSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  pickerSheetDone: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  actionBar: {
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  // Club modal
  clubOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  clubOptionActive: { borderColor: colors.primary, backgroundColor: colors.surfaceSelected },
  clubOptionName: { fontSize: 15, fontWeight: '600', color: colors.text },
  clubOptionCounty: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  clubOptionCheck: { fontSize: 22, color: colors.primary, fontWeight: '800' },
});
