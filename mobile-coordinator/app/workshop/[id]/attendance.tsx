import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '../../../src/api/client';
import { participants as participantsApi } from '../../../src/api/endpoints';
import { Banner, Button, Card, EmptyState } from '../../../src/components/ui';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Tick the register.
 *
 * Marks are held locally until Save, then sent as one list. Taking attendance
 * is a single pass down a row of chairs, often with no signal at all, and a
 * request per tick would strand it half done.
 *
 * Nobody starts ticked. An untouched list saved by accident would record a full
 * house that was never counted, which is exactly the claim this screen exists
 * to substantiate.
 */
export default function Attendance() {
  const { id, detail, refresh, locked } = useWorkshop();
  const people = detail?.participants ?? [];

  const [marks, setMarks] = useState<Record<number, boolean>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  /* Seeded from whatever is already recorded, so a second pass corrects the
     first rather than starting from blank. */
  useEffect(() => {
    const seeded: Record<number, boolean> = {};
    for (const person of people) {
      if (person.isPresent !== null && person.isPresent !== undefined) {
        seeded[person.id] = person.isPresent;
      }
    }
    setMarks(seeded);
  }, [detail]);

  if (people.length === 0) {
    return (
      <EmptyState
        title="No participants yet"
        message="Register participants on the On-spot registration screen first."
      />
    );
  }

  const markedCount = Object.keys(marks).length;
  const presentCount = Object.values(marks).filter(Boolean).length;

  const setAll = (value: boolean) =>
    setMarks(Object.fromEntries(people.map((person) => [person.id, value])));

  const save = async () => {
    setBusy(true);
    setFailure(null);
    setSaved(false);
    try {
      await participantsApi.attendance(
        id,
        Object.entries(marks).map(([participantId, isPresent]) => ({
          participantId: Number(participantId),
          isPresent,
        })),
      );
      await refresh();
      setSaved(true);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not save attendance.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {locked ? <Banner tone="info">Finally submitted — read only.</Banner> : null}

      <View style={styles.tally}>
        <Text style={styles.tallyText}>
          {markedCount} of {people.length} marked · {presentCount} present
        </Text>
        {!locked ? (
          <View style={styles.bulk}>
            <Pressable onPress={() => setAll(true)} hitSlop={6}>
              <Text style={styles.bulkAction}>All present</Text>
            </Pressable>
            <Pressable onPress={() => setMarks({})} hitSlop={6}>
              <Text style={styles.bulkAction}>Clear</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Card style={styles.card}>
        {people.map((person) => {
          const state = marks[person.id];
          return (
            <Pressable
              key={person.id}
              style={styles.row}
              disabled={locked}
              onPress={() => setMarks((prev) => ({ ...prev, [person.id]: !prev[person.id] }))}
            >
              <View style={[styles.box, state === true && styles.boxOn]}>
                {state === true ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{person.fullName}</Text>
                <Text style={styles.rowMeta}>{person.enterpriseName}</Text>
              </View>
              <Text style={[styles.state, state === true && styles.statePresent]}>
                {state === undefined ? 'Not marked' : state ? 'Present' : 'Absent'}
              </Text>
            </Pressable>
          );
        })}
      </Card>

      {failure ? <Banner tone="danger">{failure}</Banner> : null}
      {saved ? <Banner tone="success">Attendance saved.</Banner> : null}

      {!locked ? (
        <Button
          label="Save attendance"
          onPress={save}
          loading={busy}
          disabled={markedCount === 0}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  tally: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tallyText: { fontSize: 13, color: colors.ink600, fontWeight: '600' },
  bulk: { flexDirection: 'row', gap: spacing.lg },
  bulkAction: { fontSize: 13, color: colors.brand700, fontWeight: '600' },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.ink300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.success500, borderColor: colors.success500 },
  rowText: { flex: 1, gap: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: 12, color: colors.ink500 },
  state: { fontSize: 11, color: colors.ink400, fontWeight: '600' },
  statePresent: { color: colors.success700 },
});
