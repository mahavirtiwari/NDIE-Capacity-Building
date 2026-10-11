import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { ApiError } from '../src/api/client';
import { me } from '../src/api/endpoints';
import { Banner, Button, Card, Field, KeyboardAvoider } from '../src/components/ui';
import { spacing } from '../src/theme';

/**
 * Changing the password, on its own.
 *
 * It used to sit at the bottom of the profile screen, under the details
 * being edited there, so three password boxes were in the way of everybody
 * who had come to correct their mobile number. It is its own errand and it
 * is done once, so it is its own screen.
 */
export default function ChangePassword() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    if (!currentPassword) {
      setFailure('Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setFailure('The new password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFailure('The two new passwords do not match.');
      return;
    }

    setBusy(true);
    setFailure(null);
    try {
      await me.changePassword(currentPassword, newPassword);
      Alert.alert('Password changed', 'Use your new password the next time you sign in.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoider style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: 'Change password' }} />

        <Card style={styles.card}>
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

          {failure ? <Banner tone="danger">{failure}</Banner> : null}

          {/* Signing in does not change: the applicant ID stays the same
              and nothing about this signs them out of this device. */}
          <Banner tone="info">
            Your applicant ID does not change. You stay signed in on this device.
          </Banner>

          <Button label="Change password" onPress={save} loading={busy} />
        </Card>
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
});
