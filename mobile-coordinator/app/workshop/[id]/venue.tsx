import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { photos, venue as venueApi, type CapturedImage } from '../../../src/api/endpoints';
import { Banner, Button, Card } from '../../../src/components/ui';
import { PhotoPicker } from '../../../src/components/PhotoPicker';
import { useGeoFix } from '../../../src/location/useGeoFix';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Register the venue: where it is, proved by a GPS fix taken there, plus one
 * exterior and one interior photograph.
 *
 * The address is not typed here. It is on the programme, put there by the
 * office when the batch was raised, and asking a coordinator to key it in
 * again at the hall produces a second spelling of the same place and no new
 * information. The screen shows what the office holds and the coordinator
 * supplies what only somebody standing there can: the fix and the pictures.
 *
 * The photos are uploaded after the venue is saved because the server hangs
 * them off the venue row. The screen therefore saves first and uploads second,
 * in one action, rather than asking the coordinator to do it in two passes.
 */
export default function RegisterVenue() {
  const router = useRouter();
  const { id, detail, refresh, locked } = useWorkshop();
  const existing = detail?.venue2 ?? null;

  const geo = useGeoFix();

  const [exterior, setExterior] = useState<CapturedImage | null>(null);
  const [interior, setInterior] = useState<CapturedImage | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fix = geo.fix;
  const savedLat = existing?.latitude ?? null;
  const hasFix = fix !== null || savedLat !== null;

  /* Already on the server counts: a coordinator reopening the screen to
     correct the geo-tag should not have to photograph the hall again. */
  const hasExterior = exterior !== null || !!existing?.exteriorPhoto;
  const hasInterior = interior !== null || !!existing?.interiorPhoto;

  const save = async () => {
    /* What the office raised, which is what the venue row records. The
       name and the address are the same string because the programme
       holds one: inventing a distinction here would put two different
       answers in front of whoever reads the report. */
    const raised = (detail?.venue ?? '').trim();

    const found: Record<string, string> = {};
    if (!raised) {
      found.venue = 'No venue has been recorded against this program. Ask the office.';
    }
    if (!hasFix) found.geo = 'Capture the location at the venue before saving.';
    if (!hasExterior) found.exterior = 'The exterior photograph is required.';
    if (!hasInterior) found.interior = 'The interior photograph is required.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      await venueApi.save(id, {
        name: raised,
        address: raised,
        /* Only sent when a new reading was taken; omitting it leaves the
           stored geo-tag untouched. */
        latitude: fix?.latitude ?? null,
        longitude: fix?.longitude ?? null,
        accuracyMetres: fix?.accuracyMetres ?? null,
      });

      if (exterior) await photos.venue(id, 'exterior', exterior, fix);
      if (interior) await photos.venue(id, 'interior', interior, fix);

      await refresh();
      router.back();
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not save the venue.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.heading}>Venue details</Text>
          <Text style={styles.hint}>
            As the program was raised. Ask the office if any of it is wrong.
          </Text>
          <Line label="Address" value={detail?.venue} />
          <Line label="State" value={detail?.state} />
          <Line label="District" value={detail?.district} />
          <Line label="Pincode" value={detail?.pincode} />
        </Card>


        {locked ? <Banner tone="info">Finally submitted — read only.</Banner> : null}
        {errors.venue ? <Banner tone="danger">{errors.venue}</Banner> : null}

        <Card style={styles.card}>
          <Text style={styles.heading}>Geo-tag</Text>
          <Text style={styles.hint}>
            Stand at the venue and capture the location. This is what proves where the
            workshop was held.
          </Text>

          <View style={styles.fixBox}>
            {fix ? (
              <>
                <Text style={styles.fixValue}>
                  {fix.latitude.toFixed(6)}, {fix.longitude.toFixed(6)}
                </Text>
                <Text style={styles.fixMeta}>
                  Accurate to about {Math.round(fix.accuracyMetres ?? 0)} m · just now
                </Text>
              </>
            ) : savedLat !== null ? (
              <>
                <Text style={styles.fixValue}>
                  {Number(savedLat).toFixed(6)}, {Number(existing?.longitude).toFixed(6)}
                </Text>
                <Text style={styles.fixMeta}>
                  Captured{' '}
                  {existing?.geoTaggedOn
                    ? new Date(existing.geoTaggedOn).toLocaleString('en-IN')
                    : 'earlier'}
                </Text>
              </>
            ) : (
              <Text style={styles.fixNone}>No location captured yet</Text>
            )}
          </View>

          {geo.problem ? <Banner tone="warning">{geo.problem}</Banner> : null}
          {errors.geo ? <Banner tone="danger">{errors.geo}</Banner> : null}

          <Button
            label={
              geo.status === 'locating'
                ? 'Getting a fix…'
                : hasFix
                  ? 'Capture again'
                  : 'Capture location'
            }
            icon="locate-outline"
            onPress={() => void geo.capture()}
            loading={geo.status === 'asking' || geo.status === 'locating'}
            disabled={locked}
            variant="secondary"
          />
        </Card>

        {/* Said once, above both, rather than twice underneath them:
            the requirement is the same for the two and it is the
            programme banner that makes a photograph evidence of this
            workshop rather than of a room. */}
        <Banner tone={hasExterior && hasInterior ? 'info' : 'warning'}>
          Both photographs are required, and the program banner must be visible in each.
        </Banner>

        <Card style={styles.card}>
          <PhotoPicker
            label="Exterior photo"
            required
            hint="The building front, with the program banner and any signage visible."
            value={exterior}
            existingPath={existing?.exteriorPhoto?.url ?? null}
            onPick={setExterior}
            onClear={() => setExterior(null)}
            disabled={locked}
          />
          {errors.exterior ? <Banner tone="danger">{errors.exterior}</Banner> : null}
        </Card>

        <Card style={styles.card}>
          <PhotoPicker
            label="Interior photo"
            required
            hint="The hall as set up, with the program banner in shot."
            value={interior}
            existingPath={existing?.interiorPhoto?.url ?? null}
            onPick={setInterior}
            onClear={() => setInterior(null)}
            disabled={locked}
          />
          {errors.interior ? <Banner tone="danger">{errors.interior}</Banner> : null}
        </Card>

        {failure ? <Banner tone="danger">{failure}</Banner> : null}

        {!locked ? <Button label="Save venue" onPress={save} loading={busy} /> : null}
    </ScrollView>
  );
}

/** One read-only fact in the header cards. */
function Line({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, !value && styles.lineEmpty]}>
        {value?.trim() ? value : 'Not recorded'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 5,
  },
  lineLabel: { fontSize: 13, color: colors.ink500, flexShrink: 0 },
  lineValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink900,
    textAlign: 'right',
  },
  lineEmpty: { fontWeight: '400', color: colors.ink400, fontStyle: 'italic' },

  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink900 },
  hint: { fontSize: 12, color: colors.ink500, lineHeight: 17 },
  fixBox: {
    backgroundColor: colors.ink50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink200,
    padding: spacing.md,
    gap: 2,
  },
  fixValue: { fontSize: 15, fontWeight: '700', color: colors.ink900, fontVariant: ['tabular-nums'] },
  fixMeta: { fontSize: 12, color: colors.ink500 },
  fixNone: { fontSize: 13, color: colors.ink500 },
});
