import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { auth } from '../../src/api/endpoints';
import { Banner, Button, Card, Field, Subtitle, Title } from '../../src/components/ui';
import { useSiteText } from '../../src/content/SiteTextContext';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * The second half of a reset: the code out of the mailbox, and the password
 * that replaces the forgotten one.
 *
 * The address is shown masked, exactly as the server sent it — enough for the
 * holder to know which mailbox to open, not enough for anybody else to learn
 * it. When there was no such account there is no address to show, and the
 * screen still reads the same way; that is deliberate.
 */
export default function ResetPassword() {
  const router = useRouter();
  const text = useSiteText();
  const params = useLocalSearchParams<{
    identifier?: string;
    masked?: string;
    minutes?: string;
    resendAfter?: string;
  }>();

  const identifier = params.identifier ?? '';
  const masked = params.masked ?? '';
  const minutes = Number(params.minutes) || 15;

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(Number(params.resendAfter) || 60);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      setCountdown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const codeError = code.length === 0 ? 'Enter the 6 digit code.' : code.length < 6 ? 'The code is 6 digits.' : null;
  const passwordError =
    password.length === 0
      ? 'Choose a password.'
      : password.length < 8
        ? 'At least 8 characters.'
        : null;
  const confirmError = confirm === password ? null : 'The two passwords do not match.';

  const submit = async () => {
    setTouched(true);
    if (codeError || passwordError || confirmError) return;

    setBusy(true);
    setError(null);
    try {
      await auth.resetPassword(identifier, code, password);
      router.replace({
        pathname: '/(auth)/sign-in',
        params: {
          applicantCode: identifier.includes('@') ? '' : identifier.toUpperCase(),
          notice: text(
            'app.reset.done',
            'Your password has been changed. Sign in with the new one.',
          ),
        },
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reset the password.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const again = await auth.forgotPassword(identifier);
      setCountdown(again.resendAfterSeconds || 60);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send another code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Title>{text('app.reset.title', 'Check your email')}</Title>
        <Subtitle>
          {text('app.reset.subtitle', 'Enter the code we sent, then choose a new password')}
        </Subtitle>
      </View>

      {masked ? (
        <View style={styles.delivery}>
          <Text style={styles.deliveryLabel}>DELIVERED TO</Text>
          <Text style={styles.deliveryValue}>{masked}</Text>
        </View>
      ) : null}

      <Card style={styles.card}>
        <Field
          label="Verification code"
          required
          value={code}
          onChangeText={(next) => setCode(next.replace(/[^0-9]/g, ''))}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          style={styles.codeInput}
          error={touched ? codeError : null}
        />

        <Field
          label="New password"
          required
          secure
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          error={touched ? passwordError : null}
          hint="At least 8 characters."
        />

        <Field
          label="Confirm new password"
          required
          secure
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="none"
          autoCorrect={false}
          error={touched || confirm.length > 0 ? confirmError : null}
          onSubmitEditing={submit}
        />

        {error ? <Banner tone="danger">{error}</Banner> : null}

        <Button
          label={text('app.reset.action', 'Set new password')}
          onPress={submit}
          loading={busy}
        />

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

      <Text style={styles.note}>
        {text(
          'app.reset.note',
          'The code is valid for {minutes} minutes and can be used once. Check your spam folder if it has not arrived.',
          { minutes },
        )}
      </Text>

      <Pressable
        onPress={() => router.replace('/(auth)/sign-in')}
        accessibilityRole="button"
        style={styles.back}
      >
        <Text style={styles.backText}>Back to sign in</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { gap: 2 },

  delivery: {
    backgroundColor: colors.brand50,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  deliveryLabel: { fontSize: font.xs, fontWeight: '700', color: colors.brand700, letterSpacing: 1 },
  deliveryValue: { fontSize: font.md, fontWeight: '600', color: colors.ink900 },

  card: { gap: spacing.lg },
  codeInput: { fontSize: font.xl, letterSpacing: 8, textAlign: 'center' },

  resend: { alignItems: 'center', paddingVertical: spacing.xs },
  resendText: { fontSize: font.sm, fontWeight: '600', color: colors.brand700 },
  resendDisabled: { color: colors.ink400 },

  note: { fontSize: font.sm, color: colors.ink500, lineHeight: 19 },
  back: { alignItems: 'center', paddingVertical: spacing.sm },
  backText: { fontSize: font.base, fontWeight: '600', color: colors.brand700 },
});
