import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { auth } from '../../src/api/endpoints';
import { Banner, Button, Card, Field, Subtitle, Title } from '../../src/components/ui';
import { useSiteText } from '../../src/content/SiteTextContext';
import { colors, font, radius, spacing } from '../../src/theme';
import { isApplicantCode, isEmail } from '../../src/validation/formats';

/**
 * Asking for a reset code.
 *
 * Either identifier is accepted, because somebody who has lost their password
 * has usually lost the email carrying their applicant ID along with it.
 *
 * The server answers the same way whether or not the account exists, so this
 * screen never says "no such applicant" — it always moves on to the next one.
 * The masked address that comes back is the only thing that differs, and it is
 * only ever a masked one.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const text = useSiteText();

  const [identifier, setIdentifier] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typed = identifier.trim();
  const looksLikeEmail = typed.includes('@');

  /* Neither a well formed e-mail nor anything resembling an applicant ID is
     a typo, and sending it on would end at a screen waiting for a code that
     was never sent. One message covers both, because from the applicant's
     side there is one thing to do about it. */
  const wellFormed = looksLikeEmail ? isEmail(typed) : isApplicantCode(typed);
  const invalid =
    typed.length > 0 && wellFormed
      ? null
      : text(
          'app.forgot.invalid',
          'Please provide a valid applicant ID or registered email ID.',
        );

  const submit = async () => {
    setTouched(true);
    if (invalid) return;

    setBusy(true);
    setError(null);
    try {
      const result = await auth.forgotPassword(typed);
      router.push({
        pathname: '/(auth)/reset-password',
        params: {
          identifier: typed,
          masked: result.maskedEmail ?? '',
          minutes: String(result.validityMinutes),
          resendAfter: String(result.resendAfterSeconds),
        },
      });
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not send a code. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Title>{text('app.forgot.title', 'Reset password')}</Title>
        <Subtitle>
          {text('app.forgot.subtitle', 'Recover access to your applicant account')}
        </Subtitle>
      </View>

      <Card style={styles.card}>
        <Field
          label={text('app.forgot.label', 'Applicant ID or email')}
          required
          value={identifier}
          onChangeText={(next) => setIdentifier(next.includes('@') ? next : next.toUpperCase())}
          onBlur={() => setTouched(true)}
          placeholder={text('app.forgot.placeholder', 'APP240001 or you@example.com')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={looksLikeEmail ? 'email-address' : 'default'}
          maxLength={120}
          error={touched ? invalid : null}
          hint={text('app.forgot.hint', 'Either one is accepted.')}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error ? <Banner tone="danger">{error}</Banner> : null}

        <Button label={text('app.forgot.action', 'Continue')} onPress={submit} loading={busy} />
      </Card>

      <View style={styles.explainer}>
        <Row
          icon="card-outline"
          title="You enter an applicant ID"
          body={text('app.forgot.byId', 'The code goes to the email held on that account.')}
        />
        <Row
          icon="mail-outline"
          title="You enter an email"
          body={text(
            'app.forgot.byEmail',
            'The code goes to that address, as long as it belongs to one account.',
          )}
        />
      </View>
    </ScrollView>
  );
}

function Row({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.brand700} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { gap: 2 },
  card: { gap: spacing.lg },

  explainer: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: font.sm, fontWeight: '700', color: colors.ink800 },
  rowBody: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },
});
