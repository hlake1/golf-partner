import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { colors } from '../theme/colors';
import { useMyRounds, type MyRound } from '../hooks/useMyRounds';
import RoundDetailScreen from './RoundDetailScreen';

interface Props {
  /**
   * Optional callback fired when the user hits "Post a round for this day"
   * in the empty state. Receives an ISO date string (YYYY-MM-DD).
   */
  onPostRoundForDate?: (localDate: string) => void;
}

/**
 * "My Schedule" — RotaReady-style calendar of the user's rounds.
 * - Month grid at top with dots on days that have rounds
 * - Green dot = hosting; Amber dot = accepted (playing)
 * - Tap a day to filter the agenda list below
 * - Tap a round row to open full detail
 */
export default function MyScheduleScreen({ onPostRoundForDate }: Props = {}) {
  const { rounds, loading, refresh } = useMyRounds();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [openRound, setOpenRound] = useState<MyRound | null>(null);

  // Compute markedDates: highlight WHOLE day for hosting / playing rounds.
  // Uses markingType="custom" so we can render a full circular background
  // behind the date number instead of a tiny dot underneath.
  const markedDates = useMemo(() => {
    // Track roles per day so we can pick the fill colour if both apply.
    const rolesByDate: Record<string, Set<'host' | 'player'>> = {};
    for (const r of rounds) {
      const day = r.local_date;
      const role = (r.role === 'host' ? 'host' : 'player') as 'host' | 'player';
      if (!rolesByDate[day]) rolesByDate[day] = new Set();
      rolesByDate[day].add(role);
    }

    const marks: Record<string, any> = {};
    for (const [day, roles] of Object.entries(rolesByDate)) {
      const isHost = roles.has('host');
      const isPlayer = roles.has('player');
      // Both host + player on same day → blend/prioritise host (you’re running it).
      const fill = isHost ? colors.primary : colors.accent;
      const textColor = colors.white;
      marks[day] = {
        customStyles: {
          container: {
            backgroundColor: fill,
            borderRadius: 18,
          },
          text: {
            color: textColor,
            fontWeight: '700',
          },
        },
      };
      // If both roles, add a small accent border on the ring so you can tell.
      if (isHost && isPlayer) {
        marks[day].customStyles.container = {
          ...marks[day].customStyles.container,
          borderWidth: 2,
          borderColor: colors.accent,
        };
      }
    }

    // Overlay the currently selected date so tapping still gives feedback.
    if (selectedDate) {
      const existing = marks[selectedDate] ?? { customStyles: {} };
      marks[selectedDate] = {
        ...existing,
        customStyles: {
          container: {
            ...(existing.customStyles?.container ?? {}),
            backgroundColor:
              existing.customStyles?.container?.backgroundColor ?? colors.primary,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: colors.text,
          },
          text: {
            color: colors.white,
            fontWeight: '800',
          },
        },
      };
    }

    return marks;
  }, [rounds, selectedDate]);

  // Rounds to show in the agenda list
  const visibleRounds = useMemo(() => {
    if (selectedDate) {
      return rounds.filter((r) => r.local_date === selectedDate);
    }
    return rounds; // show all upcoming
  }, [rounds, selectedDate]);

  // Round detail full-screen push
  if (openRound) {
    return <RoundDetailScreen round={openRound} onBack={() => setOpenRound(null)} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>My Schedule</Text>
          <Text style={styles.subtitle}>Your upcoming rounds at a glance</Text>
        </View>

        <View style={styles.calendarWrap}>
          <Calendar
            markingType="custom"
            markedDates={markedDates}
            firstDay={1} // Monday start (UK)
            onDayPress={(d: DateData) => {
              // Toggle: tapping same date again clears the filter
              setSelectedDate((cur) => (cur === d.dateString ? null : d.dateString));
            }}
            theme={{
              backgroundColor: colors.surface,
              calendarBackground: colors.surface,
              textSectionTitleColor: colors.textSecondary,
              dayTextColor: colors.text,
              todayTextColor: colors.primary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: colors.white,
              monthTextColor: colors.text,
              textMonthFontWeight: '800',
              textMonthFontSize: 18,
              textDayFontWeight: '600',
              textDayHeaderFontWeight: '700',
              textDayHeaderFontSize: 12,
              arrowColor: colors.primary,
            }}
          />
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendPill, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Hosting</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendPill, { backgroundColor: colors.accent }]} />
            <Text style={styles.legendText}>Playing</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendPill,
                {
                  backgroundColor: colors.primary,
                  borderWidth: 2,
                  borderColor: colors.accent,
                },
              ]}
            />
            <Text style={styles.legendText}>Both</Text>
          </View>
        </View>

        {/* Agenda list */}
        <View style={styles.agendaHeader}>
          <Text style={styles.agendaTitle}>
            {selectedDate
              ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : 'All upcoming'}
          </Text>
          {selectedDate && (
            <TouchableOpacity onPress={() => setSelectedDate(null)}>
              <Text style={styles.clearLink}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading && rounds.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : visibleRounds.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⛳</Text>
            <Text style={styles.emptyTitle}>
              {selectedDate ? 'Nothing on this day' : 'No upcoming rounds'}
            </Text>
            <Text style={styles.emptyText}>
              {selectedDate
                ? 'Try another day, or post a round for this one.'
                : 'Post a round or join one from Discover to see it here.'}
            </Text>
            {selectedDate && onPostRoundForDate && (
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => onPostRoundForDate(selectedDate)}
              >
                <Text style={styles.emptyCtaText}>+ Post a round</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          visibleRounds.map((round) => (
            <AgendaRow
              key={`${round.role}-${round.id}`}
              round={round}
              onPress={() => setOpenRound(round)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AgendaRow({ round, onPress }: { round: MyRound; onPress: () => void }) {
  const date = new Date(round.scheduled_for);
  const dayShort = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const dayNum = date.getDate();
  const timeText = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity style={styles.agendaRow} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.agendaDateBlock}>
        <Text style={styles.agendaDayShort}>{dayShort}</Text>
        <Text style={styles.agendaDayNum}>{dayNum}</Text>
      </View>

      <View style={styles.agendaBody}>
        <Text style={styles.agendaTime}>{timeText}</Text>
        <Text style={styles.agendaClub} numberOfLines={1}>
          ⛳ {round.club?.name ?? 'Round'}
        </Text>
        <View style={styles.agendaRoleTag}>
          <View
            style={[
              styles.agendaRoleDot,
              {
                backgroundColor:
                  round.role === 'host' ? colors.primary : colors.accent,
              },
            ]}
          />
          <Text style={styles.agendaRoleText}>
            {round.role === 'host' ? 'Hosting' : 'Playing'}
            {' · '}
            {round.status === 'full' ? 'Full' : `${round.accepted_players.length + 1}/${round.players_needed + 1} spots`}
          </Text>
        </View>
      </View>

      <Text style={styles.agendaChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 40 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  calendarWrap: {
    backgroundColor: colors.surface,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 16,
    padding: 4,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  legend: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendPill: { width: 18, height: 18, borderRadius: 9 },
  legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  agendaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  agendaTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  clearLink: { fontSize: 13, fontWeight: '600', color: colors.primary },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCtaText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    gap: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  agendaDateBlock: {
    width: 52,
    alignItems: 'center',
  },
  agendaDayShort: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  agendaDayNum: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  agendaBody: { flex: 1 },
  agendaTime: { fontSize: 16, fontWeight: '800', color: colors.text },
  agendaClub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  agendaRoleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  agendaRoleDot: { width: 6, height: 6, borderRadius: 3 },
  agendaRoleText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  agendaChevron: { fontSize: 24, color: colors.textMuted, fontWeight: '300' },
});
