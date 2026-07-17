import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Club {
  id: string;
  name: string;
  county: string | null;
}

interface Props {
  onCancel: () => void;
  onCreated: () => void;
}

export default function CreateRoundScreen({ onCancel, onCreated }: Props) {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubModal, setClubModal] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [scheduledFor, setScheduledFor] = useState<Date>(() => {
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

  async function submit() {
    if (!user) return;
    if (!selectedClub) {
      setError('Please pick a club.');
      return;
    }
    if (scheduledFor.getTime() < Date.now()) {
      setError('Please pick a future date and time.');
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Round</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
              <Text style={styles.pickerText}>📅 {dateLabel}</Text>
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
          <DateTimePicker
            value={scheduledFor}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, d) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (d) {
                const next = new Date(scheduledFor);
                next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                setScheduledFor(next);
              }
            }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={scheduledFor}
            mode="time"
            is24Hour
            onChange={(_, d) => {
              setShowTimePicker(Platform.OS === 'ios');
              if (d) {
                const next = new Date(scheduledFor);
                next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                setScheduledFor(next);
              }
            }}
          />
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

        {error && <Text style={styles.errorText}>⚠️ {error}</Text>}
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

      {/* Club selection modal */}
      <Modal visible={clubModal} animationType="slide" onRequestClose={() => setClubModal(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setClubModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Choose a Club</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {clubs.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.clubOption,
                  selectedClub?.id === c.id && styles.clubOptionActive,
                ]}
                onPress={() => {
                  setSelectedClub(c);
                  setClubModal(false);
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: { color: colors.primary, fontSize: 15, fontWeight: '600', width: 60 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
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
  stepperChoiceActive: { borderColor: colors.primary, backgroundColor: '#F0F7F2' },
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
  clubOptionActive: { borderColor: colors.primary, backgroundColor: '#F0F7F2' },
  clubOptionName: { fontSize: 15, fontWeight: '600', color: colors.text },
  clubOptionCounty: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  clubOptionCheck: { fontSize: 22, color: colors.primary, fontWeight: '800' },
});
