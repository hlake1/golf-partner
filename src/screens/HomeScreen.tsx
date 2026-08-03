import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path,
  Circle,
  Rect,
  Line,
  Polyline,
  Polygon,
  G,
} from 'react-native-svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useNearbyPlayers, type NearbyPlayer } from '../hooks/useNearbyPlayers';
import { useProfile } from '../hooks/useProfile';
import { useMyRounds, type MyRound } from '../hooks/useMyRounds';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ScrambleMark from '../components/ScrambleMark';
import PlayerProfileScreen from './PlayerProfileScreen';

// ---------- Constants ----------
const HERO_COURSE_IMAGE =
  'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=1200&q=80&auto=format&fit=crop';
const BANNER_COURSE_IMAGE =
  'https://images.unsplash.com/photo-1587381420270-3e1a5b9e6904?w=1200&q=80&auto=format&fit=crop';

const RADIUS_OPTIONS = [5, 10, 25, 50];

// ---------- Helpers ----------
function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstNameOf(fullName: string | undefined | null): string | null {
  if (!fullName) return null;
  return fullName.trim().split(/\s+/)[0] || null;
}

function formatRoundDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
  });
}

function formatRoundTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

interface Club {
  id: string;
  name: string;
}

// ---------- Icons (SVG so they scale + tint cleanly) ----------
function IconCalendar({ size = 16, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="2" />
      <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth="2" />
      <Line x1="8" y1="3" x2="8" y2="7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="16" y1="3" x2="16" y2="7" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function IconPin({ size = 16, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10" r="2.5" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

function IconTrendUp({ size = 18, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="3 17 9 11 13 15 21 7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="15 7 21 7 21 13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconFlag({ size = 18, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="6" y1="21" x2="6" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path
        d="M6 4h11l-2.5 4L17 12H6"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconUsers({ size = 22, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3.5" stroke={color} strokeWidth="2" />
      <Path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="17" cy="9" r="2.5" stroke={color} strokeWidth="2" />
      <Path d="M15 15.5c3 .3 5.5 2 5.5 5.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function IconTrophy({ size = 22, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4h10v4a5 5 0 01-10 0V4z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Path d="M17 5h3v3a3 3 0 01-3 3" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M7 5H4v3a3 3 0 003 3" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="13" x2="12" y2="17" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M8 20h8" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M9 20l1-3h4l1 3" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </Svg>
  );
}

function IconCalendarSquare({ size = 22, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="3" stroke={color} strokeWidth="2" />
      <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth="2" />
      <Line x1="8" y1="3" x2="8" y2="7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="16" y1="3" x2="16" y2="7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M8 14l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconMapPin({ size = 22, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10" r="2.5" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

function IconChevron({ size = 16, color = colors.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="9 6 15 12 9 18"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconBell({ size = 22, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 8a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Path d="M10 19a2 2 0 004 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// ---------- HomeScreen ----------
export default function HomeScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const firstName = firstNameOf(profile?.full_name);
  const greeting = greetingForNow();

  const [radiusMiles, setRadiusMiles] = useState(10);
  const [clubFilter, setClubFilter] = useState<Club | null>(null);
  const [clubModalOpen, setClubModalOpen] = useState(false);
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);

  const { players, loading, error, refresh } = useNearbyPlayers({
    radiusMiles,
    clubFilter: clubFilter?.id ?? null,
  });

  const { rounds: myRounds, loading: roundsLoading } = useMyRounds();

  // Next upcoming round (earliest scheduled_for)
  const nextRound: MyRound | null = useMemo(() => {
    if (!myRounds || myRounds.length === 0) return null;
    return [...myRounds].sort((a, b) =>
      a.scheduled_for.localeCompare(b.scheduled_for)
    )[0];
  }, [myRounds]);

  if (openProfileId) {
    return (
      <PlayerProfileScreen
        userId={openProfileId}
        onBack={() => setOpenProfileId(null)}
      />
    );
  }

  // Load clubs for the filter modal (once)
  useEffect(() => {
    supabase
      .from('clubs')
      .select('id, name')
      .order('name')
      .then(({ data }) => setAllClubs(data ?? []));
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading || roundsLoading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Header row (logo + notifications icon rendered by navigator) ===== */}
        <View style={styles.headerRow}>
          <ScrambleMark size={38} />
        </View>

        {/* ===== Greeting ===== */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>
            {greeting}{firstName ? `, ${firstName}` : ''}
          </Text>
          <Text style={styles.subGreeting}>Ready to play?</Text>
        </View>

        {/* ===== Next Round hero card ===== */}
        <NextRoundCard round={nextRound} loading={roundsLoading} />

        {/* ===== YOUR GAME ===== */}
        <Text style={styles.sectionLabel}>YOUR GAME</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.cardShadow]}>
            <View style={styles.statIconWrap}>
              <IconTrendUp size={20} color={colors.primary} />
            </View>
            <Text style={styles.statCaption}>Handicap Index</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>
                {profile?.handicap != null ? profile.handicap : '—'}
              </Text>
            </View>
            <Text style={styles.statSubcaption}>18 Hole Index</Text>
          </View>

          <View style={[styles.statCard, styles.cardShadow]}>
            <View style={styles.statIconWrap}>
              <IconFlag size={18} color={colors.primary} />
            </View>
            <Text style={styles.statCaption}>Recent Activity</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.recentActivityText}>
                {nextRound ? 'Upcoming Round' : 'No rounds yet'}
              </Text>
              <IconChevron size={14} color={colors.textMuted} />
            </View>
            <Text style={styles.statSubcaption}>
              {nextRound
                ? `${formatRoundDate(nextRound.scheduled_for)} • ${formatRoundTime(nextRound.scheduled_for)}`
                : 'Post your first round'}
            </Text>
          </View>
        </View>

        {/* ===== QUICK ACTIONS ===== */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          <QuickAction icon={<IconUsers />} label="Play Together" onPress={() => { /* scroll to players list */ }} />
          <QuickAction icon={<IconCalendarSquare />} label="Track & Improve" onPress={() => {}} />
          <QuickAction icon={<IconTrophy />} label="Compete" onPress={() => {}} />
          <QuickAction icon={<IconMapPin />} label="Explore Courses" onPress={() => {}} />
        </View>

        {/* ===== Brand banner ===== */}
        <BrandBanner />

        {/* ===== Players nearby (existing feature, kept as secondary section) ===== */}
        <View style={styles.playersHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.playersTitle}>Players Near You</Text>
            <Text style={styles.playersSubtitle}>Tap a card to invite someone</Text>
          </View>
        </View>

        {/* Radius filter */}
        <View style={styles.filterSection}>
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

        <View style={styles.filterSection}>
          <View style={styles.clubFilterRow}>
            <TouchableOpacity
              style={[styles.clubFilterChip, !clubFilter && styles.filterChipActive]}
              onPress={() => setClubFilter(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !clubFilter && styles.filterChipTextActive,
                ]}
              >
                All clubs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clubFilterChip, clubFilter && styles.filterChipActive]}
              onPress={() => setClubModalOpen(true)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  clubFilter && styles.filterChipTextActive,
                ]}
                numberOfLines={1}
              >
                {clubFilter ? `⛳ ${clubFilter.name}` : 'Filter by club'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Player results */}
        {error ? (
          <View style={styles.errorState}>
            <Text style={styles.errorEmoji}>😕</Text>
            <Text style={styles.errorTitle}>Couldn't load players</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : loading && players.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : players.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⛳</Text>
            <Text style={styles.emptyTitle}>No players nearby</Text>
            <Text style={styles.emptyText}>
              {clubFilter
                ? `No golfers at ${clubFilter.name} within ${radiusMiles} miles.`
                : `Try widening your search radius, or check back later.`}
            </Text>
          </View>
        ) : (
          <View style={styles.playerList}>
            {players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onOpenProfile={() => setOpenProfileId(player.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Club filter modal */}
      <Modal
        visible={clubModalOpen}
        animationType="slide"
        onRequestClose={() => setClubModalOpen(false)}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setClubModalOpen(false)}>
              <Text style={styles.modalCancel} numberOfLines={1}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filter by Club</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <TouchableOpacity
              style={styles.clubOption}
              onPress={() => {
                setClubFilter(null);
                setClubModalOpen(false);
              }}
            >
              <Text style={styles.clubOptionName}>All clubs</Text>
              {!clubFilter && <Text style={styles.clubOptionCheck}>✓</Text>}
            </TouchableOpacity>
            {allClubs.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.clubOption,
                  clubFilter?.id === c.id && styles.clubOptionActive,
                ]}
                onPress={() => {
                  setClubFilter(c);
                  setClubModalOpen(false);
                }}
              >
                <Text style={styles.clubOptionName}>⛳ {c.name}</Text>
                {clubFilter?.id === c.id && (
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

// ---------- Next Round hero card ----------
function NextRoundCard({ round, loading }: { round: MyRound | null; loading: boolean }) {
  if (loading) {
    return (
      <View style={[styles.heroCard, styles.cardShadow, { alignItems: 'center', justifyContent: 'center', height: 200 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!round) {
    // Empty state hero card — invite user to post one
    return (
      <ImageBackground
        source={{ uri: HERO_COURSE_IMAGE }}
        style={[styles.heroCard, styles.cardShadow]}
        imageStyle={styles.heroImage}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroGradient}
        />
        <View style={styles.heroContent}>
          <Text style={styles.heroLabel}>NEXT ROUND</Text>
          <Text style={styles.heroTitle}>Post your first round</Text>
          <View style={styles.heroMetaRow}>
            <IconCalendar size={14} />
            <Text style={styles.heroMetaText}>Head to the Calendar tab</Text>
          </View>
          <View style={styles.heroMetaRow}>
            <IconPin size={14} />
            <Text style={styles.heroMetaText}>Choose your club</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }

  // Accepted players + host = attending list
  const attendingCount =
    (round.accepted_players?.length ?? 0) + (round.host ? 1 : 0);
  const capacity = attendingCount + (round.players_needed ?? 0);

  return (
    <ImageBackground
      source={{ uri: HERO_COURSE_IMAGE }}
      style={[styles.heroCard, styles.cardShadow]}
      imageStyle={styles.heroImage}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.82)', 'rgba(255,255,255,0.0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.heroGradient}
      />

      <View style={styles.heroContent}>
        <Text style={styles.heroLabel}>NEXT ROUND</Text>
        <Text style={styles.heroTitle} numberOfLines={1}>
          {round.club?.name ?? 'Round'}
        </Text>

        <View style={styles.heroMetaRow}>
          <IconCalendar size={14} />
          <Text style={styles.heroMetaText}>
            {formatRoundDate(round.scheduled_for)} • {formatRoundTime(round.scheduled_for)}
          </Text>
        </View>
        <View style={styles.heroMetaRow}>
          <IconPin size={14} />
          <Text style={styles.heroMetaText} numberOfLines={1}>
            {round.club?.name ?? 'Location TBD'}
          </Text>
        </View>
      </View>

      {/* Bottom row: avatars + capacity pill */}
      <View style={styles.heroBottomRow}>
        <View style={styles.avatarStack}>
          {round.host && (
            <MiniAvatar
              key={round.host.id}
              url={round.host.photo_url}
              name={round.host.full_name}
              index={0}
            />
          )}
          {round.accepted_players?.slice(0, 3).map((p, i) => (
            <MiniAvatar
              key={p.id}
              url={p.photo_url}
              name={p.full_name}
              index={i + 1}
            />
          ))}
        </View>

        <View style={styles.capacityPill}>
          <Text style={styles.capacityBig}>
            {attendingCount}/{capacity}
          </Text>
          <Text style={styles.capacitySmall}>PLAYERS</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

function MiniAvatar({
  url,
  name,
  index,
}: {
  url: string | null;
  name: string;
  index: number;
}) {
  const initial = name?.charAt(0)?.toUpperCase() ?? '?';
  return (
    <View style={[styles.miniAvatarWrap, { marginLeft: index === 0 ? 0 : -10 }]}>
      {url ? (
        <Image source={{ uri: url }} style={styles.miniAvatar} />
      ) : (
        <View style={[styles.miniAvatar, styles.miniAvatarPlaceholder]}>
          <Text style={styles.miniAvatarInitial}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

// ---------- Quick Action tile ----------
function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, styles.cardShadowSoft]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.actionIconWrap}>{icon}</View>
      <Text style={styles.actionLabel} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------- Brand banner (dark navy + course image) ----------
function BrandBanner() {
  return (
    <View style={[styles.brandBanner, styles.cardShadow]}>
      <ImageBackground
        source={{ uri: BANNER_COURSE_IMAGE }}
        style={styles.brandBannerBg}
        imageStyle={styles.brandBannerImage}
      >
        {/* Dark navy blob on left side */}
        <LinearGradient
          colors={[colors.primary, colors.primary, 'rgba(15,22,34,0.85)', 'rgba(15,22,34,0.0)']}
          locations={[0, 0.4, 0.65, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.brandBannerGradient}
        />
        <View style={styles.brandBannerContent}>
          <Text style={styles.brandBannerTitle}>Better rounds.</Text>
          <Text style={styles.brandBannerTitle}>Better friends.</Text>
          <Text style={[styles.brandBannerTitle, { color: colors.mist }]}>Better game.</Text>
          <View style={styles.brandBannerDivider} />
          <Text style={styles.brandBannerSubtitle}>Organize. Track. Improve.</Text>
          <Text style={styles.brandBannerSubtitle}>All in one app.</Text>
        </View>
      </ImageBackground>
    </View>
  );
}

// ---------- Player card (existing feature, unchanged behavior) ----------
function PlayerCard({
  player,
  onOpenProfile,
}: {
  player: NearbyPlayer;
  onOpenProfile: () => void;
}) {
  const { user } = useAuth();
  const [inviting, setInviting] = useState(false);

  async function handleInvite() {
    if (!user) return;
    setInviting(true);

    const nowIso = new Date().toISOString();
    const { data: myRounds, error: err } = await supabase
      .from('rounds')
      .select('id, scheduled_for, players_needed, notes, club:clubs(name)')
      .eq('host_id', user.id)
      .eq('status', 'open')
      .gte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true });

    setInviting(false);

    if (err) {
      Alert.alert('Error', err.message);
      return;
    }

    if (!myRounds || myRounds.length === 0) {
      Alert.alert(
        'No open rounds',
        `Post a round in the Calendar tab first, then invite ${player.full_name} to it.`
      );
      return;
    }

    Alert.alert(
      `Invite ${player.full_name}`,
      'Which round?',
      [
        ...myRounds.map((r: any) => ({
          text: `${new Date(r.scheduled_for).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })} · ${r.club?.name ?? 'Round'}`,
          onPress: () => sendInvite(r.id, player),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
      { cancelable: true }
    );
  }

  async function sendInvite(roundId: string, player: NearbyPlayer) {
    const { error } = await supabase.from('notifications').insert({
      user_id: player.id,
      type: 'join_request',
      title: `You've been invited to a round`,
      body: `Check the Calendar tab to see the invitation.`,
      data: { round_id: roundId, from_user_id: user?.id },
    });

    if (error) {
      Alert.alert('Failed to invite', error.message);
      return;
    }
    Alert.alert('Invitation sent!', `${player.full_name} will see the invite in their notifications.`);
  }

  const styleTag = player.playing_style === 'competitive' ? '🏆 Competitive' : '😌 Casual';
  const initial = player.full_name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <TouchableOpacity style={[styles.card, styles.cardShadowSoft]} activeOpacity={0.7} onPress={onOpenProfile}>
      <View style={styles.avatarWrap}>
        {player.photo_url ? (
          <Image source={{ uri: player.photo_url }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.playerName}>{player.full_name}</Text>
          <Text style={styles.distance}>{player.distance_miles} mi</Text>
        </View>

        <Text style={styles.playerMeta}>
          {player.age !== null && `Age ${player.age} · `}
          {player.handicap !== null && `HCP ${player.handicap}`}
        </Text>

        {player.clubs.length > 0 && (
          <Text style={styles.playerClubs} numberOfLines={1}>
            ⛳ {player.clubs.map((c) => c.name).join(', ')}
          </Text>
        )}

        {player.occupation && (
          <Text style={styles.playerOccupation}>💼 {player.occupation}</Text>
        )}

        <View style={styles.tagRow}>
          <View
            style={[
              styles.tag,
              player.playing_style === 'competitive'
                ? styles.tagCompetitive
                : styles.tagCasual,
            ]}
          >
            <Text style={styles.tagText}>{styleTag}</Text>
          </View>
          {player.up_for_drink_afterwards && (
            <View style={[styles.tag, styles.tagDrink]}>
              <Text style={styles.tagText}>🍺 Drinks after</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.joinButton, inviting && styles.joinButtonDisabled]}
          onPress={handleInvite}
          disabled={inviting}
        >
          {inviting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.joinButtonText}>⛳ Invite to a Round</Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 32 },

  // Reusable shadow presets — gives the 3D depth
  cardShadow: {
    shadowColor: '#0F1622',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  cardShadowSoft: {
    shadowColor: '#0F1622',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  // Header
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Greeting
  greetingBlock: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 20,
  },
  greeting: {
    fontFamily: fonts.extrabold,
    fontSize: 30,
    color: colors.primary,
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  subGreeting: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ocean,
    marginTop: 4,
    letterSpacing: -0.2,
  },

  // Hero card (Next Round)
  heroCard: {
    marginHorizontal: 20,
    height: 220,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.mist,
    marginBottom: 24,
  },
  heroImage: {
    borderRadius: 22,
    resizeMode: 'cover',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  heroContent: {
    padding: 20,
    flex: 1,
  },
  heroLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    color: colors.primary,
    letterSpacing: -0.5,
    marginBottom: 12,
    maxWidth: '75%',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  heroMetaText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  heroBottomRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.white,
    overflow: 'hidden',
    backgroundColor: colors.mist,
  },
  miniAvatar: { width: '100%', height: '100%' },
  miniAvatarPlaceholder: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarInitial: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  capacityPill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: '#0F1622',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  capacityBig: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    color: colors.primary,
    letterSpacing: -0.2,
  },
  capacitySmall: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: -1,
  },

  // Section labels
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginLeft: 20,
    marginBottom: 10,
  },

  // Stats row (Your Game)
  statsRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    minHeight: 108,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statCaption: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    color: colors.primary,
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  recentActivityText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primary,
    letterSpacing: -0.2,
    flex: 1,
  },
  statSubcaption: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },

  // Quick actions
  actionsRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 88,
    justifyContent: 'center',
  },
  actionIconWrap: {
    marginBottom: 8,
  },
  actionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 14,
  },

  // Brand banner
  brandBanner: {
    marginHorizontal: 20,
    height: 170,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    marginBottom: 28,
  },
  brandBannerBg: {
    flex: 1,
  },
  brandBannerImage: {
    borderRadius: 22,
    resizeMode: 'cover',
  },
  brandBannerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  brandBannerContent: {
    padding: 22,
    flex: 1,
    justifyContent: 'center',
    maxWidth: '60%',
  },
  brandBannerTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    color: colors.white,
    letterSpacing: -0.4,
    lineHeight: 25,
  },
  brandBannerDivider: {
    width: 32,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
    marginVertical: 10,
    borderRadius: 1,
  },
  brandBannerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 17,
  },

  // Players nearby (secondary)
  playersHeader: {
    paddingHorizontal: 20,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  playersTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.primary,
    letterSpacing: -0.3,
  },
  playersSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  filterSection: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
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
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  filterChipTextActive: { color: colors.white },
  clubFilterRow: { flexDirection: 'row', gap: 8 },
  clubFilterChip: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },

  emptyState: { alignItems: 'center', padding: 40, marginTop: 12 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginBottom: 4 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  errorState: { alignItems: 'center', padding: 40, marginTop: 12 },
  errorEmoji: { fontSize: 56, marginBottom: 12 },
  errorTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginBottom: 4 },
  errorText: { fontFamily: fonts.regular, fontSize: 12, color: colors.danger, textAlign: 'center', marginBottom: 16 },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: colors.white, fontFamily: fonts.bold },

  playerList: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
  },
  avatarWrap: { width: 60 },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  avatarInitial: { fontFamily: fonts.bold, fontSize: 24, color: colors.white },
  cardBody: { flex: 1 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  playerName: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, flex: 1 },
  distance: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  playerMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  playerClubs: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  playerOccupation: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagCompetitive: { backgroundColor: '#FEF3C7' },
  tagCasual: { backgroundColor: '#D1FAE5' },
  tagDrink: { backgroundColor: '#FEE2E2' },
  tagText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text },
  joinButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  joinButtonDisabled: { opacity: 0.6 },
  joinButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },

  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalCancel: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 15, minWidth: 60 },
  modalTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  clubOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  clubOptionActive: { borderColor: colors.primary, backgroundColor: colors.surfaceSelected },
  clubOptionName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, flex: 1 },
  clubOptionCheck: { fontFamily: fonts.bold, fontSize: 22, color: colors.primary },
});
