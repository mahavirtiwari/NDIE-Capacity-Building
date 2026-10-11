import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { auth as authApi, me } from '../../src/api/endpoints';
import type { Applicant, SignupField, SignupForm } from '../../src/api/types';
import { GENDER_OPTIONS, SOCIAL_CATEGORY_OPTIONS } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { useBranding } from '../../src/branding/BrandingContext';
import {
  Banner,
  Button,
  Card,
  DetailRow,
  Field,
  KeyboardAvoider,
  Loading,
  StatusPill,
} from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';
import { isEmail, isMobile } from '../../src/validation/formats';

/**
 * The account, and nothing else.
 *
 * What is shown is the sign-up form as it was filled in: the questions the
 * department decided to ask, in their order, with the answers this person
 * gave. Nothing is invented here, and nothing that was never asked for -
 * the screen used to offer a state, a district and a town that no applicant
 * had ever been asked for, and a list of their profile submissions, which
 * now lives with the rest of what they have sent in, under Applications.
 *
 * Two answers can be corrected: the mobile number, which is theirs to say,
 * and the e-mail address, which is theirs to say but has to be proven -
 * a code goes to the new address and the account does not move until it
 * comes back. Identity is the applicant ID and neither touches it.
 */
export default function Profile() {
  const router = useRouter();
  const { applicant, signOut, refreshProfile } = useAuth();
  const { branding } = useBranding();

  const [form, setForm] = useState<SignupForm | null>(null);

  const [mobile, setMobile] = useState(applicant?.mobile ?? '');
  const [savingMobile, setSavingMobile] = useState(false);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [mobileSaved, setMobileSaved] = useState(false);

  const [email, setEmail] = useState(applicant?.email ?? '');
  const [code, setCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);

  /* The questions as they are asked today. A field that has since been
     switched off is not shown; an answer to one that has gone is still
     kept on the record, and shown under the question it was asked as. */
  useEffect(() => {
    let cancelled = false;
    authApi
      .signupForm()
      .then((next) => {
        if (!cancelled) setForm(next);
      })
      .catch(() => {
        /* The record below falls back to the built-in questions, which is
           everything the account itself holds. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* The address waiting to be proven comes from the server, so the box for
     the code is still there if the app is closed halfway through. */
  const pending = applicant?.pendingEmail ?? null;

  useEffect(() => {
    if (pending) setEmail(pending);
  }, [pending]);

  const rows = useMemo(() => readBack(applicant, form), [applicant, form]);

  if (!applicant) return <Loading />;

  const saveMobile = async () => {
    if (!isMobile(mobile)) {
      setMobileError('Enter a valid 10 digit mobile number.');
      return;
    }

    setSavingMobile(true);
    setMobileError(null);
    setMobileSaved(false);
    try {
      await me.updateProfile({ mobile: mobile.trim() });
      await refreshProfile();
      setMobileSaved(true);
    } catch (caught) {
      setMobileError(
        caught instanceof ApiError ? caught.message : 'Could not save your mobile number.',
      );
    } finally {
      setSavingMobile(false);
    }
  };

  const requestEmailChange = async () => {
    const wanted = email.trim();
    if (!isEmail(wanted)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    if (wanted.toLowerCase() === applicant.email.toLowerCase()) {
      setEmailError('That is already the address on your account.');
      return;
    }

    setEmailBusy(true);
    setEmailError(null);
    setEmailNote(null);
    try {
      await me.requestEmailChange(wanted);
      await refreshProfile();
      setCode('');
      setEmailNote(`A 6 digit passcode has been sent to ${wanted}.`);
    } catch (caught) {
      setEmailError(caught instanceof ApiError ? caught.message : 'Could not send the passcode.');
    } finally {
      setEmailBusy(false);
    }
  };

  const confirmEmailChange = async () => {
    if (code.trim().length < 4) {
      setEmailError('Enter the passcode from the email.');
      return;
    }

    setEmailBusy(true);
    setEmailError(null);
    setEmailNote(null);
    try {
      await me.confirmEmailChange(code.trim());
      await refreshProfile();
      setCode('');
      Alert.alert(
        'Email changed',
        'Your new address is on the account. You sign in with your applicant ID as before.',
      );
    } catch (caught) {
      setEmailError(caught instanceof ApiError ? caught.message : 'Could not verify the passcode.');
    } finally {
      setEmailBusy(false);
    }
  };

  const resend = async () => {
    setEmailBusy(true);
    setEmailError(null);
    setEmailNote(null);
    try {
      await me.resendEmailChange();
      setEmailNote('The passcode has been sent again.');
    } catch (caught) {
      setEmailError(caught instanceof ApiError ? caught.message : 'Could not send the passcode.');
    } finally {
      setEmailBusy(false);
    }
  };

  const cancelEmailChange = async () => {
    setEmailBusy(true);
    setEmailError(null);
    setEmailNote(null);
    try {
      await me.cancelEmailChange();
      await refreshProfile();
      setEmail(applicant.email);
      setCode('');
    } catch (caught) {
      setEmailError(caught instanceof ApiError ? caught.message : 'Could not cancel the change.');
    } finally {
      setEmailBusy(false);
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
    <KeyboardAvoider style={styles.flex}>
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

          <Banner tone="info">
            Your applicant ID never changes and is what you sign in with.
          </Banner>
        </Card>

        {/* What was filled in at sign-up, read back. Only the two boxes
            below are editable; the rest is the record of what was said. */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>What you told us when you registered</Text>
          <View style={styles.details}>
            {rows.map((row) => (
              <DetailRow key={row.key} label={row.label} value={row.value} />
            ))}
            <DetailRow
              label="Email verified"
              value={<StatusPill value={applicant.emailVerified ? 'Verified' : 'Pending'} />}
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Mobile number</Text>
          <Field
            label="Mobile"
            required
            value={mobile}
            onChangeText={(text) => {
              setMobile(text.replace(/\D/g, ''));
              setMobileSaved(false);
            }}
            placeholder="Enter mobile number"
            keyboardType="number-pad"
            maxLength={10}
          />
          {mobileError ? <Banner tone="danger">{mobileError}</Banner> : null}
          {mobileSaved ? <Banner tone="success">Your mobile number has been saved.</Banner> : null}
          <Button
            label="Save mobile number"
            onPress={saveMobile}
            loading={savingMobile}
            disabled={mobile === applicant.mobile}
          />
        </Card>

        {/* The address, and the proof. Nothing moves until a passcode sent
            to the new mailbox comes back, so a mistyped address costs an
            unread email and nothing else. */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Email address</Text>

          {pending ? (
            <>
              <Banner tone="warning">
                {`A 6 digit passcode was sent to ${pending}. Your account still uses `
                  + `${applicant.email} until you enter it.`}
              </Banner>
              <Field
                label="Passcode"
                required
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
                placeholder="6 digit code"
                keyboardType="number-pad"
                maxLength={6}
              />
              {emailError ? <Banner tone="danger">{emailError}</Banner> : null}
              {emailNote ? <Banner tone="success">{emailNote}</Banner> : null}

              <Button label="Verify and change" onPress={confirmEmailChange} loading={emailBusy} />
              <Button
                label="Send the passcode again"
                variant="secondary"
                onPress={resend}
                loading={emailBusy}
              />
              <Pressable onPress={cancelEmailChange} accessibilityRole="button">
                <Text style={styles.cancel}>Cancel the change</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Field
                label="Email"
                required
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                hint="A passcode is sent to the new address before it is changed."
              />
              {emailError ? <Banner tone="danger">{emailError}</Banner> : null}
              {emailNote ? <Banner tone="success">{emailNote}</Banner> : null}
              <Button
                label="Send passcode to the new address"
                onPress={requestEmailChange}
                loading={emailBusy}
                disabled={email.trim().toLowerCase() === applicant.email.toLowerCase()}
              />
            </>
          )}
        </Card>

        {/* Its own errand, on its own screen. */}
        <Pressable
          onPress={() => router.push('/change-password')}
          accessibilityRole="button"
          style={styles.link}
        >
          <Ionicons name="key-outline" size={18} color={colors.brand700} />
          <Text style={styles.linkLabel}>Change password</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.ink500} />
        </Pressable>

        <Pressable onPress={confirmSignOut} accessibilityRole="button" style={styles.signOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger700} />
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>

        <Text style={styles.footer}>
          {branding.organisationName}
          {branding.supportEmail ? `\n${branding.supportEmail}` : ''}
        </Text>
      </ScrollView>
    </KeyboardAvoider>
  );
}

/** The built-in questions, and where each one's answer is kept. */
const BUILT_IN: Record<string, (applicant: Applicant) => string> = {
  fullName: (a) => a.fullName,
  email: (a) => a.email,
  mobile: (a) => a.mobile,
  pan: (a) => a.pan,
  gender: (a) => GENDER_OPTIONS.find((o) => o.value === a.gender)?.label ?? '—',
  socialCategory: (a) =>
    SOCIAL_CATEGORY_OPTIONS.find((o) => o.value === a.socialCategory)?.label ?? '—',
};

/**
 * The sign-up form as this applicant filled it in.
 *
 * Driven by the form where it loaded, so a question the department added
 * appears here as soon as somebody answers it and a question they retired
 * stops being asked about. Falls back to the built-in questions, which is
 * everything the account record itself holds, when the form cannot be read.
 */
function readBack(
  applicant: Applicant | null,
  form: SignupForm | null,
): { key: string; label: string; value: string }[] {
  if (!applicant) return [];

  const answers = new Map((applicant.answers ?? []).map((answer) => [answer.key, answer]));
  const fields: SignupField[] = (form?.fields ?? []).filter((field) => field.type !== 'file');

  if (fields.length === 0) {
    return Object.entries(BUILT_IN).map(([key, read]) => ({
      key,
      label: humanise(key),
      value: read(applicant) || '—',
    }));
  }

  const rows = fields.map((field) => ({
    key: field.key,
    label: field.label,
    value: field.isBuiltIn
      ? (BUILT_IN[field.key]?.(applicant) ?? '—')
      : (answers.get(field.key)?.value || '—'),
  }));

  /* Answered, but the question is no longer asked. Still shown, under the
     wording it carried at the time: it is part of what they sent. */
  const asked = new Set(fields.map((field) => field.key));
  for (const answer of applicant.answers ?? []) {
    if (asked.has(answer.key) || !answer.value) continue;
    rows.push({ key: answer.key, label: answer.label, value: answer.value });
  }

  return rows;
}

const humanise = (key: string): string =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());

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
  cancel: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.ink600,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },

  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  linkLabel: { flex: 1, fontSize: font.base, fontWeight: '600', color: colors.ink900 },

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

  footer: { fontSize: font.xs, color: colors.ink500, textAlign: 'center', lineHeight: 17 },
});
