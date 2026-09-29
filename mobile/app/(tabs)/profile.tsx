import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../../src/api/client';
import { auth as authApi, lookups, me } from '../../src/api/endpoints';
import type { LookupItem } from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import { useAuth } from '../../src/auth/AuthContext';
import { useBranding } from '../../src/branding/BrandingContext';
import { Picker } from '../../src/components/Picker';
import { Banner, Button, Card, DetailRow, Field, Loading, StatusPill } from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';
import { isEmail, isMobile } from '../../src/validation/formats';

/**
 * Identity is the system generated applicant ID and never changes. Email and
 * mobile are ordinary profile data the applicant edits here.
 */
export default function Profile() {
  const router = useRouter();
  const { applicant, signOut, refreshProfile } = useAuth();
  const { branding } = useBranding();

  const [email, setEmail] = useState(applicant?.email ?? '');
  const [mobile, setMobile] = useState(applicant?.mobile ?? '');
  const [stateCode, setStateCode] = useState<string | null>(
    applicant?.stateCode ? String(applicant.stateCode) : null,
  );
  const [districtCode, setDistrictCode] = useState<string | null>(
    applicant?.districtCode ? String(applicant.districtCode) : null,
  );
  const [city, setCity] = useState(applicant?.city ?? '');

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const states = useResource<LookupItem[]>(() => lookups.states(), []);
  const districts = useResource<LookupItem[]>(
    () => (stateCode ? lookups.districts(Number(stateCode)) : Promise.resolve([])),
    [stateCode],
  );

  /* Clear a district that does not belong to the newly chosen state. */
  useEffect(() => {
    if (!districtCode || !districts.data) return;
    if (!districts.data.some((item) => String(item.id) === districtCode)) {
      setDistrictCode(null);
    }
  }, [districts.data, districtCode]);

  const stateOptions = useMemo(
    () => (states.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
    [states.data],
  );
  const districtOptions = useMemo(
    () => (districts.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
    [districts.data],
  );

  if (!applicant) return <Loading />;

  const emailChanged = email.trim().toLowerCase() !== applicant.email.toLowerCase();

  const commitProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      await me.updateProfile({
        email: email.trim(),
        mobile: mobile.trim(),
        stateCode: stateCode ? Number(stateCode) : null,
        districtCode: districtCode ? Number(districtCode) : null,
        city: city.trim() || null,
      });

      /* A new address is untrusted until proven, and the API refuses sign-in
         until it is. Send the code and take the applicant straight there so
         they are never quietly locked out of their own account. */
      if (emailChanged) {
        const next = email.trim();
        try {
          await authApi.sendOtp(next, applicant.fullName);
        } catch {
          /* Throttled or offline; the verify screen can resend. */
        }
        await signOut();
        router.replace({
          pathname: '/(auth)/verify',
          params: {
            email: next,
            applicantCode: applicant.applicantCode,
            reason: 'email-change',
          },
        });
        return;
      }

      await refreshProfile();
      setProfileSaved(true);
    } catch (caught) {
      setProfileError(caught instanceof ApiError ? caught.message : 'Could not save your details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveProfile = () => {
    if (!isEmail(email)) {
      setProfileError('Enter a valid email address.');
      return;
    }
    if (!isMobile(mobile)) {
      setProfileError('Enter a valid 10 digit mobile number.');
      return;
    }

    if (emailChanged) {
      Alert.alert(
        'Verify the new email?',
        `You will be signed out and sent a code at ${email.trim()}. Your applicant ID and password stay the same, but you cannot sign in until the new address is confirmed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send code', onPress: () => void commitProfile() },
        ],
      );
      return;
    }

    void commitProfile();
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      setPasswordError('The new password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The two new passwords do not match.');
      return;
    }

    setSavingPassword(true);
    setPasswordError(null);
    try {
      await me.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password changed', 'Use your new password the next time you sign in.');
    } catch (caught) {
      setPasswordError(
        caught instanceof ApiError ? caught.message : 'Could not change your password.',
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need your applicant ID and password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(applicant.fullName)}</Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.name}>{applicant.fullName}</Text>
              <Text style={styles.code}>{applicant.applicantCode}</Text>
            </View>
            <StatusPill value={applicant.isBlocked ? 'Inactive' : 'Active'} />
          </View>

          <View style={styles.details}>
            <DetailRow label="Applicant ID" value={applicant.applicantCode} />
            <DetailRow label="PAN" value={applicant.pan} />
            <DetailRow label="Category" value={applicant.categoryName ?? '—'} />
            <DetailRow label="Sub-category" value={applicant.subCategoryName ?? '—'} />
            <DetailRow
              label="Email verified"
              value={<StatusPill value={applicant.emailVerified ? 'Verified' : 'Pending'} />}
            />
          </View>

          <Banner tone="info">
            Your applicant ID never changes. Updating your email below does not change how you sign
            in.
          </Banner>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Contact details</Text>

          <Field
            label="Email"
            required
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Mobile"
            required
            value={mobile}
            onChangeText={(text) => setMobile(text.replace(/\D/g, ''))}
            placeholder="Enter mobile number"
            keyboardType="number-pad"
            maxLength={10}
          />
          <Picker
            label="State"
            value={stateCode}
            options={stateOptions}
            onChange={setStateCode}
            searchable
          />
          <Picker
            label="District"
            value={districtCode}
            options={districtOptions}
            onChange={setDistrictCode}
            disabled={!stateCode}
            hint={stateCode ? null : 'Choose a state first.'}
            searchable
          />
          <Field label="City / town" value={city} onChangeText={setCity} />

          {emailChanged ? (
            <Banner tone="warning">
              Changing your email signs you out until the new address is verified. Your applicant ID
              and password do not change.
            </Banner>
          ) : null}
          {profileError ? <Banner tone="danger">{profileError}</Banner> : null}
          {profileSaved ? <Banner tone="success">Your details have been saved.</Banner> : null}

          <Button label="Save details" onPress={saveProfile} loading={savingProfile} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Change password</Text>

          <Field
            label="Current password"
            required
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secure
            autoCapitalize="none"
          />
          <Field
            label="New password"
            required
            value={newPassword}
            onChangeText={setNewPassword}
            secure
            autoCapitalize="none"
            hint="At least 8 characters."
          />
          <Field
            label="Confirm new password"
            required
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secure
            autoCapitalize="none"
          />

          {passwordError ? <Banner tone="danger">{passwordError}</Banner> : null}

          <Button
            label="Change password"
            variant="secondary"
            onPress={savePassword}
            loading={savingPassword}
          />
        </Card>

        <Pressable onPress={confirmSignOut} accessibilityRole="button" style={styles.signOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger700} />
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>

        <Text style={styles.footer}>
          {branding.organisationName}
          {branding.supportEmail ? `\n${branding.supportEmail}` : ''}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  card: { gap: spacing.md },

  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: font.md, fontWeight: '700' },
  identityText: { flex: 1, gap: 2 },
  name: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  code: { fontSize: font.sm, color: colors.ink500, letterSpacing: 0.5 },

  details: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },

  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger500,
    backgroundColor: colors.danger50,
  },
  signOutLabel: { fontSize: font.base, fontWeight: '600', color: colors.danger700 },

  footer: { fontSize: font.xs, color: colors.ink400, textAlign: 'center', lineHeight: 17 },
});
