import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import {
  photos,
  sessions as sessionsApi,
  trainers as trainersApi,
  workshops,
  type CapturedImage,
} from '../../../src/api/endpoints';
import type { SessionTopic, TrainerOption } from '../../../src/api/types';
import { Picker } from '../../../src/components/Picker';
import { PhotoPicker } from '../../../src/components/PhotoPicker';
import { Banner, Button, Card, Field, KeyboardAvoider, Loading } from '../../../src/components/ui';
import { useGeoFix } from '../../../src/location/useGeoFix';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Record a session: which trainer taught which topic, on which day, with
 * a photograph of it happening.
 *
 * Asked day first, then session, then topic, each narrowing the next. A
 * five-day syllabus is forty topics in one list, and a coordinator on day
 * three is looking at eight of them.
 *
 * What has already been recorded drops out as it goes: a topic with a
 * photograph against it is finished, a session whose topics are all
 * finished is finished, and a day whose sessions are all finished is not
 * offered at all. The list shortens as the programme runs, so the next
 * thing to record is usually the only thing left — and a coordinator
 * cannot photograph the same topic twice by picking it out of a list
 * that still shows it.
 */
export default function SessionManagement() {
  const { id, detail, refresh, locked } = useWorkshop();
  const geo = useGeoFix();

  const [curriculum, setCurriculum] = useState<SessionTopic[] | null>(null);
  const [faculty, setFaculty] = useState<TrainerOption[]>([]);

  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [remark, setRemark] = useState('');
  const [image, setImage] = useState<CapturedImage | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    workshops
      .curriculum(id)
      .then(setCurriculum)
      .catch(() => setCurriculum([]));
  }, [id]);

  useEffect(() => {
    trainersApi
      .options(id)
      .then(setFaculty)
      .catch(() => setFaculty([]));
  }, [id]);

  const recorded = useMemo(() => detail?.sessions ?? [], [detail]);

  /* Every topic that already has a session against it. A topic is done
     when it has been photographed, which is the same thing: the photo
     and the record are saved together. */
  const done = useMemo(
    () => new Set(recorded.map((s) => s.curriculumTopicId)),
    [recorded],
  );

  /* Only what is left. A session with nothing outstanding disappears,
     and so does a day with no sessions left in it. */
  const open = useMemo(
    () =>
      (curriculum ?? [])
        .map((s) => ({ ...s, subTopics: s.subTopics.filter((t) => !done.has(t.topicId)) }))
        .filter((s) => s.subTopics.length > 0),
    [curriculum, done],
  );

  const days = useMemo(() => {
    const seen = new Map<string, string>();
    open.forEach((s) => {
      const key = s.day == null ? 'none' : String(s.day);
      if (!seen.has(key)) seen.set(key, s.day == null ? 'Not set against a day' : `Day ${s.day}`);
    });
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [open]);

  const sessionsForDay = useMemo(
    () => open.filter((s) => (s.day == null ? 'none' : String(s.day)) === day),
    [open, day],
  );

  const topicsForSession = useMemo(
    () => open.find((s) => String(s.sessionId) === sessionId)?.subTopics ?? [],
    [open, sessionId],
  );

  if (curriculum === null) return <Loading label="Loading curriculum…" />;

  const save = async () => {
    const found: Record<string, string> = {};
    if (!trainerId) found.trainerId = 'Select the trainer.';
    if (!day) found.day = 'Select the day.';
    if (!sessionId) found.sessionId = 'Select the session.';
    if (!topicId) found.topicId = 'Select the topic.';
    if (!image) found.photo = 'A session photo is required.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      const fix = await geo.capture();
      const session = await sessionsApi.add(id, {
        trainerId: Number(trainerId),
        curriculumSessionId: Number(sessionId),
        curriculumTopicId: Number(topicId),
        comments: remark.trim() || undefined,
      });
      await photos.session(id, session.id, image!, fix);
      await refresh();

      /* The trainer and the day stay: the next topic is usually the
         same person later the same morning. What was just recorded
         drops out of the lists on its own. */
      setSessionId(null);
      setTopicId(null);
      setRemark('');
      setImage(null);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not record the session.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoider style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {locked ? <Banner tone="info">Finally submitted — read only.</Banner> : null}

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

            {curriculum.length === 0 ? (
              <Banner tone="warning">
                This program has no curriculum attached, so there is nothing to record a
                session against. Ask the office.
              </Banner>
            ) : open.length === 0 ? (
              <Banner tone="success">
                Every topic on the curriculum has been recorded.
              </Banner>
            ) : null}

            <Picker
              label="Trainer"
              required
              value={trainerId}
              options={faculty.map((t) => ({
                value: String(t.id),
                label: t.qualification ? `${t.fullName} · ${t.qualification}` : t.fullName,
              }))}
              hint={
                faculty.length === 0
                  ? 'No trainer has been registered by this agency yet.'
                  : 'Anyone registered by this agency, on any of its programs.'
              }
              searchable
              error={errors.trainerId}
              onChange={setTrainerId}
            />

            <Picker
              label="Day"
              required
              value={day}
              options={days}
              disabled={open.length === 0}
              error={errors.day}
              onChange={(value) => {
                setDay(value);
                setSessionId(null);
                setTopicId(null);
              }}
            />

            <Picker
              label="Session"
              required
              value={sessionId}
              options={sessionsForDay.map((s) => ({
                value: String(s.sessionId),
                label: s.sessionName,
              }))}
              disabled={!day}
              hint={day ? undefined : 'Choose a day first.'}
              error={errors.sessionId}
              onChange={(value) => {
                setSessionId(value);
                setTopicId(null);
              }}
            />

            <Picker
              label="Topic"
              required
              value={topicId}
              options={topicsForSession.map((t) => ({
                value: String(t.topicId),
                label: t.topicName,
              }))}
              disabled={!sessionId}
              hint={sessionId ? undefined : 'Choose a session first.'}
              error={errors.topicId}
              onChange={setTopicId}
            />

            <PhotoPicker
              label="Session photo"
              required
              hint="The session in progress, with participants visible."
              value={image}
              onPick={setImage}
              onClear={() => setImage(null)}
            />
            {errors.photo ? <Banner tone="danger">{errors.photo}</Banner> : null}

            <Field
              label="Remark"
              value={remark}
              onChangeText={setRemark}
              placeholder="Optional"
              multiline
            />

            {failure ? <Banner tone="danger">{failure}</Banner> : null}

            <Button label="Save session" onPress={save} loading={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  card: { gap: spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink900 },
  row: { backgroundColor: colors.ink50, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: 12, color: colors.ink500 },
});
