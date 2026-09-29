import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { auth } from '../../src/api/endpoints';
import { Banner, Button, Card, Field, Subtitle, Title } from '../../src/components/ui';
import { useSiteText } from '../../src/content/SiteTextContext';
import { colors, font, spacing } from '../../src/theme';

/* Matches the server-side resend cooldown in OtpService. */
const RESEND_SECONDS = 60;

/**
 * Email verification. Passing this is what turns a registration into an
 * account: the API issues the applicant's password and mails it with the ID.
 */
export default function Verify() {
  const router = useRouter();
  const text = useSiteText();
  const { email, applicantCode, reason } = useLocalSearchParams<{
    email?: string;
    applicantCode?: string;
    /** "email-change" when re-verifying an address the applicant just edited. */
    reason?: string;
  }>();
  const isEmailChange = reason === 'email-change';

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      setCountdown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const verify = async () => {
    if (code.trim().length !== 6) {
      setError('Enter the 6 digit code from your email.');
      return;
    }
    if (!email) {
      setError('The email address is missing. Please register again.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await auth.verifyOtp(email, code.trim());

      /* Verifying is what issues the password, so this is where registration
         actually finishes — and where the applicant is shown the ID they will
         sign in with. Re-verifying a changed address is not a registration,
         and goes straight back to sign-in. */
      if (isEmailChange) {
        router.replace({
          pathname: '/(auth)/sign-in',
          params: {
            applicantCode: applicantCode ?? '',
            notice: 'New email verified. Sign in again with your existing password.',
          },
        });
      } else {
        router.replace({
          pathname: '/(auth)/registered',
          params: { applicantCode: applicantCode ?? '', email },
        });
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!email || countdown > 0) return;
    setResending(true);
    setError(null);
    try {
      await auth.sendOtp(email);
      setCountdown(RESEND_SECONDS);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Title>Check your email</Title>
        <Subtitle>{`We sent a 6 digit code to ${email ?? 'your address'}.`}</Subtitle>
      </View>

      {isEmailChange ? (
        <Banner tone="warning">
          You changed the address on your account, so it has to be confirmed again before you can
          sign in. Your applicant ID and password are unchanged.
        </Banner>
      ) : applicantCode ? (
        <Banner tone="info">
          {`Your applicant ID is ${applicantCode}. Keep it safe — it is how you sign in.`}
        </Banner>
      ) : null}

      <Card style={styles.card}>
        <Field
          label={text('app.otp.label', 'Verification code')}
          required
          value={code}
          onChangeText={(typed) => setCode(typed.replace(/[^0-9]/g, ''))}
          placeholder={text('app.otp.placeholder', 'Enter OTP')}
          keyboardType="number-pad"
          maxLength={6}
          style={[styles.codeInput, code.length === 0 && styles.codeInputEmpty]}
          onSubmitEditing={verify}
        />

        {error ? <Banner tone="danger">{error}</Banner> : null}

        <Button label="Verify email" onPress={verify} loading={busy} />

        <Pressable
          onPress={resend}
          disabled={countdown > 0 || resending}
          accessibilityRole="button"
          style={styles.resend}
        >
          <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
            {resending
              ? 'Sending…'
              : countdown > 0
                ? `Resend code in ${countdown}s`
                : 'Resend code'}
          </Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { gap: 2 },
  card: { gap: spacing.lg },
  codeInput: { fontSize: font.xl, letterSpacing: 8, textAlign: 'center' },
  /* The wide spacing is for six digits. Left on an empty box it stretches
     the placeholder into something unreadable, so it starts as ordinary
     text and opens up once there is a code in it. */
  codeInputEmpty: { fontSize: font.base, letterSpacing: 0 },
  resend: { alignItems: 'center', paddingVertical: spacing.xs },
  resendText: { fontSize: font.sm, fontWeight: '600', color: colors.brand700 },
  resendDisabled: { color: colors.ink400 },
});
