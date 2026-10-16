import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { photos, type CapturedImage } from '../../../src/api/endpoints';
import { PhotoPicker } from '../../../src/components/PhotoPicker';
import { StoredImage } from '../../../src/files/storedImage';
import { Banner, Button, Card, shortDate } from '../../../src/components/ui';
import { useGeoFix } from '../../../src/location/useGeoFix';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * The signed register, photographed, one day at a time.
 *
 * They used to pile up against the programme with nothing saying which day
 * each belonged to, so five days of registers were five photographs in a row
 * and the only way to tell them apart was to read the handwriting. The day is
 * picked at the top and the sheet is filed under it.
 *
 * Taken on the day and only once, like the register it photographs. A sheet
 * photographed on Friday for Tuesday is somebody tidying up afterwards, which
 * is the one thing this document must not be. The server refuses it; this
 * screen does not offer it.
 */
export default function AttendancePhoto() {
  const { id, detail, refresh, locked } = useWorkshop();
  const geo = useGeoFix();

  const days = useMemo(
    () => programmeDays(detail?.startDate, detail?.endDate),
    [detail?.startDate, detail?.endDate],
  );

  const today = new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState<string>(() => (days.includes(today) ? today : days[0] ?? today));

  const sheets = detail?.attendanceSheets ?? [];
  const forDay = sheets.filter((s) => s.attendanceDay === day);
  /* Sheets taken before the day was asked for have none. They are shown
     on their own, so nothing already uploaded disappears. */
  const undated = sheets.filter((s) => !s.attendanceDay);

  const editable = !locked && forDay.length === 0 && day === today;

  const [image, setImage] = useState<CapturedImage | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!image) return;
    setBusy(true);
    setFailure(null);
    try {
      const fix = await geo.capture();
      await photos.attendanceSheet(id, image, fix, day);
      await refresh();
      setImage(null);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not upload the sheet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {locked ? <Banner tone="info">Finally submitted — read only.</Banner> : null}

      {days.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.days}
        >
          {days.map((value, index) => {
            const held = sheets.some((s) => s.attendanceDay === value);
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
                {held ? <View style={styles.dayDone} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.oneDay}>{`Signed sheet for ${shortDate(day)}`}</Text>
      )}

      <Card style={styles.card}>
        <Text style={styles.heading}>{`Day's sheet`}</Text>
        {forDay.length === 0 ? (
          <Text style={styles.none}>Nothing photographed for this day yet.</Text>
        ) : (
          <View style={styles.grid}>
            {forDay.map((sheet) => (
              <StoredImage key={sheet.id} path={sheet.url} style={styles.thumb} />
            ))}
          </View>
        )}
      </Card>

      {!locked && forDay.length > 0 ? (
        <Banner tone="info">
          This day's sheet has been submitted and cannot be changed. Ask the office if
          something on it is wrong.
        </Banner>
      ) : null}

      {!locked && forDay.length === 0 && day !== today ? (
        <Banner tone="warning">
          {day > today
            ? 'This day has not happened yet. The sheet is photographed on the day.'
            : 'This day has passed and its sheet was not photographed. It can no longer be added here.'}
        </Banner>
      ) : null}

      {editable ? (
        <Card style={styles.card}>
          <PhotoPicker
            label="Photograph the signed sheet"
            required
            hint="The whole page, with the signatures readable."
            value={image}
            onPick={setImage}
            onClear={() => setImage(null)}
          />
          {failure ? <Banner tone="danger">{failure}</Banner> : null}
          <Button label="Upload sheet" onPress={upload} loading={busy} disabled={!image} />
        </Card>
      ) : null}

      {undated.length > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.heading}>Earlier sheets ({undated.length})</Text>
          <Text style={styles.none}>
            Photographed before the day was recorded against them.
          </Text>
          <View style={styles.grid}>
            {undated.map((sheet) => (
              <StoredImage key={sheet.id} path={sheet.url} style={styles.thumb} />
            ))}
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

/** Every day the programme runs, first to last, as yyyy-mm-dd. */
function programmeDays(start?: string, end?: string): string[] {
  if (!start) return [];
  const from = new Date(start);
  const to = end ? new Date(end) : from;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];

  const out: string[] = [];
  for (let at = from; at <= to && out.length < 60; at = new Date(at.getTime() + 86400000)) {
    out.push(at.toISOString().slice(0, 10));
  }
  return out;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink900 },
  none: { fontSize: 13, color: colors.ink500 },

  days: { gap: spacing.sm, paddingBottom: 2 },
  day: {
    minWidth: 86,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    gap: 1,
  },
  dayOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  dayLabel: { fontSize: 13, fontWeight: '700', color: colors.ink900 },
  dayLabelOn: { color: colors.white },
  dayDate: { fontSize: 11, color: colors.ink500 },
  dayDateOn: { color: colors.white },
  dayDone: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success700,
    marginTop: 2,
  },
  oneDay: { fontSize: 13, fontWeight: '600', color: colors.ink700 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.ink100 },
});
