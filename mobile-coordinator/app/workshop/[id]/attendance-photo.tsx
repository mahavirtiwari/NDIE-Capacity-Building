import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { photos, type CapturedImage } from '../../../src/api/endpoints';
import { PhotoPicker } from '../../../src/components/PhotoPicker';
import { Banner, Button, Card } from '../../../src/components/ui';
import { useGeoFix } from '../../../src/location/useGeoFix';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Photographs of the signed attendance sheets.
 *
 * Several are expected — a sheet holds a page of signatures and a workshop runs
 * to more than one — so these accumulate rather than replacing each other, and
 * the ones already uploaded are shown so nobody photographs page two twice.
 */
export default function AttendancePhoto() {
  const { id, detail, refresh, locked } = useWorkshop();
  const geo = useGeoFix();

  const uploaded = detail?.attendanceSheets ?? [];
  const [image, setImage] = useState<CapturedImage | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!image) return;
    setBusy(true);
    setFailure(null);
    try {
      const fix = await geo.capture();
      await photos.attendanceSheet(id, image, fix);
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

      <Card style={styles.card}>
        <Text style={styles.heading}>Uploaded ({uploaded.length})</Text>
        {uploaded.length === 0 ? (
          <Text style={styles.none}>No sheets uploaded yet.</Text>
        ) : (
          <View style={styles.grid}>
            {uploaded.map((sheet) => (
              <Image
                key={sheet.id}
                source={{ uri: photos.src(sheet.kind, sheet.url) }}
                style={styles.thumb}
                resizeMode="cover"
              />
            ))}
          </View>
        )}
      </Card>

      {!locked ? (
        <Card style={styles.card}>
          <PhotoPicker
            label="Add a signed sheet"
            hint="One photo per page. Make sure the signatures are readable."
            value={image}
            onPick={setImage}
          />
          {failure ? <Banner tone="danger">{failure}</Banner> : null}
          <Button label="Upload sheet" onPress={upload} loading={busy} disabled={!image} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink900 },
  none: { fontSize: 13, color: colors.ink500 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.ink100 },
});
