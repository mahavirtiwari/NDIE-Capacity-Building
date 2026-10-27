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
import { isLocalId } from '../../../src/offline/outbox';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Record a session: which trainer taught the next topic on the syllabus,
 * with a photograph of it happening.
 *
 * The next topic, and not a topic. The screen used to offer every
 * outstanding topic on every day at once through three pickers, so day
 * three could be recorded on the first morning and the record of what was
 * taught bore no relation to the order the course was laid out in. The
 * curriculum is a sequence; the training follows it; so does this. The
 * server refuses anything else and says which topic is next.
 *
 * A session is in progress from the moment it is started until its
 * photograph lands - two calls, and the second is a photograph taken on a
 * phone at a venue. When it fails the session stays open and is shown here
 * to be finished, rather than disappearing into the report as a topic with
 * no evidence behind it.
 */
export default function SessionManagement() {
  const { id, detail, refresh, readOnly, readOnlyReason } = useWorkshop();
  const geo = useGeoFix();

  const [curriculum, setCurriculum] = useState<SessionTopic[] | null>(null);
  const [faculty, setFaculty] = useState<TrainerOption[]>([]);

  const [trainerId, setTrainerId] = useState<string | null>(null);
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

  /* The one that was started and not finished, if there is one. At most
     one: the server will not open a second.

     A session still in the outbox does not count. It carries a local id,
     its photograph is queued behind it, and the server will finish both
     when they drain - holding the screen on it would leave a coordinator
     with no signal able to record one topic and then nothing at all. */
  const open = useMemo(
    () => recorded.find((s) => s.status === 'InProgress' && !isLocalId(s.id)) ?? null,
    [recorded],
  );

  const finished = useMemo(
    () => recorded.filter((s) => s.status === 'Conducted' || isLocalId(s.id)),
    [recorded],
  );

  /* The syllabus flattened into the order it is taught in: by day, then by
     the order the office put the sessions in, then the topics inside each.
     The same order the server keeps, so what this screen calls next is
     what the server will accept. */
  const planned = useMemo(
    () =>
      (curriculum ?? []).flatMap((session) =>
        session.subTopics.map((topic) => ({
          day: session.day,
          sessionId: session.sessionId,
          sessionName: session.sessionName,
          topicId: topic.topicId,
          topicName: topic.topicName,
        })),
      ),
    [curriculum],
  );

  /* Taken: a topic with any session against it, finished or not. An open
     one holds its place rather than being handed out twice. */
  const taken = useMemo(() => new Set(recorded.map((s) => s.curriculumTopicId)), [recorded]);

  /* What is being recorded now. The open session's topic where one is
     open, otherwise the first topic nobody has reached yet. */
  const next = useMemo(() => {
    if (open) return planned.find((p) => p.topicId === open.curriculumTopicId) ?? null;
    return planned.find((p) => !taken.has(p.topicId)) ?? null;
  }, [open, planned, taken]);

  /* Carried over from the open session, so finishing one does not ask
     again for what is already recorded against it. */
  useEffect(() => {
    if (!open) return;
    setTrainerId(String(open.trainerId));
    setRemark(open.comments ?? '');
  }, [open]);

  if (curriculum === null) return <Loading label="Loading curriculum…" />;

  const where = !next ? '' : next.day == null ? next.sessionName : `Day ${next.day} · ${next.sessionName}`;

  const save = async () => {
    const found: Record<string, string> = {};
    if (!trainerId) found.trainerId = 'Select the trainer.';
    if (!image) found.photo = 'A session photo is required.';
    setErrors(found);
    if (!next || Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      const fix = await geo.capture();
      /* Starting it, or picking the open one back up: the same call either
         way, and the photograph after it is what finishes it. */
      const session = await sessionsApi.add(id, {
        trainerId: Number(trainerId),
        curriculumSessionId: next.sessionId,
        curriculumTopicId: next.topicId,
        comments: remark.trim() || undefined,
      });
      await photos.session(id, session.id, image!, fix);
      await refresh();

      /* The trainer stays: the next topic is usually the same person later
         the same morning. What was just recorded drops out on its own. */
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
        {readOnlyReason ? <Banner tone="info">{readOnlyReason}</Banner> : null}

        {finished.length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Recorded ({finished.length})</Text>
            {finished.map((session) => (
              <View key={session.id} style={styles.row}>
                <Text style={styles.rowTitle}>{session.subTopicName}</Text>
                <Text style={styles.rowMeta}>
                  {session.topicName} · {session.trainerName}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {!readOnly ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>{open ? 'Finish this session' : 'Record a session'}</Text>

            {open ? (
              <Banner tone="warning">
                This session was started and has no photo against it yet. Add one to finish it.
                Nothing else can be recorded until it is done.
              </Banner>
            ) : null}

            {curriculum.length === 0 ? (
              <Banner tone="warning">
                This program has no curriculum attached, so there is nothing to record a session
                against. Ask the office.
              </Banner>
            ) : !next ? (
              <Banner tone="success">Every topic on the curriculum has been recorded.</Banner>
            ) : (
              <View style={styles.next}>
                <Text style={styles.nextLabel}>
                  {open ? 'In progress' : 'Next on the curriculum'}
                </Text>
                <Text style={styles.nextTitle}>{next.topicName}</Text>
                <Text style={styles.nextMeta}>{where}</Text>
                <Text style={styles.nextHint}>
                  Topics are recorded in the order the course is taught in.
                </Text>
              </View>
            )}

            {next ? (
              <>
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

                <Button
                  label={open ? 'Finish session' : 'Save session'}
                  onPress={save}
                  loading={busy}
                />
              </>
            ) : null}
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
  next: { backgroundColor: colors.ink50, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  nextLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nextTitle: { fontSize: 16, fontWeight: '700', color: colors.ink900 },
  nextMeta: { fontSize: 13, color: colors.ink500 },
  nextHint: { fontSize: 12, color: colors.ink500, marginTop: spacing.xs },
});
