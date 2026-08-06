import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { text as textStyles, fonts } from '../theme/typography';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useClubDetail } from '../hooks/useClubDetail';

interface Props {
  clubId: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

const BUCKET = 'club-photos';

/**
 * ClubManageScreen
 *
 * Editable form for approved club managers to update their club's
 * partner-facing content: description, holes/par, phone/email, and
 * uploaded photos (with a designated hero shot).
 */
export default function ClubManageScreen({ clubId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { club, loading, refresh } = useClubDetail(clubId);

  const [description, setDescription] = useState('');
  const [holes, setHoles] = useState('');
  const [par, setPar] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [heroPhoto, setHeroPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const visible = !!clubId;

  useEffect(() => {
    if (!club) return;
    setDescription(club.partner_description ?? '');
    setHoles(club.partner_holes != null ? String(club.partner_holes) : '');
    setPar(club.partner_par != null ? String(club.partner_par) : '');
    setPhone(club.partner_phone ?? '');
    setEmail(club.partner_email ?? '');
    setPhotos(club.partner_photos ?? []);
    setHeroPhoto(club.partner_hero_photo ?? null);
  }, [club?.id]);

  const canEdit = !!user && club?.partner_managed_by === user.id;

  const pickAndUpload = async () => {
    if (!clubId || !canEdit) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add club photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const resp = await fetch(asset.uri);
      const arrayBuffer = await resp.arrayBuffer();
      const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${clubId}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, arrayBuffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: false,
        });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = data.publicUrl;
      setPhotos((prev) => [...prev, publicUrl]);
      if (!heroPhoto) setHeroPhoto(publicUrl);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (uri: string) => {
    Alert.alert('Remove photo?', 'This photo will be removed from the profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setPhotos((prev) => prev.filter((p) => p !== uri));
          if (heroPhoto === uri) setHeroPhoto(null);
        },
      },
    ]);
  };

  const save = async () => {
    if (!clubId || !canEdit) return;

    const holesNum = holes.trim() ? Number(holes) : null;
    const parNum = par.trim() ? Number(par) : null;

    if (holesNum != null && (!Number.isFinite(holesNum) || holesNum < 1 || holesNum > 36)) {
      Alert.alert('Invalid holes', 'Enter a number between 1 and 36.');
      return;
    }
    if (parNum != null && (!Number.isFinite(parNum) || parNum < 30 || parNum > 90)) {
      Alert.alert('Invalid par', 'Enter a number between 30 and 90.');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('clubs')
      .update({
        partner_description: description.trim() || null,
        partner_holes: holesNum,
        partner_par: parNum,
        partner_phone: phone.trim() || null,
        partner_email: email.trim() || null,
        partner_photos: photos,
        partner_hero_photo: heroPhoto,
      })
      .eq('id', clubId);
    setSaving(false);

    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    await refresh();
    onSaved?.();
    Alert.alert('Saved', 'Your club profile has been updated.');
  };

  return (
    <Modal
      animationType="slide"
      visible={visible}
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.cancelText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Manage Club</Text>
          <TouchableOpacity onPress={save} disabled={saving || !canEdit} hitSlop={12}>
            <Text
              style={[
                styles.saveText,
                (saving || !canEdit) && { opacity: 0.5 },
              ]}
            >
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!loading && !canEdit && (
          <View style={styles.center}>
            <Text style={styles.errorText}>
              You don't have permission to manage this club.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onClose}>
              <Text style={styles.retryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && canEdit && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.clubName}>{club?.name}</Text>
              <Text style={styles.clubMeta}>
                {club?.is_scramble_partner ? '✓ Scramble Partner' : 'Not yet active'}
              </Text>

              <SectionHeader>Photos</SectionHeader>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photoStrip}
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {photos.map((uri) => (
                  <View key={uri} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <TouchableOpacity
                      style={[
                        styles.heroToggle,
                        heroPhoto === uri && styles.heroToggleActive,
                      ]}
                      onPress={() => setHeroPhoto(uri)}
                    >
                      <Text
                        style={[
                          styles.heroToggleText,
                          heroPhoto === uri && styles.heroToggleTextActive,
                        ]}
                      >
                        {heroPhoto === uri ? '★ Hero' : 'Set hero'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removePhoto(uri)}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addPhotoBtn}
                  onPress={pickAndUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Text style={styles.addPhotoPlus}>+</Text>
                      <Text style={styles.addPhotoLabel}>Add photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>

              <SectionHeader>Description</SectionHeader>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Tell golfers about your club — history, character, what makes it special."
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.textarea]}
                multiline
                textAlignVertical="top"
              />

              <SectionHeader>Course info</SectionHeader>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Holes</Text>
                  <TextInput
                    value={holes}
                    onChangeText={setHoles}
                    placeholder="18"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.label}>Par</Text>
                  <TextInput
                    value={par}
                    onChangeText={setPar}
                    placeholder="72"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <SectionHeader>Contact</SectionHeader>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+44…"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                keyboardType="phone-pad"
              />

              <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="info@yourclub.com"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={{ height: 32 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  cancelText: { ...textStyles.bodyStrong, color: colors.primary },
  saveText: { ...textStyles.bodyStrong, color: colors.primary },
  title: { ...textStyles.h3, color: colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  center: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubName: { ...textStyles.h1, color: colors.primary },
  clubMeta: {
    ...textStyles.caption,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 20,
  },
  sectionHeader: {
    ...textStyles.h3,
    color: colors.primary,
    marginTop: 20,
    marginBottom: 10,
  },
  label: {
    ...textStyles.caption,
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  textarea: { minHeight: 120 },
  row: { flexDirection: 'row' },
  photoStrip: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  photoWrap: {
    marginRight: 10,
    position: 'relative',
  },
  photoThumb: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.mist,
  },
  heroToggle: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(15, 22, 34, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroToggleActive: { backgroundColor: colors.accent },
  heroToggleText: {
    ...textStyles.micro,
    color: colors.white,
    fontSize: 10,
  },
  heroToggleTextActive: { color: colors.primary },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  addPhotoBtn: {
    width: 140,
    height: 140,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoPlus: {
    fontSize: 32,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  addPhotoLabel: {
    ...textStyles.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  errorText: { ...textStyles.body, color: colors.danger, textAlign: 'center' },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryBtnText: { ...textStyles.bodyStrong, color: colors.white },
});
