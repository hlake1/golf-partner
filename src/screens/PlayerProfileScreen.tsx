import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFriendshipState } from '../hooks/useFriends';

interface ProfileFull {
  id: string;
  full_name: string;
  photo_url: string | null;
  handicap: number | null;
  age: number | null;
  playing_style: 'competitive' | 'casual';
  up_for_drink_afterwards: boolean;
  occupation: string | null;
  clubs: { id: string; name: string }[];
}

interface Props {
  userId: string;
  onBack: () => void;
  onOpenChat?: (userId: string) => void;
}

export default function PlayerProfileScreen({ userId, onBack, onOpenChat }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const { state, loading: friendLoading, requestId, refresh } =
    useFriendshipState(userId);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          id, full_name, photo_url, handicap, age,
          playing_style, up_for_drink_afterwards, occupation,
          profile_clubs(club:clubs(id, name))
        `
        )
        .eq('id', userId)
        .maybeSingle();
      if (error || !data) {
        setLoading(false);
        return;
      }
      setProfile({
        id: (data as any).id,
        full_name: (data as any).full_name,
        photo_url: (data as any).photo_url,
        handicap: (data as any).handicap,
        age: (data as any).age,
        playing_style: (data as any).playing_style,
        up_for_drink_afterwards: (data as any).up_for_drink_afterwards,
        occupation: (data as any).occupation,
        clubs: ((data as any).profile_clubs ?? [])
          .map((pc: any) => pc.club)
          .filter(Boolean),
      });
      setLoading(false);
    })();
  }, [userId]);

  async function sendFriendRequest() {
    if (!user) return;
    setActionBusy(true);
    const { error } = await supabase.from('friend_requests').insert({
      requester_id: user.id,
      recipient_id: userId,
      status: 'pending',
    });
    setActionBusy(false);
    if (error) {
      Alert.alert('Could not send', error.message);
      return;
    }
    refresh();
  }

  async function cancelFriendRequest() {
    if (!requestId) return;
    setActionBusy(true);
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', requestId);
    setActionBusy(false);
    if (error) {
      Alert.alert('Could not cancel', error.message);
      return;
    }
    refresh();
  }

  async function acceptIncoming() {
    if (!requestId) return;
    setActionBusy(true);
    const { error } = await supabase.rpc('accept_friend_request', {
      request_id: requestId,
    });
    setActionBusy(false);
    if (error) {
      Alert.alert('Could not accept', error.message);
      return;
    }
    refresh();
  }

  async function unfriend() {
    if (!user || !profile) return;
    Alert.alert(`Unfriend ${profile.full_name}?`, 'You can add them back later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unfriend',
        style: 'destructive',
        onPress: async () => {
          setActionBusy(true);
          const min = user.id < userId ? user.id : userId;
          const max = user.id < userId ? userId : user.id;
          const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('user_a', min)
            .eq('user_b', max);
          setActionBusy(false);
          if (error) {
            Alert.alert('Could not unfriend', error.message);
            return;
          }
          refresh();
        },
      },
    ]);
  }

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Header onBack={onBack} title="Profile" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const initial = profile.full_name?.charAt(0)?.toUpperCase() ?? '?';
  const isMe = user?.id === profile.id;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Header onBack={onBack} title={profile.full_name} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarWrap}>
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <Text style={styles.name}>{profile.full_name}</Text>
          {profile.age !== null && (
            <Text style={styles.age}>Age {profile.age}</Text>
          )}
        </View>

        {/* Actions */}
        {!isMe && (
          <View style={styles.actionsRow}>
            {friendLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : state === 'friends' ? (
              <>
                <TouchableOpacity
                  style={[styles.primaryBtn, actionBusy && styles.btnDisabled]}
                  onPress={() => onOpenChat?.(profile.id)}
                  disabled={actionBusy}
                >
                  <Text style={styles.primaryBtnText}>💬 Message</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ghostBtn}
                  onPress={unfriend}
                  disabled={actionBusy}
                >
                  <Text style={styles.ghostBtnText}>Unfriend</Text>
                </TouchableOpacity>
              </>
            ) : state === 'pending_outgoing' ? (
              <>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>⏳ Request sent</Text>
                </View>
                <TouchableOpacity style={styles.ghostBtn} onPress={cancelFriendRequest}>
                  <Text style={styles.ghostBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : state === 'pending_incoming' ? (
              <TouchableOpacity
                style={[styles.primaryBtn, actionBusy && styles.btnDisabled]}
                onPress={acceptIncoming}
                disabled={actionBusy}
              >
                {actionBusy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>✅ Accept friend request</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, actionBusy && styles.btnDisabled]}
                onPress={sendFriendRequest}
                disabled={actionBusy}
              >
                {actionBusy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>➕ Add Friend</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard
            label="Handicap"
            value={profile.handicap !== null ? String(profile.handicap) : '—'}
          />
          <StatCard
            label="Style"
            value={profile.playing_style === 'competitive' ? '🏆' : '😌'}
          />
          <StatCard
            label="Drinks After"
            value={profile.up_for_drink_afterwards ? '✅' : '❌'}
          />
        </View>

        {profile.clubs.length > 0 && (
          <Section title="Club Memberships">
            <View style={styles.chipsRow}>
              {profile.clubs.map((c) => (
                <View key={c.id} style={styles.chip}>
                  <Text style={styles.chipText}>⛳ {c.name}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {profile.occupation && (
          <Section title="Occupation">
            <Text style={styles.body}>💼 {profile.occupation}</Text>
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backChevron}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 32 }} />
    </View>
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  content: { paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: colors.surface,
  },
  avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 12 },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: { fontSize: 54, fontWeight: '700', color: colors.white },
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  age: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  ghostBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ghostBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  badge: {
    flex: 1,
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  badgeText: { color: '#1E40AF', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: { paddingHorizontal: 20, marginTop: 20 },
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
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.white },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
