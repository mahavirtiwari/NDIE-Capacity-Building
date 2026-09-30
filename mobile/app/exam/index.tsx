import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { me } from '../../src/api/endpoints';
import type { Enrolment } from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import {
  Button,
  Card,
  EmptyState,
  Loading,
  StatusPill,
  shortDateTime,
} from '../../src/components/ui';
import { colors, font, spacing } from '../../src/theme';

/**
 * Every written paper this candidate has, in one place.
 *
 * The desk for a single paper was only reachable from a button buried in an
 * enrolment card, so a candidate with an examination tomorrow had to remember
 * which batch it belonged to in order to find it. This lists them instead:
 * what is coming, what is open now, and what has already been sat.
 *
 * Built from the enrolments the applicant already has — an examination is a
 * property of being on a batch, not a thing of its own — so it asks the API
 * for nothing new.
 */
export default function Examinations() {
  const router = useRouter();
  const enrolments = useResource<Enrolment[]>(() => me.enrolments(), []);

  /* Coming back from a paper should show the new result. The first focus is
     skipped because the resource already loads on mount. */
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      enrolments.refresh();
    }, [enrolments.refresh]),
  );

  /* Only an enrolment with a paper behind it. A batch whose examination has
     not been scheduled has nothing to show and nothing to open, and listing
     it as an examination would be a promise the screen cannot keep. */
  const { upcoming, sat } = useMemo(() => {
    const mine = (enrolments.data ?? []).filter(
      (row) => !!row.examDateTime || row.result === 'Pass' || row.result === 'Fail',
    );

    const when = (row: Enrolment) => new Date(row.examDateTime ?? row.endDate).getTime();

    return {
      /* Soonest first: the one that has not happened yet is the one being
         looked for. */
      upcoming: mine
        .filter((row) => row.result !== 'Pass' && row.result !== 'Fail')
        .sort((a, b) => when(a) - when(b)),
      /* Most recent first, as a record rather than a plan. */
      sat: mine
        .filter((row) => row.result === 'Pass' || row.result === 'Fail')
        .sort((a, b) => when(b) - when(a)),
    };
  }, [enrolments.data]);

  if (enrolments.loading) return <Loading label="Loading your examinations…" />;

  if (upcoming.length === 0 && sat.length === 0) {
    return (
      <EmptyState
        icon="document-text-outline"
        title="No examinations yet"
        message="An examination appears here once one has been scheduled for a batch you are on."
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={enrolments.refreshing} onRefresh={enrolments.refresh} />
      }
    >
      {upcoming.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>To sit</Text>
          {upcoming.map((row) => (
            <ExamRow
              key={row.participantId}
              enrolment={row}
              onOpen={() => router.push(`/exam/${row.participantId}`)}
            />
          ))}
        </View>
      ) : null}

      {sat.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Sat</Text>
          {sat.map((row) => (
            <ExamRow
              key={row.participantId}
              enrolment={row}
              onOpen={() => router.push(`/exam/${row.participantId}`)}
            />
          ))}
        </View>
      ) : null}

      <Text style={styles.note}>
        Whether a paper can be opened — the window, the attempts left — is decided when you
        open it, so what you see here is never out of step with what the examination allows.
      </Text>
    </ScrollView>
  );
}

function ExamRow({
  enrolment,
  onOpen,
}: {
  enrolment: Enrolment;
  onOpen: () => void;
}) {
  const decided = enrolment.result === 'Pass' || enrolment.result === 'Fail';

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={2}>
          {enrolment.programmeName}
        </Text>
        <StatusPill value={decided ? enrolment.result : 'Scheduled'} />
      </View>

      {/* A paper already sat needs no date to look forward to, and saying
          none was set reads as though something went missing. */}
      {enrolment.examDateTime || !decided ? (
        <View style={styles.line}>
          <Ionicons name="calendar-outline" size={14} color={colors.ink500} />
          <Text style={styles.lineText}>
            {enrolment.examDateTime
              ? shortDateTime(enrolment.examDateTime)
              : 'No date has been set yet'}
          </Text>
        </View>
      ) : null}

      {enrolment.examScore !== null && enrolment.examScore !== undefined ? (
        <View style={styles.line}>
          <Ionicons name="ribbon-outline" size={14} color={colors.ink500} />
          <Text style={styles.lineText}>{`Scored ${enrolment.examScore}`}</Text>
        </View>
      ) : null}

      <Button
        label={decided ? 'View the paper' : 'Open the examination'}
        variant={decided ? 'secondary' : 'primary'}
        icon={decided ? 'eye-outline' : 'arrow-forward'}
        onPress={onOpen}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  group: { gap: spacing.sm },
  groupTitle: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.ink500,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  card: { gap: spacing.sm, backgroundColor: colors.brand50, borderColor: colors.brand100 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand100,
    paddingBottom: spacing.sm,
  },
  title: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },

  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineText: { flex: 1, fontSize: font.sm, color: colors.ink600 },

  note: { fontSize: font.xs, color: colors.ink500, lineHeight: 17, textAlign: 'center' },
});
