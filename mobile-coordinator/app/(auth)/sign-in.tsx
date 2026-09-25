import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { BrandLogo, useBranding } from '../../src/branding/BrandingContext';
import { Banner, Button, Card, Field, Subtitle, Title } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';

/**
 * Sign-in for the coordinator app, using the same portal credentials as the
 * web portal: the system generated user ID, never an email address.
 */
export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { branding } = useBranding();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const found: Record<string, string> = {};
    if (!userId.trim()) found.userId = 'User ID is required.';
    if (!password) found.password = 'Password is required.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      await signIn(userId, password);
      router.replace('/workshops');
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          {/* The organisation's own mark, served by the API and kept on the
              device, so this screen is branded even with no signal. */}
          <BrandLogo size={46} />
          <Text style={styles.org}>{branding.organisationName}</Text>
          <Title>Workshop monitoring</Title>
          <Subtitle>
            Sign in with the coordinator ID issued to you — not your email address.
          </Subtitle>
        </View>

        <Card style={styles.card}>
          <Field
            label="User ID"
            required
            value={userId}
            /* Upper-cased as you type: every issued code is upper case, and a
               lower-cased one would simply be rejected. */
            onChangeText={(text) => setUserId(text.toUpperCase())}
            placeholder="e.g. CO0010"
            autoCapitalize="characters"
            autoCorrect={false}
            error={errors.userId}
          />

          <Field
            label="Password"
            required
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            error={errors.password}
          />

          {failure ? <Banner tone="danger">{failure}</Banner> : null}

          <Button label="Sign in" onPress={submit} loading={busy} />
        </Card>

        <Text style={styles.footnote}>
          Capacity Building Management System · Ministry of MSME
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.blush },
  content: { padding: spacing.lg, paddingTop: spacing.xxl * 2, gap: spacing.lg, flexGrow: 1 },
  header: { gap: spacing.xs, alignItems: 'flex-start' },
  org: { color: colors.ink600, fontSize: 12, marginBottom: spacing.sm },
  card: { gap: spacing.lg },
  footnote: { marginTop: 'auto', textAlign: 'center', color: colors.ink500, fontSize: 12 },
});
