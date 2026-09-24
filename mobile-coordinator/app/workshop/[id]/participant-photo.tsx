import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { photos, type CapturedImage } from '../../../src/api/endpoints';
import { PhotoPicker } from '../../../src/components/PhotoPicker';
import { Banner, Button, Card, EmptyState } from '../../../src/components/ui';
import { useGeoFix } from '../../../src/location/useGeoFix';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * One photograph per participant. Optional, per the manual.
 *
 * Pick a person, then take their photo. The list shows who already has one, so
 * a coordinator working down a queue can see at a glance where they had got to.
 */
export default function ParticipantPhoto() {
  const { id, detail, refresh, locked } = useWorkshop();
  const geo = useGeoFix();

  const people = detail?.participants ?? [];
  const [chosen, setChosen] = useState<number | null>(null);
  const [image, setImage] = useState<CapturedImage | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (people.length === 0) {
    return (
      <EmptyState
        title="No participants yet"
        message="Register participants on the On-spot registration screen first."
      />
    );
  }

  const person = people.find((p) => p.id === chosen) ?? null;

  const upload = async () => {
    if (!person || !image) return;
    setBusy(true);
    setFailure(null);
    try {
      const fix = await geo.capture();
      await photos.participant(id, person.id, image, fix);
      await refresh();
      setImage(null);
      setChosen(null);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not upload the photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {locked ? <Banner tone="info">Finally submitted — read only.</Banner> : null}

      <Card style={styles.card}>
        <Text style={styles.heading}>Participants</Text>
        {people.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.row, chosen === item.id && styles.rowOn]}
            disabled={locked}
            onPress={() => {
              setChosen(item.id);
              setImage(null);
            }}
          >
            {item.photo ? (
              <Image
                source={{ uri: photos.src(item.photo.kind, item.photo.url) }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.initial}>{item.fullName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.rowText}>
              <Text style={styles.rowName}>{item.fullName}</Text>
              <Text style={styles.rowMeta}>{item.enterpriseName}</Text>
            </View>
            <Text style={[styles.tag, item.photo && styles.tagDone]}>
              {item.photo ? 'Photo taken' : 'No photo'}
            </Text>
          </Pressable>
        ))}
      </Card>

      {person && !locked ? (
        <Card style={styles.card}>
          <Text style={styles.heading}>{person.fullName}</Text>
          <PhotoPicker
            label="Participant photo"
            hint="Optional. A clear head and shoulders shot."
            value={image}
            existingUrl={person.photo ? photos.src(person.photo.kind, person.photo.url) : null}
            onPick={setImage}
          />
          {failure ? <Banner tone="danger">{failure}</Banner> : null}
          <Button label="Upload photo" onPress={upload} loading={busy} disabled={!image} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink900 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  rowOn: { backgroundColor: colors.brand50 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink100 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '700', color: colors.ink500 },
  rowText: { flex: 1, gap: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: 12, color: colors.ink500 },
  tag: { fontSize: 11, color: colors.ink400, fontWeight: '600' },
  tagDone: { color: colors.success700 },
});
