import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SHORT_MONTHS = MONTHS.map((month) => month.slice(0, 3));

/** Years are shown four to a row; the row height the list scrolls by. */
const YEARS_PER_ROW = 4;
const YEAR_ROW = 52;

/** ISO day string in local terms. `toISOString` is UTC and shifts the date. */
function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** The date a value names, or today, as the month the calendar opens on. */
function startingMonth(value: string | null): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m] = value.split('-').map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

/** 14 March 2026, which is how a date is read back to somebody. */
function readable(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

interface DateFieldProps {
  label: string;
  value: string | null;
  required?: boolean;
  error?: string | null;
  hint?: string | null;
  /** The window the form designer set, as ISO days. */
  minDate?: string | null;
  maxDate?: string | null;
  onChange: (value: string) => void;
}

/**
 * A date, chosen from a calendar rather than typed.
 *
 * Typing a date on a phone keypad is the wrong way round: the applicant knows
 * the day they mean and has to render it as YYYY-MM-DD, which is where the
 * complaints came from. A grid asks for the day directly, and a day that
 * falls outside the form's window cannot be pressed at all, so the bound is
 * felt before it is explained.
 *
 * Built from React Native primitives on purpose. The obvious alternative,
 * @react-native-community/datetimepicker, is a native module: adding it means
 * every installed copy of the app needs replacing before anybody sees a
 * calendar. This ships with the JavaScript, and it renders identically on both
 * platforms rather than two system dialogs that behave differently.
 *
 * The value stays ISO YYYY-MM-DD, which is what the API stores and what the
 * validation already checks. Only the display is in words.
 */
export function DateField({
  label,
  value,
  required,
  error,
  hint,
  minDate,
  maxDate,
  onChange,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startingMonth(value));

  /* Which of the three the calendar is showing.
   *
   * It only ever showed days, with a month arrow at each side, so a
   * qualification taken in 1998 meant pressing back three hundred and
   * thirty times. The month and year in the bar is the way out: it is a
   * button, and it goes straight to the years. */
  const [mode, setMode] = useState<'day' | 'month' | 'year'>('day');

  const grid = useMemo(() => {
    const total = daysInMonth(view.year, view.month);
    const leading = new Date(view.year, view.month, 1).getDay();

    /* Blanks before the first, so the 1st lands under its weekday. */
    const cells: (string | null)[] = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= total; day += 1) cells.push(iso(view.year, view.month, day));
    return cells;
  }, [view]);

  const today = useMemo(() => {
    const now = new Date();
    return iso(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const blocked = (day: string) =>
    (!!minDate && day < minDate) || (!!maxDate && day > maxDate);

  /* A step that would land entirely outside the window is not offered,
     so nobody pages through years of unselectable months. */
  const step = (by: number) => {
    const month = view.month + by;
    const year = view.year + Math.floor(month / 12);
    setView({ year, month: ((month % 12) + 12) % 12 });
  };

  /* The years worth offering. The form's own window decides it where
     there is one - a passing year cannot be after today if the form says
     so - and a century back covers a date of birth where there is not. */
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const first = minDate ? Number(minDate.slice(0, 4)) : now - 100;
    const last = maxDate ? Number(maxDate.slice(0, 4)) : now + 10;

    const rows: number[][] = [];
    for (let year = first; year <= Math.max(last, first); year += 1) {
      if (year % YEARS_PER_ROW === first % YEARS_PER_ROW) rows.push([]);
      rows[rows.length - 1].push(year);
    }
    return rows;
  }, [minDate, maxDate]);

  /* Opened on the year already in view rather than at the top: somebody
     correcting 1998 should not scroll back to it from 1925. */
  const yearRow = Math.max(
    0,
    years.findIndex((row) => row.includes(view.year)),
  );

  /** Whether any day of a month is inside the form's window. */
  const monthOff = (year: number, month: number) =>
    (!!maxDate && iso(year, month, 1) > maxDate) ||
    (!!minDate && iso(year, month, daysInMonth(year, month)) < minDate);

  const monthStart = iso(view.year, view.month, 1);
  const monthEnd = iso(view.year, view.month, daysInMonth(view.year, view.month));
  const canGoBack = !minDate || monthStart > minDate;
  const canGoForward = !maxDate || monthEnd < maxDate;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${readable(value)}` : label}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setView(startingMonth(value));
          setMode('day');
          setOpen(true);
        }}
        style={[styles.control, !!error && styles.controlInvalid]}
      >
        <Text style={value ? styles.value : styles.placeholder} numberOfLines={1}>
          {value ? readable(value) : 'Select a date'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.ink500} />
      </Pressable>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.ink600} />
              </Pressable>
            </View>

            <View style={styles.monthBar}>
              {/* The arrows belong to the day grid. On the month and year
                  boards there is nothing to step through, and leaving
                  them there invited a press that did nothing. */}
              {mode === 'day' ? (
                <Pressable
                  onPress={() => step(-1)}
                  disabled={!canGoBack}
                  accessibilityLabel="Previous month"
                  style={[styles.step, !canGoBack && styles.stepOff]}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.ink700} />
                </Pressable>
              ) : (
                <View style={styles.step} />
              )}

              <Pressable
                onPress={() => setMode(mode === 'day' ? 'year' : 'day')}
                accessibilityRole="button"
                accessibilityLabel={
                  mode === 'day' ? 'Choose a month and year' : 'Back to the days'
                }
                style={styles.monthLabel}
              >
                <Text style={styles.month}>
                  {mode === 'year'
                    ? 'Choose a year'
                    : mode === 'month'
                      ? view.year
                      : `${MONTHS[view.month]} ${view.year}`}
                </Text>
                <Ionicons
                  name={mode === 'day' ? 'chevron-down' : 'chevron-up'}
                  size={16}
                  color={colors.ink600}
                />
              </Pressable>

              {mode === 'day' ? (
                <Pressable
                  onPress={() => step(1)}
                  disabled={!canGoForward}
                  accessibilityLabel="Next month"
                  style={[styles.step, !canGoForward && styles.stepOff]}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.ink700} />
                </Pressable>
              ) : (
                <View style={styles.step} />
              )}
            </View>

            {mode === 'year' ? (
              <FlatList
                data={years}
                keyExtractor={(row) => String(row[0])}
                style={styles.board}
                initialScrollIndex={yearRow}
                getItemLayout={(_, index) => ({
                  length: YEAR_ROW,
                  offset: YEAR_ROW * index,
                  index,
                })}
                renderItem={({ item: row }) => (
                  <View style={styles.boardRow}>
                    {row.map((year) => (
                      <Pressable
                        key={year}
                        accessibilityRole="button"
                        accessibilityState={{ selected: year === view.year }}
                        onPress={() => {
                          setView((held) => ({ ...held, year }));
                          setMode('month');
                        }}
                        style={({ pressed }) => [
                          styles.boardCell,
                          pressed && styles.boardCellPressed,
                          year === view.year && styles.boardCellChosen,
                        ]}
                      >
                        <Text
                          style={[
                            styles.boardText,
                            year === view.year && styles.boardTextChosen,
                          ]}
                        >
                          {year}
                        </Text>
                      </Pressable>
                    ))}
                    {/* A short last row keeps its columns under the ones above. */}
                    {Array.from({ length: YEARS_PER_ROW - row.length }, (_, index) => (
                      <View key={`pad-${index}`} style={styles.boardCell} />
                    ))}
                  </View>
                )}
              />
            ) : mode === 'month' ? (
              <View style={styles.monthBoard}>
                {SHORT_MONTHS.map((name, month) => {
                  const off = monthOff(view.year, month);
                  const chosen = month === view.month;
                  return (
                    <Pressable
                      key={name}
                      disabled={off}
                      accessibilityRole="button"
                      accessibilityState={{ selected: chosen, disabled: off }}
                      onPress={() => {
                        setView((held) => ({ ...held, month }));
                        setMode('day');
                      }}
                      style={({ pressed }) => [
                        styles.monthCell,
                        pressed && !off && styles.boardCellPressed,
                        chosen && styles.boardCellChosen,
                      ]}
                    >
                      <Text
                        style={[
                          styles.boardText,
                          off && styles.dayTextOff,
                          chosen && styles.boardTextChosen,
                        ]}
                      >
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
            <>
            <View style={styles.weekdays}>
              {WEEKDAYS.map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekday}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {grid.map((day, index) => {
                if (!day) return <View key={`blank-${index}`} style={styles.cell} />;

                const off = blocked(day);
                const chosen = day === value;
                return (
                  <Pressable
                    key={day}
                    disabled={off}
                    accessibilityRole="button"
                    accessibilityState={{ selected: chosen, disabled: off }}
                    onPress={() => {
                      onChange(day);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.cell,
                      styles.day,
                      day === today && !chosen && styles.dayToday,
                      pressed && !off && styles.dayPressed,
                      chosen && styles.dayChosen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        off && styles.dayTextOff,
                        chosen && styles.dayTextChosen,
                      ]}
                    >
                      {Number(day.slice(8))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            </>
            )}

            {minDate || maxDate ? (
              <Text style={styles.window}>
                {minDate && maxDate
                  ? `Between ${readable(minDate)} and ${readable(maxDate)}.`
                  : minDate
                    ? `${readable(minDate)} or later.`
                    : `${readable(maxDate!)} or earlier.`}
              </Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.ink700 },
  required: { color: colors.danger500 },

  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.white,
    minHeight: 46,
  },
  controlInvalid: { borderColor: colors.danger500 },
  value: { flex: 1, fontSize: font.base, color: colors.ink900 },
  placeholder: { flex: 1, fontSize: font.base, color: colors.ink500 },

  error: { fontSize: font.xs, color: colors.danger700, fontWeight: '500' },
  hint: { fontSize: font.sm, color: colors.ink600, lineHeight: 17 },

  /* Centred rather than a bottom sheet: a month grid is a block of
     content to read, not a list to thumb through, and in the middle it
     sits under the eye instead of against the gesture bar. */
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },

  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  step: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: { opacity: 0.25 },
  monthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  month: { fontSize: font.base, fontWeight: '700', color: colors.ink900 },

  /* As tall as six rows of days, so switching between the boards does not
     make the dialog jump about under the thumb. */
  board: { height: YEAR_ROW * 5, marginTop: spacing.sm },
  boardRow: { flexDirection: 'row', paddingHorizontal: spacing.md, height: YEAR_ROW },
  boardCell: {
    flex: 1,
    margin: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  boardCellPressed: { backgroundColor: colors.brand50 },
  boardCellChosen: { backgroundColor: colors.brand600 },
  boardText: { fontSize: font.base, color: colors.ink900 },
  boardTextChosen: { color: colors.white, fontWeight: '700' },

  monthBoard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    height: YEAR_ROW * 5,
    marginTop: spacing.sm,
  },
  monthCell: {
    width: `${100 / 3}%`,
    height: YEAR_ROW * 5 / 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },

  weekdays: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.ink500,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  /* A seventh of the row, so the columns line up with their weekday
     whatever the screen is. */
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  dayToday: { borderWidth: 1, borderColor: colors.brand600 },
  dayPressed: { backgroundColor: colors.brand50 },
  dayChosen: { backgroundColor: colors.brand600 },
  dayText: { fontSize: font.base, color: colors.ink900 },
  dayTextOff: { color: colors.ink300 },
  dayTextChosen: { color: colors.white, fontWeight: '700' },

  window: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    fontSize: font.xs,
    color: colors.ink600,
  },
});
