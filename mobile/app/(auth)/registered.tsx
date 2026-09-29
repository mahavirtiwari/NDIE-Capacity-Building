import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../../src/components/ui';
import { useSiteText } from '../../src/content/SiteTextContext';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * The end of registration.
 *
 * The applicant ID is the thing that matters here: it is what they sign in
 * with, it is not their email, and it was mailed to an inbox they may not
 * reach from this phone. So it is on screen, in full, with a copy button —
 * and the password is not, because it went to the mailbox and repeating it
 * here would put it on a screen anybody nearby can read.
 */
export default function Registered() {
  const router = useRouter();
  const text = useSiteText();
  const { applicantCode, email } = useLocalSearchParams<{
    applicantCode?: string;
    email?: string;
  }>();

  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!applicantCode) return;
    await Clipboard.setStringAsync(applicantCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.badge}>
        <Ionicons name="checkmark" size={34} color={colors.white} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>
          {text('app.registered.title', 'Registration successful')}
        </Text>
        <Text style={styles.subtitle}>
          {text(
            'app.registered.subtitle',
            'Your account is ready. Sign in with the applicant ID below.',
          )}
        </Text>
      </View>

      <Card style={styles.card}>
        <View>
          <Text style={styles.term}>APPLICANT ID</Text>
          <View style={styles.idRow}>
            <Text style={styles.id} selectable>
              {applicantCode ?? '—'}
            </Text>
            <Pressable onPress={copy} style={styles.copy} accessibilityRole="button">
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={15}
                color={colors.brand700}
              />
              <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.rule} />

        <View>
          <Text style={styles.term}>PASSWORD</Text>
          <Text style={styles.masked}>••••••••••</Text>
          <Text style={styles.sentTo}>
            {text('app.registered.sentTo', 'Sent to {email}', { email: email ?? 'your email' })}
          </Text>
        </View>
      </Card>

      <Text style={styles.note}>
        {text(
          'app.registered.note',
          'Keep the applicant ID safe — it is how you sign in, and it does not change if you later edit your email address.',
        )}
      </Text>

      <Button
        label={text('app.registered.action', 'Sign in to dashboard')}
        onPress={() =>
          router.replace({
            pathname: '/(auth)/sign-in',
            params: { applicantCode: applicantCode ?? '' },
          })
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },

  badge: {
    alignSelf: 'center',
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: colors.success500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { gap: 4, alignItems: 'center' },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.ink900, textAlign: 'center' },
  subtitle: {
    fontSize: font.sm,
    color: colors.ink600,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: spacing.md,
  },

  card: { gap: spacing.md },
  term: { fontSize: font.xs, fontWeight: '700', color: colors.ink500, letterSpacing: 1 },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 4,
  },
  id: { flex: 1, fontSize: font.xl, fontWeight: '700', color: colors.brand700, letterSpacing: 1 },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand100,
    backgroundColor: colors.brand50,
  },
  copyText: { fontSize: font.sm, fontWeight: '600', color: colors.brand700 },

  rule: { height: 1, backgroundColor: colors.border },
  masked: { fontSize: font.lg, color: colors.ink700, letterSpacing: 3, marginTop: 4 },
  sentTo: { fontSize: font.sm, color: colors.ink600, marginTop: 2 },

  note: { fontSize: font.sm, color: colors.ink500, lineHeight: 19 },
});
