import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { BrandLogo, useBranding } from '../../src/branding/BrandingContext';
import { Banner, Button, Field } from '../../src/components/ui';
import { useSiteText } from '../../src/content/SiteTextContext';
import { colors, font, radius, spacing } from '../../src/theme';

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { branding } = useBranding();
  const text = useSiteText();
  const params = useLocalSearchParams<{ applicantCode?: string; notice?: string }>();

  const [applicantCode, setApplicantCode] = useState(params.applicantCode ?? '');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Shown under the field as soon as it has been left, rather than only once
     the button has been pressed and the server has said no. */
  const idError = applicantCode.trim().includes('@')
    ? 'Sign in with your applicant ID, not your email address.'
    : null;

  const submit = async () => {
    setTouched(true);
    if (!applicantCode.trim() || !password) {
      setError('Enter your applicant ID and password.');
      return;
    }
    if (idError) return;

    setBusy(true);
    setError(null);
    try {
      await signIn(applicantCode.trim().toUpperCase(), password);
      router.replace('/(tabs)/programs');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to sign in. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <BrandLogo size={52} />
            <Text style={styles.brand}>{branding.portalTitle}</Text>
            <Text style={styles.org}>{branding.organisationName}</Text>
            <Text style={styles.tagline}>
              {text('app.signin.tagline', 'Training and certification for MSME professionals.')}
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.title}>{text('app.signin.title', 'Welcome')}</Text>
            <Text style={styles.subtitle}>
              {text('app.signin.subtitle', 'Sign in to your applicant account')}
            </Text>

            {params.notice ? (
              <View style={styles.notice}>
                <Banner tone="success">{params.notice}</Banner>
              </View>
            ) : null}

            <View style={styles.form}>
              <Field
                label={text('app.signin.idLabel', 'Applicant ID')}
                required
                value={applicantCode}
                onChangeText={(next) => setApplicantCode(next.toUpperCase())}
                onBlur={() => setTouched(true)}
                placeholder={text('app.signin.idPlaceholder', 'APP240001')}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
                error={touched ? idError : null}
                hint={text(
                  'app.signin.idHint',
                  'The ID emailed to you when your account was created — not your email address.',
                )}
              />

              <Field
                label={text('app.signin.passwordLabel', 'Password')}
                required
                secure
                value={password}
                onChangeText={setPassword}
                placeholder={text('app.signin.passwordPlaceholder', 'Enter your password')}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={submit}
                returnKeyType="go"
              />

              <Link href="/(auth)/forgot-password" asChild>
                <Pressable accessibilityRole="button" style={styles.forgot}>
                  <Text style={styles.forgotText}>
                    {text('app.signin.forgot', 'Forgot password?')}
                  </Text>
                </Pressable>
              </Link>

              {error ? <Banner tone="danger">{error}</Banner> : null}

              <Button label={text('app.signin.action', 'Sign in')} onPress={submit} loading={busy} />
            </View>

            <Text style={styles.footNote}>
              {text(
                'app.signin.footNote',
                'Your details are used only to administer training programmes. Sign-in activity is logged.',
              )}
            </Text>

            {/* First-time visitors arrive here too, and a link under a divider
                was easy to miss. A card of its own says there is a second way
                in without competing with the sign-in button. */}
            <View style={styles.registerCard}>
              <View style={styles.registerHead}>
                <View style={styles.registerIcon}>
                  <Ionicons name="person-add-outline" size={16} color={colors.brand700} />
                </View>
                <Text style={styles.registerTitle}>
                  {text('app.signin.registerTitle', 'New user')}
                </Text>
              </View>
              <Text style={styles.registerBody}>
                {text(
                  'app.signin.registerBody',
                  'If this is your first time here, create an applicant account to begin.',
                )}
              </Text>
              <Button
                label={text('app.signin.registerCta', 'Register now')}
                variant="secondary"
                icon="arrow-forward-outline"
                onPress={() => router.push('/(auth)/sign-up')}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.blush },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.xl },

  hero: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  tagline: {
    fontSize: font.sm,
    color: colors.ink600,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 2,
  },
  brand: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.ink900,
    textAlign: 'center',
    lineHeight: 24,
  },
  org: { fontSize: font.sm, color: colors.ink500 },

  panel: {
    flex: 1,
    backgroundColor: colors.blush,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
  },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.ink900 },
  subtitle: { fontSize: font.sm, color: colors.ink500, marginTop: 4 },
  notice: { marginTop: spacing.lg },
  form: { gap: spacing.lg, marginTop: spacing.xl },

  forgot: { alignSelf: 'flex-end', paddingVertical: spacing.xs },
  forgotText: { fontSize: font.sm, fontWeight: '600', color: colors.brand700 },

  footNote: {
    fontSize: font.xs,
    color: colors.ink500,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: spacing.lg,
  },

  registerCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  registerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  registerIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  registerBody: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },
});
