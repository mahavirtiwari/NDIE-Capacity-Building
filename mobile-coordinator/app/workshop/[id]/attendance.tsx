import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '../../../src/api/client';
import { participants as participantsApi } from '../../../src/api/endpoints';
import { Banner, Button, Card, EmptyState } from '../../../src/components/ui';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Tick the register, one day at a time.
 *
 * A five-day programme is five registers, not one: somebody who came on
 * Monday and not on Thursday did not attend it the way a single tick would
 * claim, and the report shows a column per day. The day is picked at the top
 * and every mark below belongs to it.
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
  const days = programmeDays(detail?.startDate, detail?.endDate);

  /* Today where the programme is running, the first day otherwise: a
     coordinator opening this during the workshop should not have to find
     the right day before ticking anybody. */
  const [day, setDay] = useState<string>(() => todayOr(days));
  const [marks, setMarks] = useState<Record<number, boolean>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  /* Seeded from what is already recorded for this day, so a second pass
     corrects the first rather than starting from blank. Re-runs when the day
     changes, which is what makes the tabs show their own register. */
  useEffect(() => {
    const seeded: Record<number, boolean> = {};
    for (const person of people) {
      const mark = (person.days ?? []).find((d) => d.day === day);
      if (mark) seeded[person.id] = mark.isPresent;
    }
    setMarks(seeded);
    setSaved(false);
  }, [detail, day]);

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
          day,
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

      {/* One tab per day. A one-day programme gets one, which reads as a
          label rather than as a choice and needs no explaining. */}
      {days.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.days}
        >
          {days.map((value, index) => {
            const taken = people.some((person) =>
              (person.days ?? []).some((d) => d.day === value));
            return (
              <Pressable
                key={value}
                style={[styles.day, value === day && styles.dayOn]}
                onPress={() => setDay(value)}
              >
                <Text style={[styles.dayLabel, value === day && styles.dayLabelOn]}>
                  {`Day ${index + 1}`}
                </Text>
                <Text style={[styles.dayDate, value === day && styles.dayDateOn]}>
                  {shortDate(value)}
                </Text>
                {taken ? <View style={styles.dayDone} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.oneDay}>{`Register for ${shortDate(day)}`}</Text>
      )}

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

  /* The day tabs. Wide enough for a thumb, scrolling sideways rather
     than wrapping, because a five-day row that becomes two rows moves
     the register down the screen every time the window changes. */
  days: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  day: {
    minWidth: 76,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  dayOn: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  dayLabel: { fontSize: 13, fontWeight: '600', color: colors.ink700 },
  dayLabelOn: { color: '#fff' },
  dayDate: { fontSize: 11, color: colors.ink500, marginTop: 1 },
  dayDateOn: { color: 'rgba(255,255,255,0.85)' },
  /* A dot on a day somebody has already been marked on, so a
     coordinator can see at a glance which registers are outstanding. */
  dayDone: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
    backgroundColor: colors.success500,
  },
  oneDay: { fontSize: 13, fontWeight: '600', color: colors.ink700 },
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

/**
 * Every day the programme runs, as yyyy-MM-dd.
 *
 * Derived from its dates rather than fetched: the same arithmetic the
 * server does, and the register has to show a column per day whether or
 * not anybody has been marked yet.
 */
function programmeDays(start?: string | null, end?: string | null): string[] {
  if (!start) return [];

  const from = new Date(start);
  const to = end ? new Date(end) : from;
  if (Number.isNaN(from.getTime())) return [];

  const last = Number.isNaN(to.getTime()) || to < from ? from : to;

  const days: string[] = [];
  for (const at = new Date(from); at <= last && days.length < 60; at.setDate(at.getDate() + 1)) {
    days.push(at.toISOString().slice(0, 10));
  }

  return days;
}

/** Today if the programme is running, otherwise its first day. */
function todayOr(days: string[]): string {
  if (days.length === 0) return new Date().toISOString().slice(0, 10);

  const today = new Date().toISOString().slice(0, 10);
  return days.includes(today) ? today : days[0];
}

/** "28 Sep", for a tab that has to stay narrow. */
function shortDate(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;
  return at.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}
