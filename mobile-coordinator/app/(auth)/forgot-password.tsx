import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../src/api/client';
import { auth } from '../../src/api/endpoints';
import { BrandLogo } from '../../src/branding/BrandingContext';
import { Banner, Button, Field, KeyboardAvoider } from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * Getting back in, from the phone.
 *
 * The same two calls the portal's own screen makes, so the code that
 * arrives is the same code and goes to the same address — a coordinator
 * can start here and finish on the web, or the other way round. It has
 * to be on the handset as well: the people using this app are out at a
 * venue with a phone and no portal in front of them, and until now a
 * forgotten password meant ringing the office.
 */
export default function ForgotPassword() {
  const router = useRouter();

  const [sent, setSent] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request = async () => {
    const id = userId.trim();
    if (!id) {
      setError('Enter your user ID or registered email.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await auth.forgotPassword(id);
      setSent(
        result.message
          ?? `A code has been sent to your registered email. It is valid for ${result.validityMinutes} minutes.`,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send a reset code.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (code.trim().length === 0) {
      setError('Enter the code from your email.');
      return;
    }
    if (password.length < 8) {
      setError('The new password must be at least 8 characters.');
      return;
    }
    /* Checked here rather than left to the server: the server is told one
       password and cannot know it was typed wrong twice. */
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await auth.resetPassword(userId.trim(), code.trim(), password);
      router.replace('/(auth)/sign-in');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not set the new password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoider style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <BrandLogo size={46} />
          </View>

          <View style={styles.panel}>
            <Text style={styles.title}>{sent ? 'Enter the code' : 'Forgot password'}</Text>
            <Text style={styles.subtitle}>
              {sent ?? 'We will email a reset code to the address on your account.'}
            </Text>

            {sent === null ? (
              <View style={styles.form}>
                <Field
                  label="User ID or email"
                  required
                  value={userId}
                  /* Upper-cased while it looks like an ID, left alone once
                     there is an @ in it: every issued code is upper case,
                     and an address shouted back in capitals as it is typed
                     looks like the box has misunderstood. The server takes
                     either and files the code under the ID, so the second
                     step finds it whichever was typed. */
                  onChangeText={(text) =>
                    setUserId(text.includes('@') ? text : text.toUpperCase())
                  }
                  placeholder="CO0010 or your registered email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={request}
                  returnKeyType="go"
                  hint="Whichever you have: the coordinator ID issued to you, or the address on your account."
                />

                {error ? <Banner tone="danger">{error}</Banner> : null}

                <Button label="Send reset code" onPress={request} loading={busy} />
              </View>
            ) : (
              <View style={styles.form}>
                <Field
                  label="Reset code"
                  required
                  value={code}
                  onChangeText={setCode}
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                />

                <Field
                  label="New password"
                  required
                  secure
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Field
                  label="Confirm new password"
                  required
                  secure
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Type it again"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={reset}
                  returnKeyType="go"
                />

                {error ? <Banner tone="danger">{error}</Banner> : null}

                <Button label="Set new password" onPress={reset} loading={busy} />

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSent(null);
                    setError(null);
                    setCode('');
                  }}
                  style={styles.again}
                >
                  <Text style={styles.againText}>
                    Use a different user ID, or send a new code
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(auth)/sign-in')}
            style={styles.back}
          >
            <Text style={styles.backText}>Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blush },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },

  hero: { alignItems: 'center' },

  panel: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.ink900 },
  subtitle: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },
  form: { gap: spacing.lg, marginTop: spacing.lg },

  again: { alignSelf: 'center', paddingVertical: spacing.xs },
  againText: { fontSize: font.sm, color: colors.brand700, fontWeight: '600' },

  back: { alignSelf: 'center', paddingVertical: spacing.sm },
  backText: { fontSize: font.sm, color: colors.ink600, fontWeight: '600' },
});
