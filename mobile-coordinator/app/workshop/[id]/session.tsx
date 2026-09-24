import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import {
  photos,
  sessions as sessionsApi,
  workshops,
  type CapturedImage,
} from '../../../src/api/endpoints';
import type { SessionTopic } from '../../../src/api/types';
import { Picker } from '../../../src/components/Picker';
import { PhotoPicker } from '../../../src/components/PhotoPicker';
import { Banner, Button, Card, Field, Loading } from '../../../src/components/ui';
import { useGeoFix } from '../../../src/location/useGeoFix';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Record a session: which trainer delivered which topic, with a photograph of
 * it happening.
 *
 * The programme itself is fixed — the coordinator arrived here from it — so it
 * is shown rather than chosen. Topic narrows sub-topic, which is what stops a
 * session being filed under a pairing the curriculum does not contain.
 */
export default function SessionManagement() {
  const { id, detail, refresh, locked } = useWorkshop();
  const geo = useGeoFix();

  const [topics, setTopics] = useState<SessionTopic[] | null>(null);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [subTopicId, setSubTopicId] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [image, setImage] = useState<CapturedImage | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    workshops
      .curriculum(id)
      .then(setTopics)
      .catch(() => setTopics([]));
  }, [id]);

  /* Sub-topics follow the chosen topic; changing the topic clears the one
     below it so a stale pairing cannot be submitted. */
  const subTopics = useMemo(
    () => topics?.find((t) => String(t.sessionId) === topicId)?.subTopics ?? [],
    [topics, topicId],
  );

  if (topics === null) return <Loading label="Loading curriculum…" />;

  const trainers = detail?.trainers ?? [];
  const recorded = detail?.sessions ?? [];

  const save = async () => {
    const found: Record<string, string> = {};
    if (!trainerId) found.trainerId = 'Select the trainer.';
    if (!topicId) found.topicId = 'Select the topic.';
    if (!subTopicId) found.subTopicId = 'Select the sub-topic.';
    if (!image) found.photo = 'A session photo is required.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      const fix = await geo.capture();
      const session = await sessionsApi.add(id, {
        trainerId: Number(trainerId),
        curriculumSessionId: Number(topicId),
        curriculumTopicId: Number(subTopicId),
        comments: comments.trim() || undefined,
      });
      await photos.session(id, session.id, image!, fix);
      await refresh();

      setTopicId(null);
      setSubTopicId(null);
      setComments('');
      setImage(null);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not record the session.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {locked ? <Banner tone="info">Finally submitted — read only.</Banner> : null}

        <Card style={styles.card}>
          <Text style={styles.heading}>Programme</Text>
          <View style={styles.fixed}>
            <Text style={styles.fixedValue}>{detail?.programmeName}</Text>
            <Text style={styles.fixedMeta}>{detail?.programmeId}</Text>
          </View>
        </Card>

        {recorded.length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Recorded ({recorded.length})</Text>
            {recorded.map((session) => (
              <View key={session.id} style={styles.row}>
                <Text style={styles.rowTitle}>{session.subTopicName}</Text>
                <Text style={styles.rowMeta}>
                  {session.topicName} · {session.trainerName}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {!locked ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Record a session</Text>

            <Picker
              label="Trainer"
              required
              value={trainerId}
              options={trainers.map((t) => ({ value: String(t.id), label: t.fullName }))}
              error={errors.trainerId}
              onChange={setTrainerId}
            />

            <Picker
              label="Topic"
              required
              value={topicId}
              options={topics.map((t) => ({ value: String(t.sessionId), label: t.sessionName }))}
              hint={topics.length === 0 ? 'This programme has no curriculum attached.' : undefined}
              error={errors.topicId}
              onChange={(value) => {
                setTopicId(value);
                setSubTopicId(null);
              }}
            />

            <Picker
              label="Sub-topic"
              required
              value={subTopicId}
              options={subTopics.map((s) => ({ value: String(s.topicId), label: s.topicName }))}
              disabled={!topicId}
              hint={topicId ? undefined : 'Choose a topic first.'}
              error={errors.subTopicId}
              onChange={setSubTopicId}
            />

            <PhotoPicker
              label="Session photo"
              hint="The session in progress, with participants visible."
              value={image}
              onPick={setImage}
            />
            {errors.photo ? <Banner tone="danger">{errors.photo}</Banner> : null}

            <Field
              label="Comments"
              value={comments}
              onChangeText={setComments}
              placeholder="Optional"
              multiline
            />

            {failure ? <Banner tone="danger">{failure}</Banner> : null}

            <Button label="Save session" onPress={save} loading={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink900 },
  fixed: {
    backgroundColor: colors.ink50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink200,
    padding: spacing.md,
    gap: 2,
  },
  fixedValue: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  fixedMeta: { fontSize: 12, color: colors.brand700, fontWeight: '600' },
  row: { backgroundColor: colors.ink50, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: 12, color: colors.ink500 },
});
