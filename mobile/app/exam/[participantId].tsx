import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { exam } from '../../src/api/endpoints';
import type { ExamAvailability } from '../../src/api/types';
import { Banner, Button, Card, DetailRow, Loading, Muted, Title } from '../../src/components/ui';
import { useSiteText } from '../../src/content/SiteTextContext';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * The desk outside the examination room.
 *
 * Everything a candidate should know before the clock starts — how long they
 * have, how many marks, whether a wrong answer costs anything, how many
 * attempts are left — and one button. The rules are the server's; this screen
 * only reports what it was told, so a candidate is never invited to start a
 * paper that will be refused.
 */
export default function ExamIntro() {
  const { participantId } = useLocalSearchParams<{ participantId: string }>();
  const id = Number(participantId);
  const router = useRouter();
  const words = useSiteText();

  const [info, setInfo] = useState<ExamAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setFailure(null);
    try {
      setInfo(await exam.availability(id));
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not load the paper.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setStarting(true);
    setFailure(null);
    try {
      const sitting = await exam.start(id);
      /* Replaced, not pushed: going back from a paper in progress to the desk
         that offers to start one would be a confusing place to land. */
      router.replace(`/exam/sitting/${sitting.attemptId}`);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not open the paper.');
      setStarting(false);
      void load();
    }
  };

  if (loading) return <Loading label="Loading the paper…" />;

  if (!info) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Banner tone="danger">{failure ?? 'The paper is not available.'}</Banner>
      </ScrollView>
    );
  }

  const resuming = info.inProgressAttemptId != null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Title>{info.paperTitle ?? 'Written examination'}</Title>
        <Muted>{info.programmeName}</Muted>
      </View>

      {failure ? <Banner tone="danger">{failure}</Banner> : null}

      {info.hasPaper ? (
        <>
          <Card>
            <DetailRow label="Time allowed" value={`${info.durationMinutes} minutes`} />
            <DetailRow
              label="Questions"
              value={`${info.questionCount} · ${info.totalMarks} marks`}
            />
            <DetailRow label="Pass mark" value={`${info.passPercentage}%`} />
            <DetailRow
              label="Attempts"
              value={`${info.attemptsUsed} of ${info.maxAttempts} used`}
            />
          </Card>

          {info.negativeMarking ? (
            <Banner tone="warning">
              {words(
                'exam.negativeMarking',
                'Wrong answers lose marks on this paper. A question left unanswered costs nothing.',
              )}
            </Banner>
          ) : null}

          {info.instructions ? (
            <Card>
              <Text style={styles.heading}>Instructions</Text>
              <Text style={styles.body}>{info.instructions}</Text>
            </Card>
          ) : null}

          {info.best ? (
            <Card>
              <Text style={styles.heading}>Your best attempt</Text>
              <DetailRow
                label="Score"
                value={`${info.best.score} of ${info.best.paperTotal} · ${info.best.percentage}%`}
              />
              <DetailRow label="This paper" value={info.best.passed ? 'Passed' : 'Not passed'} />
              <DetailRow label="On the programme" value={info.best.programmeResult} />
              <Text style={styles.note}>
                The programme result also waits on the viva, where there is one.
              </Text>
            </Card>
          ) : null}

          {resuming ? (
            <Banner tone="info">
              {words(
                'exam.resumeNote',
                'You have a paper open. Continuing picks it up where you left off — the clock has been running.',
              )}
            </Banner>
          ) : null}

          {info.canSit ? (
            <>
              <Button
                label={resuming ? 'Continue the paper' : 'Start the paper'}
                onPress={start}
                loading={starting}
              />
              {!resuming ? (
                <Text style={styles.note}>
                  <Ionicons name="time-outline" size={13} color={colors.ink500} />{' '}
                  {words(
                    'exam.clockNote',
                    'The clock starts as soon as you tap. Stay on this screen until you have a steady connection.',
                  )}
                </Text>
              ) : null}
            </>
          ) : (
            <Banner tone="info">{info.blocker ?? 'This paper cannot be sat right now.'}</Banner>
          )}
        </>
      ) : (
        <Banner tone="info">
          {info.blocker ?? 'There is no online paper for this programme.'}
        </Banner>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  head: { gap: 2 },
  heading: { fontSize: font.sm, fontWeight: '700', color: colors.ink900, marginBottom: 6 },
  body: { fontSize: font.sm, color: colors.ink700, lineHeight: 20 },
  note: { fontSize: font.xs, color: colors.ink500, lineHeight: 18 },
});
