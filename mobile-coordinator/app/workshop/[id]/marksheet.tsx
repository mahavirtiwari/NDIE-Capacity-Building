import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { marksheet as marksheetApi } from '../../../src/api/endpoints';
import type { Marksheet, MarksheetRow, MarksheetRowSave } from '../../../src/api/types';
import { Banner, Button, Card, EmptyState, Field, Loading, StatusPill } from '../../../src/components/ui';
import { Picker } from '../../../src/components/Picker';
import { useSiteText } from '../../../src/content/SiteTextContext';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * The trainer's marksheet, one candidate at a time.
 *
 * A viva is marked candidate by candidate, not as a grid, so the phone shows
 * the list and opens one sheet at a time — the same order the trainer works in,
 * with the skills in the order they were set up.
 *
 * No result is decided here. The marks go to the server, which works the result
 * out and sends the sheet back, so this screen and the portal can never
 * disagree about who passed. Offline the marks are queued like everything else
 * and the results catch up when the queue drains.
 */
export default function MarksheetScreen() {
  const { id } = useWorkshop();
  const words = useSiteText();

  const [sheet, setSheet] = useState<Marksheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<number | null>(null);

  const load = useCallback(async () => {
    setFailure(null);
    try {
      setSheet(await marksheetApi.get(id));
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not load the marksheet.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !sheet) return <Loading label="Loading the marksheet…" />;

  if (!sheet) {
    return (
      <EmptyState
        title="Marksheet unavailable"
        message={failure ?? 'Open this screen once with a signal and it will be there offline.'}
      />
    );
  }

  if (sheet.evaluation.kind === 'None') {
    return (
      <EmptyState
        title="Nothing to mark"
        message={`${sheet.programTypeName} has no examination, so there is no marksheet for it.`}
      />
    );
  }

  if (sheet.rows.length === 0) {
    return (
      <EmptyState
        title="Nobody enrolled"
        message="This program has no enrolled candidates to mark."
      />
    );
  }

  const scheme = sheet.evaluation;
  const editing = sheet.rows.find((row) => row.participantId === openFor) ?? null;

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        {failure ? <Banner tone="danger">{failure}</Banner> : null}
        {sheet.readOnlyReason ? <Banner tone="info">{sheet.readOnlyReason}</Banner> : null}

        {scheme.hasViva && sheet.skills.length === 0 ? (
          <Banner tone="warning">
            {words(
              'coordinator.marksheet.noSkills',
              'The viva has no skills set up yet, so it cannot be marked. They are added in the portal, under the program type.',
            )}
          </Banner>
        ) : null}

        <Card style={styles.summary}>
          <Text style={styles.summaryTitle}>{scheme.kindLabel}</Text>
          <Text style={styles.summaryText}>{pattern(sheet)}</Text>
          <Text style={styles.summaryCount}>
            {sheet.markedCount} of {sheet.rows.length} decided · {sheet.passCount} passed ·{' '}
            {sheet.failCount} did not qualify
          </Text>
        </Card>

        {sheet.rows.map((row) => (
          <Pressable
            key={row.participantId}
            style={styles.row}
            disabled={!sheet.canEdit || row.isLocked}
            onPress={() => setOpenFor(row.participantId)}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowName}>{row.name}</Text>
              <Text style={styles.rowMeta}>
                {row.applicationNo}
                {row.total != null ? ` · ${row.total} of ${scheme.totalMarks}` : ' · not marked'}
              </Text>
              {row.isLocked ? (
                <Text style={styles.rowNote}>
                  {words('marksheet.locked', 'Certificate issued — marks locked')}
                </Text>
              ) : row.pending ? (
                <Text style={styles.rowNote}>{row.pending}</Text>
              ) : row.shortfall ? (
                <Text style={styles.rowNote}>{row.shortfall}</Text>
              ) : null}
            </View>
            <StatusPill value={row.result} />
            {sheet.canEdit && !row.isLocked ? (
              <Ionicons name="chevron-forward" size={18} color={colors.ink400} />
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      <Modal
        visible={editing !== null}
        animationType="slide"
        onRequestClose={() => setOpenFor(null)}
      >
        {editing ? (
          <CandidateSheet
            programmeId={id}
            sheet={sheet}
            row={editing}
            onClose={() => setOpenFor(null)}
            onSaved={(saved) => {
              setSheet(saved);
              setOpenFor(null);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

/* --------------------------------------------------------- one candidate */

function CandidateSheet({
  programmeId,
  sheet,
  row,
  onClose,
  onSaved,
}: {
  programmeId: number;
  sheet: Marksheet;
  row: MarksheetRow;
  onClose: () => void;
  onSaved: (saved: Marksheet) => void;
}) {
  const scheme = sheet.evaluation;

  /* Seeded from what is recorded, so a correction starts from the mark that is
     being corrected rather than from blank. */
  const [written, setWritten] = useState(text(row.writtenMarks));
  const [skills, setSkills] = useState<Record<number, string>>(() =>
    Object.fromEntries(row.skillMarks.map((mark) => [mark.skillId, String(mark.marks)])),
  );
  const [trainerId, setTrainerId] = useState<number | null>(
    row.skillMarks.find((mark) => mark.trainerId)?.trainerId ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const problem = useMemo(() => {
    if (scheme.hasWritten && written !== '' && !within(written, scheme.writtenMarks)) {
      return `The written paper is marked out of ${scheme.writtenMarks}.`;
    }
    for (const skill of sheet.skills) {
      const value = skills[skill.id];
      if (value !== undefined && value !== '' && !within(value, skill.maxMarks)) {
        return `'${skill.name}' is marked out of ${skill.maxMarks}.`;
      }
    }
    return null;
  }, [written, skills, scheme, sheet.skills]);

  const vivaTotal = sheet.skills.reduce((sum, skill) => {
    const value = Number(skills[skill.id]);
    return Number.isFinite(value) && skills[skill.id] !== '' && skills[skill.id] !== undefined
      ? sum + value
      : sum;
  }, 0);

  const save = async () => {
    if (problem) return;
    setBusy(true);
    setFailure(null);

    const payload: MarksheetRowSave = {
      participantId: row.participantId,
      trainerId,
      /* Only sent when this program type has one: a sheet that never showed
         the written box must not wipe a mark it did not display. */
      /* Never sent when the paper decided it: the server refuses a typed-over
         exam score, and offering it here would only queue a refusal. */
      ...(scheme.hasWritten && !row.writtenFromExam
        ? { writtenMarks: written === '' ? null : Number(written) }
        : {}),
      skillMarks: sheet.skills
        .filter((skill) => !skill.isRetired && skills[skill.id] !== undefined)
        .map((skill) => ({
          skillId: skill.id,
          marks: skills[skill.id] === '' ? 0 : Number(skills[skill.id]),
          /* An emptied box takes the mark back rather than recording a zero. */
          clear: skills[skill.id] === '',
        })),
    };

    try {
      /* What the sheet will look like, used as the answer when the request is
         queued: the coordinator sees the marks they just entered either way,
         and only the result waits for the server. */
      const optimistic = applyLocally(sheet, payload);
      onSaved(await marksheetApi.save(programmeId, [payload], optimistic));
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not save these marks.');
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.sheet}>
      <View style={styles.sheetHead}>
        <View style={styles.rowText}>
          <Text style={styles.sheetName}>{row.name}</Text>
          <Text style={styles.rowMeta}>{row.applicationNo}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.ink500} />
        </Pressable>
      </View>

      {sheet.trainers.length > 0 ? (
        <Picker
          label="Marked by"
          placeholder="Not recorded"
          value={trainerId === null ? null : String(trainerId)}
          options={sheet.trainers.map((trainer) => ({
            value: String(trainer.id),
            label: trainer.fullName,
          }))}
          onChange={(value) => setTrainerId(Number(value))}
        />
      ) : null}

      {scheme.hasWritten ? (
        <Field
          label="Written examination"
          keyboardType="number-pad"
          editable={!row.writtenFromExam}
          value={written}
          onChangeText={setWritten}
          hint={
            row.writtenFromExam
              ? `From the paper sat online — ${row.examPercentage}% on the best of ` +
                `${row.examAttempts} attempt${row.examAttempts === 1 ? '' : 's'}.`
              : `Out of ${scheme.writtenMarks}. Leave blank if the paper is not marked yet.`
          }
        />
      ) : null}

      {scheme.hasViva
        ? sheet.skills.map((skill) => (
            <Field
              key={skill.id}
              label={skill.name}
              keyboardType="number-pad"
              editable={!skill.isRetired}
              value={skills[skill.id] ?? ''}
              onChangeText={(value) => setSkills((prev) => ({ ...prev, [skill.id]: value }))}
              hint={
                skill.isRetired
                  ? 'Retired — kept for the marks already given.'
                  : skill.description
                    ? `Out of ${skill.maxMarks}. ${skill.description}`
                    : `Out of ${skill.maxMarks}.`
              }
            />
          ))
        : null}

      {scheme.hasViva ? (
        <View style={styles.tally}>
          <Text style={styles.tallyText}>
            Viva {vivaTotal} of {scheme.vivaMarks}
          </Text>
          <Text style={styles.tallyMeta}>
            {scheme.vivaPassMarks} needed to clear this section
          </Text>
        </View>
      ) : null}

      {problem ? <Banner tone="danger">{problem}</Banner> : null}
      {failure ? <Banner tone="danger">{failure}</Banner> : null}

      <Button label="Save marks" onPress={save} loading={busy} disabled={!!problem} />
      <Button label="Cancel" variant="ghost" onPress={onClose} />
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ bits */

const text = (value?: number | null) => (value === null || value === undefined ? '' : String(value));

const within = (value: string, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= max;
};

function pattern(sheet: Marksheet): string {
  const scheme = sheet.evaluation;
  const parts: string[] = [];
  if (scheme.hasWritten) {
    parts.push(`written ${scheme.writtenMarks} (pass ${scheme.writtenPassMarks})`);
  }
  if (scheme.hasViva) parts.push(`viva ${scheme.vivaMarks} (pass ${scheme.vivaPassMarks})`);
  return (
    `Out of ${scheme.totalMarks}: ${parts.join(', ')}. ` +
    `${scheme.overallPassMarks} needed overall.`
  );
}

/**
 * The sheet as it will read once these marks are in.
 *
 * Used only as the stand-in answer while the write is queued, so the result and
 * the counts are left exactly as the server last reported them — a mark that
 * has not reached the server has not decided anything.
 */
function applyLocally(sheet: Marksheet, row: MarksheetRowSave): Marksheet {
  return {
    ...sheet,
    rows: sheet.rows.map((existing) => {
      if (existing.participantId !== row.participantId) return existing;

      const kept = existing.skillMarks.filter(
        (mark) => !row.skillMarks.some((sent) => sent.skillId === mark.skillId),
      );
      const added = row.skillMarks
        .filter((sent) => !sent.clear)
        .map((sent) => ({
          skillId: sent.skillId,
          marks: sent.marks,
          trainerId: row.trainerId ?? null,
          trainerName: sheet.trainers.find((t) => t.id === row.trainerId)?.fullName ?? null,
          markedOn: new Date().toISOString(),
        }));

      const skillMarks = [...kept, ...added];
      const viva = skillMarks.length > 0 ? skillMarks.reduce((sum, m) => sum + m.marks, 0) : null;
      const written =
        'writtenMarks' in row ? (row.writtenMarks ?? null) : (existing.writtenMarks ?? null);

      return { ...existing, skillMarks, vivaMarks: viva, writtenMarks: written };
    }),
  };
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  summary: { gap: 4 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.ink900 },
  summaryText: { fontSize: 12, color: colors.ink600 },
  summaryCount: { fontSize: 12, color: colors.ink500, marginTop: 2 },
  row: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: 12, color: colors.ink500 },
  rowNote: { fontSize: 11, color: colors.ink400 },
  sheet: {
    backgroundColor: colors.page,
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xl,
  },
  sheetHead: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  sheetName: { fontSize: 18, fontWeight: '700', color: colors.ink900 },
  tally: {
    backgroundColor: colors.blush,
    borderRadius: radius.md,
    gap: 2,
    padding: spacing.md,
  },
  tallyText: { fontSize: 14, fontWeight: '700', color: colors.brand700 },
  tallyMeta: { fontSize: 12, color: colors.ink600 },
});
