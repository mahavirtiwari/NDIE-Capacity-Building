import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { ApiError } from '../src/api/client';
import { auth as authApi } from '../src/api/endpoints';
import { useAuth } from '../src/auth/AuthContext';
import { Banner, Button, Card, Field, KeyboardAvoider } from '../src/components/ui';
import { colors, font, spacing } from '../src/theme';

/**
 * Changing the password of the signed-in coordinator.
 *
 * The server ends every other session when it succeeds, so this one is
 * ended too and the app goes back to sign-in. Leaving the app on a token
 * the server has stopped honouring would look like the change had failed.
 */
export default function ChangePassword() {
  const router = useRouter();
  const { signOut } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ current?: string; next?: string; again?: string }>({});

  const save = async () => {
    const found: typeof errors = {};
    if (!current) found.current = 'Enter your current password.';
    if (!next) found.next = 'Enter a new password.';
    else if (next.length < 8) found.next = 'Use at least 8 characters.';
    else if (next === current) found.next = 'The new password has to be different.';
    if (again !== next) found.again = 'The two do not match.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      await authApi.changePassword(current, next);
      Alert.alert(
        'Password changed',
        'Sign in again with your new password.',
        [
          {
            text: 'Sign in',
            onPress: async () => {
              await signOut();
              router.replace('/(auth)/sign-in');
            },
          },
        ],
        { cancelable: false },
      );
    } catch (caught) {
      setFailure(
        caught instanceof ApiError ? caught.message : 'Could not change your password.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoider style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {failure ? <Banner tone="danger">{failure}</Banner> : null}

        <Text style={styles.lead}>
          Your user ID does not change. Only the password does, and you will be asked to
          sign in again with the new one.
        </Text>

        <Card style={styles.card}>
          <Field
            label="Current password"
            required
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            placeholder="Your current password"
            error={errors.current}
          />
          <Field
            label="New password"
            required
            value={next}
            onChangeText={setNext}
            secureTextEntry
            placeholder="At least 8 characters"
            error={errors.next}
          />
          <Field
            label="New password again"
            required
            value={again}
            onChangeText={setAgain}
            secureTextEntry
            placeholder="Type it once more"
            error={errors.again}
          />

          <Button label={busy ? 'Saving…' : 'Change password'} onPress={save} disabled={busy} />
        </Card>
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg },
  lead: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },
  card: { gap: spacing.lg },
});
