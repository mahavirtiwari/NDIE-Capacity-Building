import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../../src/api/client';
import { workshops } from '../../../../src/api/endpoints';
import {
  Banner,
  Button,
  Card,
  DetailRow,
  Field,
  KeyboardAvoider,
  Loading,
} from '../../../../src/components/ui';
import { colors, radius, spacing } from '../../../../src/theme';
import { useWorkshop } from '../../../../src/workshop/WorkshopContext';

/**
 * Tab 3: final submission, which seals the workshop.
 *
 * The button is disabled until the server's own blocker list is empty, and the
 * confirmation spells out that this cannot be undone — because it cannot, by
 * anyone, including the back office.
 */
export default function FinalSubmission() {
  const router = useRouter();
  const { id, detail, loading, refresh, locked } = useWorkshop();

  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (loading && !detail) return <Loading label="Loading workshop…" />;

  const p = detail?.progress;
  const blockers = p?.blockers ?? [];

  const submit = () => {
    Alert.alert(
      'Submit finally?',
      'Once submitted, nothing on this workshop can be changed — not from this app and not from the back office. Make sure every photo and every name is right.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Submit',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setFailure(null);
            try {
              await workshops.submit(id, remarks.trim() || undefined);
              await refresh();
              Alert.alert('Submitted', 'This workshop is now sealed.', [
                { text: 'OK', onPress: () => router.replace('/workshops') },
              ]);
            } catch (caught) {
              setFailure(caught instanceof ApiError ? caught.message : 'Could not submit.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (locked) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Banner tone="success">
          Finally submitted{detail?.submittedOn ? ` on ${new Date(detail.submittedOn).toLocaleString('en-IN')}` : ''}.
        </Banner>
        <Card style={styles.card}>
          <DetailRow label="Trainers" value={String(p?.trainerCount ?? 0)} />
          <DetailRow label="Sessions" value={String(p?.sessionCount ?? 0)} />
          <DetailRow label="Participants" value={String(p?.participantCount ?? 0)} />
          <DetailRow label="Present" value={String(p?.presentCount ?? 0)} />
          <DetailRow label="Photos" value={String(p?.photoCount ?? 0)} />
        </Card>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoider>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Check the record before sealing it. Nothing can be edited afterwards.
        </Text>

        <Card style={styles.card}>
          <DetailRow label="Venue" value={p?.venueRegistered ? 'Registered' : 'Missing'} />
          <DetailRow label="Geo-tag" value={p?.venueGeoTagged ? 'Captured' : 'Missing'} />
          <DetailRow
            label="Venue photos"
            value={`${[p?.venueExteriorPhoto, p?.venueInteriorPhoto].filter(Boolean).length} of 2`}
          />
          <DetailRow label="Trainers" value={String(p?.trainerCount ?? 0)} />
          <DetailRow label="Sessions" value={String(p?.sessionCount ?? 0)} />
          <DetailRow label="Participants" value={String(p?.participantCount ?? 0)} />
          <DetailRow
            label="Attendance"
            value={`${p?.attendanceMarkedCount ?? 0} marked · ${p?.presentCount ?? 0} present`}
          />
          <DetailRow label="Signed sheets" value={String(p?.attendanceSheetCount ?? 0)} />
          <DetailRow label="Feedback" value={`${p?.feedbackCount ?? 0} given (optional)`} />
        </Card>

        {blockers.length > 0 ? (
          <View style={styles.blockers}>
            <Text style={styles.blockersTitle}>Still to do</Text>
            {blockers.map((item) => (
              <Text key={item} style={styles.blocker}>
                • {item}
              </Text>
            ))}
          </View>
        ) : (
          <Banner tone="success">Everything required has been captured.</Banner>
        )}

        <Field
          label="Remarks"
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Anything the reviewer should know (optional)"
          multiline
        />

        {failure ? <Banner tone="danger">{failure}</Banner> : null}

        <Button
          label="Submit finally"
          onPress={submit}
          loading={busy}
          disabled={blockers.length > 0}
          variant="danger"
        />
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  lead: { color: colors.ink600, fontSize: 13 },
  card: { gap: spacing.xs },
  blockers: {
    backgroundColor: colors.warning50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning700,
    padding: spacing.lg,
    gap: 4,
  },
  blockersTitle: { fontWeight: '700', color: colors.warning700, marginBottom: 2 },
  blocker: { color: colors.ink700, fontSize: 13 },
});
