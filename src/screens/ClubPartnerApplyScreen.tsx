import React, { useState } from 'react';
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { text as textStyles, fonts } from '../theme/typography';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useClubDetail } from '../hooks/useClubDetail';

interface Props {
  clubId: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

/**
 * ClubPartnerApplyScreen
 *
 * Lets an authenticated user submit an application to manage a specific
 * club as a Scramble Partner. The application enters the `pending` state
 * and an admin reviews it.
 */
export default function ClubPartnerApplyScreen({
  clubId,
  onClose,
  onSubmitted,
}: Props) {
  const { user } = useAuth();
  const { club } = useClubDetail(clubId);
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const visible = !!clubId;

  const submit = async () => {
    if (!user || !clubId) return;
    if (!role.trim()) {
      Alert.alert('Missing info', 'Please tell us your role at the club.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from('club_partner_applications')
      .insert({
        club_id: clubId,
        applicant_id: user.id,
        role_at_club: role.trim(),
        message: message.trim() || null,
      });
    setSubmitting(false);

    if (error) {
      // Handle the unique constraint (already applied)
      if (error.code === '23505') {
        Alert.alert(
          'Already applied',
          'You already have an active application for this club. We\'ll be in touch soon.'
        );
      } else {
        Alert.alert('Could not submit', error.message);
      }
      return;
    }

    Alert.alert(
      'Application submitted 🎉',
      'Thanks for applying to manage this club on Scramble. Our team will review your application and get back to you soon.',
      [
        {
          text: 'OK',
          onPress: () => {
            onSubmitted?.();
            onClose();
          },
        },
      ]
    );
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
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Apply to Manage</Text>
          <View style={{ width: 56 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.clubHeader}>
              <Text style={styles.clubName}>{club?.name ?? 'Loading…'}</Text>
              {club?.address && (
                <Text style={styles.clubAddress}>{club.address}</Text>
              )}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>What is Scramble Partner?</Text>
              <Text style={styles.infoBody}>
                Scramble Partner clubs get:{'\n'}
                • A branded pin on the Scramble map{'\n'}
                • A rich profile with your own photos + course info{'\n'}
                • Verified "Scramble Partner" badge{'\n'}
                • Feature placement in future Scramble content{'\n\n'}
                Apply below and our team will get in touch to confirm your
                role at the club and set up your profile.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Your role at the club *</Text>
              <TextInput
                value={role}
                onChangeText={setRole}
                placeholder="e.g. General Manager, Head Pro, Owner"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!submitting}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Tell us about your club (optional)
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Why would you like to be a Scramble Partner? Anything we should know about the club?"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.textarea]}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                editable={!submitting}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={submit}
              disabled={submitting}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? 'Submitting…' : 'Submit application'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              By submitting, you confirm you're authorised to represent this
              club. We'll verify your role before approving.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  cancelText: { ...textStyles.bodyStrong, color: colors.primary },
  title: { ...textStyles.h3, color: colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  clubHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  clubName: { ...textStyles.h1, color: colors.primary },
  clubAddress: {
    ...textStyles.body,
    color: colors.textMuted,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: colors.mist,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoTitle: {
    ...textStyles.h3,
    color: colors.primary,
    marginBottom: 6,
  },
  infoBody: {
    ...textStyles.body,
    color: colors.textSecondary,
  },
  formGroup: { marginBottom: 20 },
  label: {
    ...textStyles.bodyStrong,
    color: colors.primary,
    marginBottom: 6,
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
  textarea: { minHeight: 110 },
  submitBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    ...textStyles.bodyStrong,
    color: colors.white,
    fontSize: 16,
  },
  disclaimer: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 14,
  },
});
