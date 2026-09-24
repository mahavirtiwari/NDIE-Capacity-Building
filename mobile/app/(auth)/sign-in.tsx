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
import { colors, font, radius, spacing } from '../../src/theme';

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { branding } = useBranding();
  const params = useLocalSearchParams<{ applicantCode?: string; notice?: string }>();

  const [applicantCode, setApplicantCode] = useState(params.applicantCode ?? '');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!applicantCode.trim() || !password) {
      setError('Enter your applicant ID and password.');
      return;
    }

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
          </View>

          <View style={styles.panel}>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>
              Use the applicant ID emailed to you — not your email address.
            </Text>

            {params.notice ? (
              <View style={styles.notice}>
                <Banner tone="success">{params.notice}</Banner>
              </View>
            ) : null}

            <View style={styles.form}>
              <Field
                label="Applicant ID"
                required
                value={applicantCode}
                onChangeText={(text) => setApplicantCode(text.toUpperCase())}
                placeholder="APP240001"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
              />

              <View>
                <Field
                  label="Password"
                  required
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!reveal}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                />
                <Pressable
                  onPress={() => setReveal((current) => !current)}
                  style={styles.reveal}
                  accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={reveal ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.ink500}
                  />
                </Pressable>
              </View>

              {error ? <Banner tone="danger">{error}</Banner> : null}

              <Button label="Sign in" onPress={submit} loading={busy} />
            </View>

            <View style={styles.divider} />

            <Text style={styles.footNote}>New to the scheme?</Text>
            <Link href="/(auth)/sign-up" asChild>
              <Pressable accessibilityRole="button">
                <Text style={styles.link}>Create an applicant account</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.brand900 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.xl },

  hero: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  brand: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    lineHeight: 24,
  },
  org: { fontSize: font.sm, color: colors.onBrandMuted },

  panel: {
    flex: 1,
    backgroundColor: colors.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
  },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.ink900 },
  subtitle: { fontSize: font.sm, color: colors.ink500, marginTop: 4 },
  notice: { marginTop: spacing.lg },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  reveal: { position: 'absolute', right: spacing.md, top: 34 },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xl,
  },
  footNote: { fontSize: font.sm, color: colors.ink500, textAlign: 'center' },
  link: {
    fontSize: font.base,
    fontWeight: '600',
    color: colors.brand700,
    textAlign: 'center',
    marginTop: 6,
  },
});
