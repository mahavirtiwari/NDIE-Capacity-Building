import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../../src/api/client';
import { me } from '../../src/api/endpoints';
import type {
  ApplicantProgram,
  Application,
  FeeStructure,
  RegistrationForm,
} from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import { DynamicFormView, useDynamicForm } from '../../src/components/DynamicForm';
import { Picker } from '../../src/components/Picker';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Loading,
  StatusPill,
  inr,
  shortDate,
} from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';
import { isTan } from '../../src/validation/formats';

/**
 * The applicant-facing counterpart of the Super Admin form designer: whatever
 * fields were enabled for this program type are rendered, validated and posted.
 */
export default function Apply() {
  const router = useRouter();
  const params = useLocalSearchParams<{ programTypeId: string }>();
  const programTypeId = Number(params.programTypeId);

  const programs = useResource<ApplicantProgram[]>(() => me.programs(), []);
  /* Fetched regardless, because whether the track wants one is only known
     once the programme list arrives, and a second round of hooks keyed on
     that would change the hook order between renders. An error is tolerated
     below where the track needs no form. */
  const form = useResource<RegistrationForm>(() => me.form(programTypeId), [programTypeId]);
  const fee = useResource<FeeStructure | null>(() => me.fee(programTypeId), [programTypeId]);

  const program = useMemo(
    () => (programs.data ?? []).find((item) => item.programTypeId === programTypeId) ?? null,
    [programs.data, programTypeId],
  );

  const state = useDynamicForm(form.data);

  /* A rejection is not a dead end: the applicant fixes what was wrong and
     sends the same application again. Their own applications carry the
     answers and the scrutiny trail, so nothing extra is asked of the API. */
  const applications = useResource<Application[]>(() => me.applications(), []);

  const rejected = useMemo(() => {
    const mine = (applications.data ?? []).filter(
      (item) => item.programTypeId === programTypeId && item.status === 'Rejected',
    );
    return mine[0] ?? null;
  }, [applications.data, programTypeId]);

  /* Seeded once the form definition has arrived, and once only — typing over
     a prefilled answer must not be undone by a re-render. */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !form.data || !rejected) return;
    seeded.current = true;

    state.prefill(rejected.responses ?? {});
    setTds(String(rejected.tdsPercent ?? 0));
    setTan(rejected.tan ?? '');
    setDeductor(rejected.deductorName ?? '');
  }, [form.data, rejected, state]);

  const [historyOpen, setHistoryOpen] = useState(false);

  /* TDS is the applicant's own declaration; a deduction needs their TAN. */
  const [tds, setTds] = useState('0');
  const [tan, setTan] = useState('');
  const [deductor, setDeductor] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tdsOptions = useMemo(() => {
    const available = fee.data?.tdsOptions?.length
      ? fee.data.tdsOptions
      : (program?.tdsOptions ?? []);
    return [
      { value: '0', label: 'No TDS deduction' },
      ...available
        .filter((percent) => percent > 0)
        .map((percent) => ({ value: String(percent), label: `${percent}% TDS` })),
    ];
  }, [fee.data, program]);

  const tdsPercent = Number(tds) || 0;
  const gross = fee.data?.totals.gross ?? program?.feePayable ?? 0;
  const deduction = Math.round(((gross * tdsPercent) / 100) * 100) / 100;

  if (form.loading || programs.loading) return <Loading label="Loading the form…" />;

  /* Some tracks ask nothing: no registration form, and no scrutiny either.
     Applying to one is a declaration and a tap, so a missing form is the
     expected state rather than a fault. */
  const needsForm = program?.requiresRegistrationForm !== false;

  if (needsForm && (form.error || !form.data)) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Form unavailable"
        message={form.error ?? 'No registration form has been published for this program yet.'}
      />
    );
  }

  const submit = async () => {
    if (needsForm && !state.validate()) {
      setError('Please correct the highlighted fields.');
      return;
    }
    if (tdsPercent > 0 && !isTan(tan)) {
      setError('A TDS deduction needs a valid 10 character TAN.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const application = await me.submit({
        programTypeId,
        responses: needsForm ? state.payload() : {},
        tdsPercent,
        tan: tdsPercent > 0 ? tan.trim().toUpperCase() : null,
        deductorName: tdsPercent > 0 ? deductor.trim() || null : null,
      });

      Alert.alert(
        'Application submitted',
        `Your application number is ${application.applicationNo}. You can track its progress under Applications.`,
        [{ text: 'View application', onPress: () => router.replace(`/application/${application.id}`) }],
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not submit your application.');
    } finally {
      setSubmitting(false);
    }
  };

  /* A live application closes this screen. A rejected one does not — the
     applicant is allowed to fix what was wrong and apply again, and the
     form they need is this one. */
  const alreadyApplied = !!program && program.canApply === false
    && !!program.existingApplicationStatus;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <Stack.Screen options={{ title: program?.name ?? 'Apply' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {program ? (
          <Card style={styles.summary}>
            <Text style={styles.programName}>{program.name}</Text>
            <Text style={styles.programCode}>{program.code}</Text>
            <View style={styles.chips}>
              <Chip>{`${program.durationDays} days`}</Chip>
              <Chip>{program.deliveryMode}</Chip>
              {program.isExamMandatory ? <Chip>Exam</Chip> : null}
              {form.data ? <Chip>{`Form v${form.data.version}`}</Chip> : null}
            </View>
          </Card>
        ) : null}

        {!alreadyApplied && rejected ? (
          <Card style={styles.card}>
            <View style={styles.appliedRow}>
              <StatusPill value="Rejected" />
              <Text style={styles.appliedNo}>{rejected.applicationNo}</Text>
            </View>

            <Text style={styles.sectionTitle}>Correcting your application</Text>
            <Text style={styles.appliedNote}>
              Your previous answers are filled in below. Change what needs changing and send
              it again — this goes in as a new application.
            </Text>

            {rejected.rejectionReasonLabel ? (
              <Banner tone="warning">{rejected.rejectionReasonLabel}</Banner>
            ) : null}

            <Button
              label="What scrutiny said"
              variant="secondary"
              icon="time-outline"
              onPress={() => setHistoryOpen(true)}
            />
          </Card>
        ) : null}

        {alreadyApplied ? (
          /* Not a disabled form with a warning over it: there is nothing to
             fill in here and nothing that could be submitted. Say where the
             application is and give a way to it. */
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>You have already applied</Text>
            <View style={styles.appliedRow}>
              <StatusPill value={program!.existingApplicationStatus!} />
              {program!.existingApplicationNo ? (
                <Text style={styles.appliedNo}>{program!.existingApplicationNo}</Text>
              ) : null}
            </View>
            <Text style={styles.appliedNote}>
              You will be emailed as soon as scrutiny reaches a decision.
            </Text>
            {program!.existingApplicationId ? (
              <Button
                label="Open the application"
                icon="arrow-forward"
                onPress={() => router.replace(`/application/${program!.existingApplicationId}`)}
              />
            ) : null}
            <Button label="Back to programs" variant="secondary" onPress={() => router.back()} />
          </Card>
        ) : null}

        {alreadyApplied ? null : needsForm && form.data ? (
          <DynamicFormView form={form.data} state={state} />
        ) : (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Application</Text>
            <Text style={styles.muted}>
              This programme asks for no registration form. Confirm the fee below and submit —
              your application is accepted straight away, with no scrutiny to wait for.
            </Text>
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Fee and tax</Text>

          {fee.data ? (
            <View style={styles.feeBox}>
              {fee.data.components.map((component) => (
                <FeeLine key={component.id} label={component.label} amount={component.amount} />
              ))}
              {fee.data.totals.gst > 0 ? (
                <FeeLine label={`GST ${fee.data.gstPercent}%`} amount={fee.data.totals.gst} />
              ) : null}
              <View style={styles.feeDivider} />
              <FeeLine label="Total payable" amount={fee.data.totals.gross} strong />
            </View>
          ) : (
            <Text style={styles.muted}>
              {gross > 0
                ? `Fee payable: ${inr(gross)}`
                : 'No fee has been configured for this program.'}
            </Text>
          )}

          {tdsOptions.length > 1 ? (
            <>
              <Picker
                label="TDS deduction"
                value={tds}
                options={tdsOptions}
                onChange={setTds}
                hint="Select a rate only if you are deducting tax at source."
              />

              {tdsPercent > 0 ? (
                <>
                  <Field
                    label="TAN"
                    required
                    value={tan}
                    onChangeText={(text) => setTan(text.toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={10}
                    placeholder="DELA12345B"
                    hint="The TAN of the organisation making the deduction."
                  />
                  <Field
                    label="Deductor name"
                    value={deductor}
                    onChangeText={setDeductor}
                    placeholder="Organisation deducting the tax"
                  />

                  <View style={styles.tdsSummary}>
                    <Ionicons name="calculator-outline" size={16} color={colors.brand700} />
                    <Text style={styles.tdsText}>
                      {`${tdsPercent}% of ${inr(gross)} = ${inr(deduction)} deducted; ${inr(gross - deduction)} payable now.`}
                    </Text>
                  </View>
                </>
              ) : null}
            </>
          ) : null}
        </Card>

        {error ? <Banner tone="danger">{error}</Banner> : null}

        <Button
          label={submitting ? 'Submitting…' : 'Submit application'}
          icon="send"
          onPress={submit}
          loading={submitting}
          disabled={alreadyApplied}
        />

        <Text style={styles.disclaimer}>
          By submitting you confirm that the information above is correct. Scrutiny is carried out
          by the implementing agency and you will be notified by email.
        </Text>
      </ScrollView>

      {historyOpen && rejected ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setHistoryOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setHistoryOpen(false)}>
            <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>{rejected.applicationNo}</Text>
                <Pressable
                  onPress={() => setHistoryOpen(false)}
                  accessibilityLabel="Close"
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color={colors.ink600} />
                </Pressable>
              </View>

              <ScrollView style={styles.sheetScroll}>
                {rejected.history.length === 0 ? (
                  <Text style={styles.appliedNote}>Nothing was recorded against it.</Text>
                ) : (
                  rejected.history.map((event, index) => (
                    <View key={event.id} style={styles.event}>
                      <View style={styles.eventRail}>
                        <View style={styles.eventDot} />
                        {index < rejected.history.length - 1 ? (
                          <View style={styles.eventLine} />
                        ) : null}
                      </View>
                      <View style={styles.eventBody}>
                        <Text style={styles.eventAction}>{event.action}</Text>
                        <Text style={styles.eventMeta}>
                          {`${event.byUserName} · ${shortDate(event.on)}`}
                        </Text>
                        {event.rejectionReasonLabel ? (
                          <Text style={styles.eventReason}>{event.rejectionReasonLabel}</Text>
                        ) : null}
                        {event.remarks ? (
                          <Text style={styles.eventRemarks}>{event.remarks}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              <Button
                label="Close"
                variant="secondary"
                onPress={() => setHistoryOpen(false)}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function FeeLine({
  label,
  amount,
  strong,
}: {
  label: string;
  amount: number;
  strong?: boolean;
}) {
  return (
    <View style={styles.feeLine}>
      <Text style={[styles.feeLabel, strong && styles.feeStrong]}>{label}</Text>
      <Text style={[styles.feeAmount, strong && styles.feeStrong]}>{inr(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  summary: { gap: 4 },
  programName: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  programCode: { fontSize: font.xs, color: colors.ink500, letterSpacing: 0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs },

  card: { gap: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  appliedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  appliedNo: { fontSize: font.sm, fontWeight: '600', color: colors.ink700 },
  appliedNote: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '80%',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  sheetScroll: { flexGrow: 0 },

  event: { flexDirection: 'row', gap: spacing.md },
  eventRail: { alignItems: 'center', width: 14 },
  eventDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.brand600,
    marginTop: 5,
  },
  eventLine: { flex: 1, width: 1, backgroundColor: colors.border, marginVertical: 3 },
  eventBody: { flex: 1, paddingBottom: spacing.md, gap: 1 },
  eventAction: { fontSize: font.sm, fontWeight: '700', color: colors.ink900 },
  eventMeta: { fontSize: font.xs, color: colors.ink500 },
  eventReason: { fontSize: font.sm, color: colors.danger700, marginTop: 2 },
  eventRemarks: { fontSize: font.sm, color: colors.ink600, lineHeight: 18, marginTop: 2 },
  muted: { fontSize: font.sm, color: colors.ink500 },

  feeBox: {
    backgroundColor: colors.ink50,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
  },
  feeLine: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  feeLabel: { fontSize: font.sm, color: colors.ink600, flex: 1 },
  feeAmount: { fontSize: font.sm, color: colors.ink900, fontWeight: '500' },
  feeStrong: { fontWeight: '700', color: colors.ink900 },
  feeDivider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },

  tdsSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.brand50,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  tdsText: { flex: 1, fontSize: font.sm, color: colors.brand700, lineHeight: 19 },

  disclaimer: { fontSize: font.xs, color: colors.ink500, lineHeight: 17, textAlign: 'center' },
});
