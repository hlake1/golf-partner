import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { text as textStyles, fonts } from '../theme/typography';
import { useClubDetail } from '../hooks/useClubDetail';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_HEIGHT = 260;

interface Props {
  clubId: string | null;
  onClose: () => void;
  onPostRound?: (clubId: string) => void;
  onApplyToManage?: (clubId: string) => void;
  onManageClub?: (clubId: string) => void;
}

/**
 * ClubProfileScreen
 *
 * Rich profile for a golf club. If the club is a Scramble Partner, we show
 * the partner-authored content (hero photo, description, gallery, contact).
 * Non-partner clubs get a lightweight fallback view + a "Are you the manager?"
 * CTA that opens the partner application flow.
 */
export default function ClubProfileScreen({
  clubId,
  onClose,
  onPostRound,
  onApplyToManage,
  onManageClub,
}: Props) {
  const { user } = useAuth();
  const { club, loading, error, refresh } = useClubDetail(clubId);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const visible = !!clubId;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Close bar */}
        <View style={styles.closeBar}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          {club?.is_scramble_partner && (
            <View style={styles.partnerBadgeSmall}>
              <Text style={styles.partnerBadgeSmallText}>✓ Scramble Partner</Text>
            </View>
          )}
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && club && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero image */}
            <View style={styles.hero}>
              {club.partner_hero_photo || club.photo_url ? (
                <Image
                  source={{
                    uri: (club.partner_hero_photo ?? club.photo_url) as string,
                  }}
                  style={styles.heroImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.heroImg, styles.heroPlaceholder]}>
                  <Text style={styles.heroPlaceholderText}>⛳</Text>
                </View>
              )}
              <View style={styles.heroOverlay} />
              <View style={styles.heroTitleWrap}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {club.name}
                </Text>
                {club.address && (
                  <Text style={styles.heroAddress} numberOfLines={2}>
                    📍 {club.address}
                  </Text>
                )}
              </View>
            </View>

            {/* Quick facts row */}
            {club.is_scramble_partner && (
              <View style={styles.factsRow}>
                {club.partner_holes != null && (
                  <Fact label="Holes" value={String(club.partner_holes)} />
                )}
                {club.partner_par != null && (
                  <Fact label="Par" value={String(club.partner_par)} />
                )}
                {club.rating != null && (
                  <Fact
                    label="Rating"
                    value={`${club.rating.toFixed(1)}${
                      club.rating_count ? ` (${club.rating_count})` : ''
                    }`}
                  />
                )}
              </View>
            )}

            {/* Description */}
            {club.is_scramble_partner && club.partner_description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About the club</Text>
                <Text style={styles.body}>{club.partner_description}</Text>
              </View>
            ) : !club.is_scramble_partner ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About the club</Text>
                <Text style={styles.body}>
                  This club hasn't set up a Scramble Partner profile yet.
                </Text>
                {onApplyToManage && user && (
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={() => onApplyToManage(club.id)}
                  >
                    <Text style={styles.applyBtnText}>
                      Are you the manager? Apply to manage →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* Photo gallery */}
            {club.is_scramble_partner && club.partner_photos.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Photos</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  pagingEnabled
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(
                      e.nativeEvent.contentOffset.x / (SCREEN_W - 32)
                    );
                    setGalleryIndex(idx);
                  }}
                  style={styles.gallery}
                >
                  {club.partner_photos.map((uri, i) => (
                    <Image
                      key={`${uri}-${i}`}
                      source={{ uri }}
                      style={styles.galleryImg}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
                {club.partner_photos.length > 1 && (
                  <View style={styles.dots}>
                    {club.partner_photos.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          i === galleryIndex && styles.dotActive,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Contact */}
            {(club.website || club.partner_phone || club.partner_email) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact</Text>
                {club.website && (
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(
                        club.website!.startsWith('http')
                          ? club.website!
                          : `https://${club.website}`
                      )
                    }
                    style={styles.contactRow}
                  >
                    <Text style={styles.contactIcon}>🌐</Text>
                    <Text style={styles.contactText} numberOfLines={1}>
                      {club.website}
                    </Text>
                  </TouchableOpacity>
                )}
                {club.partner_phone && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${club.partner_phone}`)}
                    style={styles.contactRow}
                  >
                    <Text style={styles.contactIcon}>📞</Text>
                    <Text style={styles.contactText}>{club.partner_phone}</Text>
                  </TouchableOpacity>
                )}
                {club.partner_email && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`mailto:${club.partner_email}`)}
                    style={styles.contactRow}
                  >
                    <Text style={styles.contactIcon}>✉️</Text>
                    <Text style={styles.contactText}>{club.partner_email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Manage this club (if the current user manages it) */}
            {user && club.partner_managed_by === user.id && onManageClub && (
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => onManageClub(club.id)}
              >
                <Text style={styles.manageBtnText}>⚙️ Manage this club</Text>
              </TouchableOpacity>
            )}

            {/* Post a round here CTA */}
            {onPostRound && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  onClose();
                  onPostRound(club.id);
                }}
              >
                <Text style={styles.primaryBtnText}>Post a round here</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factItem}>
      <Text style={styles.factValue}>{value}</Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  closeBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 22, 34, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  partnerBadgeSmall: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  partnerBadgeSmallText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  hero: { width: '100%', height: HERO_HEIGHT, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    backgroundColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderText: { fontSize: 72 },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 22, 34, 0.35)',
  },
  heroTitleWrap: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
  },
  heroTitle: {
    ...textStyles.display,
    color: colors.white,
    fontSize: 28,
    letterSpacing: -0.4,
  },
  heroAddress: {
    ...textStyles.body,
    color: colors.white,
    marginTop: 4,
    opacity: 0.95,
  },
  factsRow: {
    flexDirection: 'row',
    marginTop: -20,
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  factItem: { flex: 1, alignItems: 'center' },
  factValue: {
    ...textStyles.h2,
    color: colors.primary,
  },
  factLabel: {
    ...textStyles.micro,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    ...textStyles.h3,
    color: colors.primary,
    marginBottom: 8,
  },
  body: {
    ...textStyles.body,
    color: colors.textSecondary,
  },
  gallery: {
    marginTop: 8,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  galleryImg: {
    width: SCREEN_W - 40,
    height: 200,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: colors.mist,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginHorizontal: 3,
  },
  dotActive: { backgroundColor: colors.primary },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  contactIcon: { fontSize: 18, marginRight: 10 },
  contactText: { ...textStyles.body, color: colors.primary, flex: 1 },
  applyBtn: {
    marginTop: 14,
    padding: 14,
    backgroundColor: colors.mist,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyBtnText: {
    ...textStyles.bodyStrong,
    color: colors.primary,
  },
  manageBtn: {
    marginTop: 20,
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  manageBtnText: {
    ...textStyles.bodyStrong,
    color: colors.primary,
  },
  primaryBtn: {
    marginTop: 16,
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    ...textStyles.bodyStrong,
    color: colors.white,
    fontSize: 16,
  },
  errorText: {
    ...textStyles.body,
    color: colors.danger,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryBtnText: { ...textStyles.bodyStrong, color: colors.white },
});
