import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { me } from '../../src/api/endpoints';
import type { Application, RegistrationForm } from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import {
  Banner,
  Button,
  Card,
  Chip,
  DetailRow,
  EmptyState,
  Loading,
  StatusPill,
  inr,
  shortDate,
} from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/** One submitted application: the answers given, the fee, and the audit trail. */
export default function ApplicationDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const applications = useResource<Application[]>(() => me.applications(), []);
  const application = useMemo(
    () => (applications.data ?? []).find((item) => item.id === id) ?? null,
    [applications.data, id],
  );

  /* The form definition supplies the labels for the stored answer keys. */
  const form = useResource<RegistrationForm | null>(
    () => (application ? me.form(application.programTypeId) : Promise.resolve(null)),
    [application?.programTypeId],
  );

  const answers = useMemo(() => {
    if (!application) return [];
    const labels = new Map<string, string>();
    for (const section of form.data?.sections ?? []) {
      for (const field of section.fields) labels.set(field.key, field.label);
    }
    return Object.entries(application.responses)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => ({
        key,
        label: labels.get(key) ?? humanise(key),
        value: display(value),
      }));
  }, [application, form.data]);

  if (applications.loading) return <Loading />;

  if (!application) {
    return (
      <EmptyState
        icon="document-outline"
        title="Application not found"
        message={applications.error ?? 'It may have been withdrawn.'}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={applications.refreshing} onRefresh={applications.refresh} />
      }
    >
      <Stack.Screen options={{ title: application.applicationNo }} />

      <Card style={styles.card}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={styles.title}>{application.programTypeName ?? 'Programme'}</Text>
            <Text style={styles.code}>{application.applicationNo}</Text>
          </View>
          <StatusPill value={application.status} />
        </View>

        <View style={styles.details}>
          <DetailRow label="Category" value={application.categoryName ?? '—'} />
          <DetailRow label="Sub-category" value={application.subCategoryName ?? '—'} />
          <DetailRow label="Submitted" value={shortDate(application.submittedOn)} />
          <DetailRow
            label="Payment"
            value={<StatusPill value={application.paymentStatus} />}
          />
          <DetailRow
            label="Fee"
            value={application.feeAmount > 0 ? inr(application.feeAmount) : 'Free'}
          />
          {application.tdsPercent > 0 ? (
            <DetailRow
              label="TDS"
              value={`${application.tdsPercent}%${application.tan ? ` · TAN ${application.tan}` : ''}`}
            />
          ) : null}
          {application.score !== null && application.score !== undefined ? (
            <DetailRow label="Score" value={String(application.score)} />
          ) : null}
        </View>

        {/* The fee is shown here, so this is where somebody looking at an
            unpaid one will reach for a way to settle it. */}
        {application.feeAmount > 0 &&
        (application.paymentStatus === 'Pending' || application.paymentStatus === 'Failed') ? (
          <Button
            label={application.paymentStatus === 'Failed' ? 'Try the payment again' : 'Pay the fee'}
            icon="card-outline"
            onPress={() => router.push(`/payment/${application.id}`)}
            style={styles.payButton}
          />
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Your answers</Text>
        {form.loading ? (
          <Text style={styles.muted}>Loading labels…</Text>
        ) : answers.length === 0 ? (
          <Text style={styles.muted}>No answers were recorded.</Text>
        ) : (
          <View style={styles.details}>
            {answers.map((answer) => (
              <DetailRow key={answer.key} label={answer.label} value={answer.value} />
            ))}
          </View>
        )}
      </Card>

      {application.documents.length > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Documents</Text>
          {application.documents.map((document) => (
            <View key={document.id} style={styles.document}>
              <Ionicons name="document-attach-outline" size={18} color={colors.brand700} />
              <View style={styles.documentText}>
                <Text style={styles.documentLabel}>{document.label}</Text>
                <Text style={styles.documentMeta}>
                  {`${document.fileName} · ${document.fileSizeKb} KB`}
                </Text>
              </View>
              <Chip>{document.verified ? 'Verified' : 'Pending'}</Chip>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Progress</Text>
        {application.history.length === 0 ? (
          <Banner tone="info">
            Nothing has happened yet. You will be emailed as soon as scrutiny begins.
          </Banner>
        ) : (
          <View style={styles.timeline}>
            {application.history.map((event, index) => (
              <View key={event.id} style={styles.event}>
                <View style={styles.eventRail}>
                  <View style={styles.eventDot} />
                  {index < application.history.length - 1 ? <View style={styles.eventLine} /> : null}
                </View>
                <View style={styles.eventBody}>
                  <Text style={styles.eventAction}>{event.action}</Text>
                  <Text style={styles.eventMeta}>
                    {`${event.byUserName} · ${event.byRole} · ${shortDate(event.on)}`}
                  </Text>
                  {event.remarks ? <Text style={styles.eventRemarks}>{event.remarks}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const humanise = (key: string): string =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());

const display = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const styles = StyleSheet.create({
  payButton: { marginTop: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headText: { flex: 1, gap: 2 },
  title: { fontSize: font.md, fontWeight: '700', color: colors.ink900, lineHeight: 21 },
  code: { fontSize: font.xs, color: colors.ink500, letterSpacing: 0.4 },

  details: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  muted: { fontSize: font.sm, color: colors.ink500 },

  document: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  documentText: { flex: 1, gap: 1 },
  documentLabel: { fontSize: font.sm, fontWeight: '600', color: colors.ink900 },
  documentMeta: { fontSize: font.xs, color: colors.ink500 },

  timeline: { gap: 0 },
  event: { flexDirection: 'row', gap: spacing.md },
  eventRail: { width: 12, alignItems: 'center' },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand600,
    marginTop: 5,
  },
  eventLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  eventBody: { flex: 1, paddingBottom: spacing.md, gap: 2 },
  eventAction: { fontSize: font.sm, fontWeight: '700', color: colors.ink900 },
  eventMeta: { fontSize: font.xs, color: colors.ink500 },
  eventRemarks: {
    fontSize: font.xs,
    color: colors.ink700,
    backgroundColor: colors.ink50,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: 4,
    lineHeight: 17,
  },
});
