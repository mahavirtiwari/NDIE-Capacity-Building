import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { coordinatorProfile, photos, venue as venueApi, type CapturedImage } from '../../../src/api/endpoints';
import type { CoordinatorProfile } from '../../../src/api/types';
import { Banner, Button, Card, Field, KeyboardAvoider } from '../../../src/components/ui';
import { PhotoPicker } from '../../../src/components/PhotoPicker';
import { useGeoFix } from '../../../src/location/useGeoFix';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Register the venue: where it is, proved by a GPS fix taken there, plus one
 * exterior and one interior photograph.
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

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [exterior, setExterior] = useState<CapturedImage | null>(null);
  const [interior, setInterior] = useState<CapturedImage | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Who is registering it, for the header. Read rather than typed:
     every one of these is already on the account, and a coordinator
     retyping their own mobile number at a venue is a way of getting it
     wrong. */
  const [me, setMe] = useState<CoordinatorProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mine = await coordinatorProfile.mine();
        if (!cancelled) setMe(mine);
      } catch {
        /* The form below is the job; a missing header is not worth
           stopping it for. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Seeded from whatever is already recorded, so re-opening the screen shows
     the venue rather than an empty form inviting it to be typed again. */
  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setAddress(existing.address);
    setLandmark(existing.landmark ?? '');
  }, [existing]);

  const fix = geo.fix;
  const savedLat = existing?.latitude ?? null;
  const hasFix = fix !== null || savedLat !== null;

  const save = async () => {
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = 'Venue name is required.';
    if (!address.trim()) found.address = 'Address is required.';
    if (!hasFix) found.geo = 'Capture the location at the venue before saving.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      await venueApi.save(id, {
        name: name.trim(),
        address: address.trim(),
        landmark: landmark.trim() || undefined,
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
    <KeyboardAvoider style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Who is registering this, and where the office says it is.
            The reference screen opens with exactly this, and for the
            same reason: a coordinator checks it against the hall they
            are standing in before recording anything. */}
        <Card style={styles.card}>
          <Text style={styles.heading}>Coordinator</Text>
          <Line label="Name" value={me?.fullName} />
          <Line label="Mobile number" value={me?.mobile} />
          <Line label="Email ID" value={me?.email} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.heading}>Venue</Text>
          <Text style={styles.hint}>
            As the program was raised. Ask the office if any of it is wrong.
          </Text>
          <Line label="Venue" value={detail?.venue} />
          <Line label="Mode" value={detail?.mode} />
          <Line label="City" value={detail?.city} />
          <Line label="District" value={detail?.district} />
          <Line label="State" value={detail?.state} />
        </Card>


        {locked ? <Banner tone="info">Finally submitted — read only.</Banner> : null}

        <Card style={styles.card}>
          <Field
            label="Venue name"
            required
            value={name}
            onChangeText={setName}
            placeholder="e.g. District Industries Centre"
            editable={!locked}
            error={errors.name}
          />
          <Field
            label="Address"
            required
            value={address}
            onChangeText={setAddress}
            placeholder="Street, area, city"
            multiline
            editable={!locked}
            error={errors.address}
          />
          <Field
            label="Landmark"
            value={landmark}
            onChangeText={setLandmark}
            placeholder="Optional"
            editable={!locked}
          />
        </Card>

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

        <Card style={styles.card}>
          <PhotoPicker
            label="Exterior photo"
            hint="The building front, with any signage visible."
            value={exterior}
            existingPath={existing?.exteriorPhoto?.url ?? null}
            onPick={setExterior}
            onClear={() => setExterior(null)}
            disabled={locked}
          />
        </Card>

        <Card style={styles.card}>
          <PhotoPicker
            label="Interior photo"
            hint="The hall as set up for the program."
            value={interior}
            existingPath={existing?.interiorPhoto?.url ?? null}
            onPick={setInterior}
            onClear={() => setInterior(null)}
            disabled={locked}
          />
        </Card>

        {failure ? <Banner tone="danger">{failure}</Banner> : null}

        {!locked ? <Button label="Save venue" onPress={save} loading={busy} /> : null}
      </ScrollView>
    </KeyboardAvoider>
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
