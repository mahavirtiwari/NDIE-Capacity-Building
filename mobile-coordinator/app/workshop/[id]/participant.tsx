import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { participants as participantsApi } from '../../../src/api/endpoints';
import { Banner, Button, Card, Field, KeyboardAvoider } from '../../../src/components/ui';
import { isEmail } from '../../../src/validation/formats';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Registering somebody at the door.
 *
 * Two fields: the applicant ID and the e-mail on it. Everything else about
 * the person is already on the account that ID names, and a coordinator
 * keying a name, an enterprise and a Udyam number into a phone in a corridor
 * only produces a second version of somebody the scheme already knows. The
 * server matches the pair, enrols them on the programme, and copies the rest
 * across.
 *
 * Both fields, not one. The ID alone would let a queue of people be added by
 * guessing codes; the e-mail alone is not an identity here — it is profile
 * data the applicant can change, and two accounts can carry the same one.
 *
 * The first day only. Registration at the door is for the person standing in
 * it, and a batch that started on Monday taking walk-ins on Thursday is a
 * batch whose register says somebody attended three days they did not.
 */
export default function OnSpotRegistration() {
  const { id, detail, refresh, locked } = useWorkshop();
  const registered = detail?.participants ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const firstDay = (detail?.startDate ?? '').slice(0, 10);
  const open = useMemo(() => !locked && firstDay === today, [locked, firstDay, today]);

  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enrol = async () => {
    const found: Record<string, string> = {};
    if (!code.trim()) found.code = 'Applicant ID is required.';
    if (!email.trim()) found.email = 'Email is required.';
    else if (!isEmail(email)) found.email = 'Enter a valid email address.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      await participantsApi.enrol(id, {
        applicantCode: code.trim().toUpperCase(),
        email: email.trim(),
      });
      await refresh();
      /* Cleared for the next person in the queue. */
      setCode('');
      setEmail('');
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not register.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoider style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {locked ? <Banner tone="info">Finally submitted — read only.</Banner> : null}

        {!locked && firstDay && firstDay !== today ? (
          <Banner tone="warning">
            {firstDay > today
              ? `Registration at the door opens on the first day, ${longDate(firstDay)}.`
              : `Registration at the door closed after the first day, ${longDate(firstDay)}.`}
          </Banner>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.heading}>Registered ({registered.length})</Text>
          {registered.length === 0 ? (
            <Text style={styles.none}>Nobody registered yet.</Text>
          ) : (
            registered.map((person) => (
              <View key={person.id} style={styles.row}>
                <Text style={styles.rowTitle}>{person.fullName}</Text>
                <Text style={styles.rowMeta}>
                  {person.applicantCode ?? person.enterpriseName ?? '—'}
                </Text>
              </View>
            ))
          )}
        </Card>

        {open ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Register an applicant</Text>
            <Text style={styles.none}>
              Ask for the applicant ID and the e-mail address on the account. The rest of
              their details come from it.
            </Text>

            <Field
              label="Applicant ID"
              required
              value={code}
              onChangeText={(text) => setCode(text.toUpperCase())}
              placeholder="e.g. APP-2026-000123"
              autoCapitalize="characters"
              autoCorrect={false}
              error={errors.code}
            />
            <Field
              label="Email"
              required
              value={email}
              onChangeText={setEmail}
              placeholder="The address on the application"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
            />

            {failure ? <Banner tone="danger">{failure}</Banner> : null}

            <Button label="Register for this program" onPress={enrol} loading={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}

/** "16 Oct 2026", as the rest of the app writes a date in a sentence. */
function longDate(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;
  return at.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink900 },
  none: { fontSize: 13, color: colors.ink500, lineHeight: 19 },
  row: { backgroundColor: colors.ink50, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: 12, color: colors.ink500 },
});
