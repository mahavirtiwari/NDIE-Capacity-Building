import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../src/api/client';
import { me } from '../src/api/endpoints';
import type { ProfileForm, ProfileSection, ProfileStanding } from '../src/api/types';
import { useResource } from '../src/api/useResource';
import {
  DynamicSectionView,
  statusLabelFor,
  useDynamicForm,
  type SectionProgress,
  type SectionStatus,
} from '../src/components/DynamicForm';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Loading,
  StatusPill,
  shortDate,
} from '../src/components/ui';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * The first thing an applicant does, and the gate in front of everything
 * else.
 *
 * They declare who they are once, for the discipline they registered under,
 * and it goes to scrutiny. Until it comes back accepted there are no
 * programs to look at — so this screen has to be able to say, on its own,
 * exactly where they stand: waiting, turned down and why, how many tries
 * are left, or shut out until a date.
 *
 * The form is the same section-at-a-time flow as applying, because it is
 * the same kind of form and an applicant should not have to learn two.
 */
export default function ProfileFormScreen() {
  const router = useRouter();

  const standing = useResource<ProfileStanding>(() => me.profileStanding(), []);
  const form = useResource<ProfileForm>(() => me.profileForm(), []);

  const state = useDynamicForm(form.data);

  const sections = useMemo(
    () =>
      (form.data?.sections ?? [])
        .filter((s) => s.isEnabled && s.fields.some((f) => f.isEnabled))
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [form.data],
  );

  /* What they said last time, put back so a correction starts from it
     rather than from an empty form. Once only: typing over a prefilled
     answer must not be undone by a re-render. */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !form.data || !standing.data?.responses) return;
    seeded.current = true;
    state.prefill(standing.data.responses);
  }, [form.data, standing.data, state]);

  useFocusEffect(
    useCallback(() => {
      standing.refresh();
    }, [standing.refresh]),
  );

  const [openId, setOpenId] = useState<number | null>(null);
  const open = useMemo(() => sections.find((s) => s.id === openId) ?? null, [sections, openId]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const backToSections = useCallback(() => {
    setSectionError(null);
    setOpenId(null);
  }, []);

  const screenOptions = useMemo(
    () => ({
      title: open ? open.title : 'Your profile',
      headerLeft: open
        ? () => (
            <Pressable
              onPress={backToSections}
              accessibilityRole="button"
              accessibilityLabel="Back to sections"
              hitSlop={10}
            >
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </Pressable>
          )
        : undefined,
    }),
    [open, backToSections],
  );

  if (standing.loading) return <Loading label="Checking your profile…" />;

  /* Without this the screen fell through to "tell us who you are" when the
     standing could not be loaded at all — an empty form offered to somebody
     whose session had expired, which would have been sent and refused. */
  if (!standing.data) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Could not load your profile"
        message={standing.error ?? 'Pull down to try again.'}
      />
    );
  }

  const where = standing.data;

  /* Nothing to fill in: this discipline asks for no profile form, so the
     programs were never behind it. */
  if (where && !where.required) {
    return (
      <EmptyState
        icon="checkmark-circle-outline"
        title="No profile form needed"
        message="Your sub-category does not ask for one. The programs open to you are under Dashboard."
      />
    );
  }

  const submit = async () => {
    if (!state.validate()) {
      setError('Something is still missing. Check whatever is marked in red.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await me.submitProfile(state.payload());
      standing.refresh();
      Alert.alert(
        'Profile sent',
        'Your profile has gone for scrutiny. You will be told the outcome, and the programs '
          + 'open to you will appear once it is accepted.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/programs') }],
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send your profile.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------------------------- one section, alone */

  if (open) {
    const at = sections.indexOf(open);
    const next = sections[at + 1] ?? null;

    const keep = () => {
      if (!state.validateSection(open)) {
        setSectionError('Please correct the highlighted fields before moving on.');
        return;
      }
      setError(null);
      setSectionError(null);
      setOpenId(next ? next.id : null);
    };

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Stack.Screen options={screenOptions} />

        <ScrollView
          key={`section-${open.id}`}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepRow}>
            <Text style={styles.stepText}>{`Section ${at + 1} of ${sections.length}`}</Text>
            <StatusChip status={state.progressOf(open).status} />
          </View>

          <DynamicSectionView section={open} state={state} />

          {sectionError ? <Banner tone="danger">{sectionError}</Banner> : null}

          <Button
            label={next ? 'Save and continue' : 'Save and finish'}
            icon={next ? 'arrow-forward' : 'checkmark'}
            onPress={keep}
          />
          <Button label="Back to sections" variant="secondary" onPress={backToSections} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  /* ------------------------------------------------------ where they are */

  const completed = sections.filter((s) => state.progressOf(s).status === 'done').length;
  const blocked = !!where?.blockedUntil;
  const waiting = where?.status === 'Submitted' || where?.status === 'UnderScrutiny';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <Stack.Screen options={screenOptions} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>{where?.subCategoryName ?? 'Your profile'}</Text>
            {where?.status ? <StatusPill value={where.status} /> : null}
          </View>

          {blocked ? (
            <>
              <Banner tone="danger">
                {`Your profile was turned down ${where!.attemptsAllowed} times. You can try `
                  + `again after ${shortDate(where!.blockedUntil)}.`}
              </Banner>
              {where!.blockReason ? (
                <Text style={styles.note}>{`Last reason: ${where!.blockReason}`}</Text>
              ) : null}
            </>
          ) : waiting ? (
            <Banner tone="info">
              Your profile is with scrutiny. You will be told the outcome, and the programs open
              to you will appear here once it is accepted.
            </Banner>
          ) : where?.cleared ? (
            <Banner tone="success">
              Your profile has been accepted. The programs open to you are under Dashboard.
            </Banner>
          ) : where?.status === 'Rejected' ? (
            <>
              <Banner tone="warning">
                {where.rejectionReasonLabel ?? 'Your profile was turned down.'}
              </Banner>
              {where.remarks ? <Text style={styles.note}>{where.remarks}</Text> : null}
              <Text style={styles.note}>
                {`Your answers are filled in below. Correct what was wrong and send it again — `
                  + `${where.attemptsLeft} `
                  + `${where.attemptsLeft === 1 ? 'try' : 'tries'} left.`}
              </Text>
            </>
          ) : (
            <Text style={styles.note}>
              Tell us who you are. This is asked once for your sub-category, and once it has been
              accepted every program under it opens to you.
            </Text>
          )}
        </Card>

        {where?.cleared || blocked ? (
          <Button
            label="Back to programs"
            variant="secondary"
            onPress={() => router.replace('/(tabs)/programs')}
          />
        ) : null}

        {where?.canSubmit && form.data && sections.length > 0 ? (
          <>
            <Card style={styles.card}>
              <Text style={styles.sectionTitle}>The form</Text>
              <Text style={styles.muted}>
                {`${completed} of ${sections.length} sections completed. Open a section to fill `
                  + `it in.`}
              </Text>

              <View style={styles.track}>
                <View style={[styles.trackFill, { flex: completed }]} />
                <View style={{ flex: Math.max(sections.length - completed, 0) }} />
              </View>

              <View style={styles.list}>
                {sections.map((section, index) => (
                  <SectionRow
                    key={section.id}
                    index={index}
                    section={section}
                    progress={state.progressOf(section)}
                    onPress={() => {
                      setSectionError(null);
                      setOpenId(section.id);
                    }}
                  />
                ))}
              </View>
            </Card>

            {error ? <Banner tone="danger">{error}</Banner> : null}

            <Button
              label={submitting ? 'Sending…' : 'Send for scrutiny'}
              icon="send"
              onPress={submit}
              loading={submitting}
            />
          </>
        ) : null}

        {where && where.history.length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>What happened</Text>
            {where.history.map((event, index) => (
              <View key={event.id} style={styles.event}>
                <View style={styles.eventRail}>
                  <View style={styles.eventDot} />
                  {index < where.history.length - 1 ? <View style={styles.eventLine} /> : null}
                </View>
                <View style={styles.eventBody}>
                  <Text style={styles.eventAction}>{event.action}</Text>
                  <Text style={styles.eventMeta}>
                    {`${event.byUserName} · ${shortDate(event.on)}`}
                  </Text>
                  {event.rejectionReasonLabel ? (
                    <Text style={styles.eventReason}>{event.rejectionReasonLabel}</Text>
                  ) : null}
                  {event.remarks ? <Text style={styles.eventRemarks}>{event.remarks}</Text> : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------- the list */

const statusTone: Record<SectionStatus, { bg: string; fg: string }> = {
  done: { bg: colors.success50, fg: colors.success700 },
  progress: { bg: colors.warning50, fg: colors.warning700 },
  pending: { bg: colors.ink100, fg: colors.ink500 },
};

function StatusChip({ status }: { status: SectionStatus }) {
  const tone = statusTone[status];
  return (
    <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusText, { color: tone.fg }]}>{statusLabelFor(status)}</Text>
    </View>
  );
}

function SectionRow({
  index,
  section,
  progress,
  onPress,
}: {
  index: number;
  section: ProfileSection;
  progress: SectionProgress;
  onPress: () => void;
}) {
  const tone = statusTone[progress.status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${section.title}, ${statusLabelFor(progress.status)}`}
      style={({ pressed }) => [
        styles.row,
        progress.wrong > 0 && styles.rowWrong,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
        {progress.status === 'done' ? (
          <Ionicons name="checkmark" size={16} color={tone.fg} />
        ) : (
          <Text style={[styles.rowNumber, { color: tone.fg }]}>{index + 1}</Text>
        )}
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{section.title}</Text>
        <View style={styles.rowStanding}>
          <StatusChip status={progress.status} />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.ink400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  card: { gap: spacing.sm },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  note: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },
  muted: { fontSize: font.sm, color: colors.ink500 },

  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepText: { fontSize: font.sm, fontWeight: '600', color: colors.ink600 },

  track: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.ink200,
    overflow: 'hidden',
  },
  trackFill: { backgroundColor: colors.brand600 },

  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.brand50,
    borderWidth: 1,
    borderColor: colors.brand100,
    borderRadius: radius.md,
  },
  rowPressed: { backgroundColor: colors.brand100 },
  rowWrong: { borderColor: colors.danger500, backgroundColor: colors.danger50 },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowNumber: { fontSize: font.sm, fontWeight: '700' },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: font.sm, fontWeight: '700', color: colors.ink900 },
  rowStanding: { flexDirection: 'row', alignItems: 'center' },

  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  statusText: { fontSize: font.xs, fontWeight: '700' },

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
});
