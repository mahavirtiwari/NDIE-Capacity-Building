import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { BrandLogo } from '../../src/branding/BrandingContext';
import { Banner, Button, Field, KeyboardAvoider } from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * Sign-in for the coordinator app, using the same portal credentials as the
 * web portal: the system generated user ID, never an email address.
 *
 * Laid out like the applicant app's, mark and all, because they are two
 * doors into one scheme and a coordinator who has seen the other one
 * should recognise this.
 */
export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();

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
      router.replace('/(tabs)/programs');
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoider style={styles.flex}>
        {/* Centred as a whole, mark included, rather than sitting under the
            status bar with the page empty below it. */}
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            {/* The organisation's own mark, served by the API and kept on the
                device, so this screen is branded even with no signal. */}
            <BrandLogo size={52} />
            <Text style={styles.brand}>PROGRAM MONITORING</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.title}>Welcome</Text>
            <Text style={styles.subtitle}>Sign in to your coordinator account</Text>

            <View style={styles.form}>
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
                hint="The coordinator ID issued to you — not your email address."
              />

              <Field
                label="Password"
                required
                secure
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={submit}
                returnKeyType="go"
                error={errors.password}
              />

              <Link href="/(auth)/forgot-password" asChild>
                <Pressable accessibilityRole="button" style={styles.forgot}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              </Link>

              {failure ? <Banner tone="danger">{failure}</Banner> : null}

              <Button label="Sign in" onPress={submit} loading={busy} />
            </View>
          </View>

          <Text style={styles.footnote}>Capacity Building Management System</Text>
        </ScrollView>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blush },
  flex: { flex: 1 },
  /* justifyContent on a grown container is what centres the whole column —
     mark, panel and footnote together — on a tall screen, and lets it
     scroll normally on a short one or with the keyboard up. */
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },

  hero: { alignItems: 'center', gap: spacing.sm },
  brand: {
    fontSize: font.xl,
    fontWeight: '800',
    color: colors.ink900,
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  /* No card. The applicant app's sign-in lays the form straight onto
     the page, and a white panel floating on the blush made the same
     screen look like a dialog that had opened over something. */
  panel: { paddingHorizontal: spacing.xs, gap: spacing.xs },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.ink900 },
  subtitle: { fontSize: font.sm, color: colors.ink600 },
  form: { gap: spacing.lg, marginTop: spacing.lg },

  forgot: { alignSelf: 'flex-end', paddingVertical: spacing.xs },
  forgotText: { fontSize: font.sm, color: colors.brand700, fontWeight: '600' },

  footnote: { textAlign: 'center', color: colors.ink500, fontSize: font.xs },
});
