import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { exam } from '../../../src/api/endpoints';
import type { ExamResult, ExamSitting } from '../../../src/api/types';
import { Banner, Button, Card, DetailRow, Loading, Title } from '../../../src/components/ui';
import { colors, font, radius, spacing } from '../../../src/theme';

/**
 * The paper itself.
 *
 * One question at a time, because a phone shows one question well and a
 * scrolling wall of them badly, with a grid to jump around and see what is
 * still blank.
 *
 * Every answer is sent as it is given rather than all at the end. A candidate
 * whose phone dies on the last question has still answered the first twenty,
 * and the server has them. The countdown runs from the seconds the server
 * reported, never the device clock, and when it reaches zero the paper submits
 * itself — which is what happens in a hall.
 */
export default function ExamSittingScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const id = Number(attemptId);
  const router = useRouter();

  const [sitting, setSitting] = useState<ExamSitting | null>(null);
  const [chosen, setChosen] = useState<Record<number, number[]>>({});
  const [at, setAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [unsent, setUnsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);

  /* Guards the auto-submit: a tick and a tap must not both submit. */
  const closing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await exam.resume(id);
        if (cancelled) return;
        setSitting(loaded);
        setRemaining(loaded.secondsRemaining);
        setChosen(
          Object.fromEntries(loaded.questions.map((q) => [q.id, q.selectedOptionIds])),
        );
      } catch (caught) {
        if (!cancelled) {
          setFailure(caught instanceof ApiError ? caught.message : 'Could not open the paper.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const finish = useCallback(
    async (reason: 'timeUp' | 'byHand') => {
      if (closing.current) return;
      closing.current = true;
      setSubmitting(true);
      try {
        setResult(await exam.submit(id));
      } catch (caught) {
        closing.current = false;
        setSubmitting(false);
        setFailure(
          caught instanceof ApiError
            ? caught.message
            : reason === 'timeUp'
              ? 'Your time is up, but the paper could not be submitted. Find a signal and try again.'
              : 'Could not submit the paper.',
        );
      }
    },
    [id],
  );

  /* One timer for the whole sitting, counting the server's seconds down. */
  useEffect(() => {
    if (!sitting || result) return;
    const tick = setInterval(() => {
      setRemaining((left) => {
        if (left <= 1) {
          clearInterval(tick);
          void finish('timeUp');
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [sitting, result, finish]);

  /* The hardware back button must not drop somebody out of a running paper. */
  useEffect(() => {
    if (result) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Leave the paper?',
        'The clock keeps running. Your answers so far are saved.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => router.back() },
        ],
      );
      return true;
    });
    return () => sub.remove();
  }, [result, router]);

  if (failure && !sitting) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Banner tone="danger">{failure}</Banner>
      </ScrollView>
    );
  }

  if (!sitting) return <Loading label="Opening the paper…" />;

  if (result) return <Result result={result} onDone={() => router.replace('/(tabs)/applications')} />;

  const question = sitting.questions[at];
  const answered = Object.values(chosen).filter((ids) => ids.length > 0).length;
  const low = remaining <= 300;

  const choose = async (option: number) => {
    const multiple = question.type === 'MultipleChoice';
    const current = chosen[question.id] ?? [];

    const next = multiple
      ? current.includes(option)
        ? current.filter((id) => id !== option)
        : [...current, option]
      : /* Tapping the chosen answer again takes it back, which under negative
           marking is the difference between wrong and unanswered. */
        current.includes(option)
        ? []
        : [option];

    setChosen((prev) => ({ ...prev, [question.id]: next }));

    try {
      await exam.answer(id, [{ questionId: question.id, optionIds: next }]);
      setUnsent(false);
      setFailure(null);
    } catch (caught) {
      /* Kept on screen and flagged: the answer is in the app but not on the
         server, and the candidate should know before the clock runs out. */
      setUnsent(true);
      if (caught instanceof ApiError && caught.status !== 0) setFailure(caught.message);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.bar, low && styles.barLow]}>
        <Text style={[styles.clock, low && styles.clockLow]}>
          <Ionicons name="time-outline" size={14} /> {clock(remaining)}
        </Text>
        <Text style={styles.progress}>
          {answered} of {sitting.questions.length} answered
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {unsent ? (
          <Banner tone="warning">
            The last answer has not reached the server. Find a signal — answers only count once
            they are sent.
          </Banner>
        ) : null}
        {failure ? <Banner tone="danger">{failure}</Banner> : null}

        <View style={styles.grid}>
          {sitting.questions.map((q, index) => {
            const done = (chosen[q.id] ?? []).length > 0;
            return (
              <Pressable
                key={q.id}
                onPress={() => setAt(index)}
                style={[styles.pip, done && styles.pipDone, index === at && styles.pipAt]}
              >
                <Text style={[styles.pipText, done && styles.pipTextDone]}>{index + 1}</Text>
              </Pressable>
            );
          })}
        </View>

        <Card>
          <Text style={styles.qMeta}>
            Question {at + 1} · {question.marks} mark{question.marks === 1 ? '' : 's'}
            {question.negativeMarks > 0 ? ` · −${question.negativeMarks} if wrong` : ''}
            {question.type === 'MultipleChoice' ? ' · choose all that apply' : ''}
          </Text>
          <Text style={styles.qText}>{question.text}</Text>

          <View style={styles.options}>
            {question.options.map((option) => {
              const picked = (chosen[question.id] ?? []).includes(option.id);
              return (
                <Pressable
                  key={option.id}
                  style={[styles.option, picked && styles.optionPicked]}
                  onPress={() => void choose(option.id)}
                >
                  <Ionicons
                    name={
                      question.type === 'MultipleChoice'
                        ? picked
                          ? 'checkbox'
                          : 'square-outline'
                        : picked
                          ? 'radio-button-on'
                          : 'radio-button-off'
                    }
                    size={18}
                    color={picked ? colors.brand600 : colors.ink400}
                  />
                  <Text style={[styles.optionText, picked && styles.optionTextPicked]}>
                    {option.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <View style={styles.nav}>
          <Button
            label="Previous"
            variant="secondary"
            disabled={at === 0}
            onPress={() => setAt((index) => Math.max(0, index - 1))}
            style={styles.navButton}
          />
          <Button
            label="Next"
            variant="secondary"
            disabled={at >= sitting.questions.length - 1}
            onPress={() => setAt((index) => Math.min(sitting.questions.length - 1, index + 1))}
            style={styles.navButton}
          />
        </View>

        <Button
          label="Submit the paper"
          loading={submitting}
          onPress={() =>
            Alert.alert(
              'Submit the paper?',
              answered === sitting.questions.length
                ? 'Your answers will be marked and cannot be changed afterwards.'
                : `${sitting.questions.length - answered} question(s) are unanswered. ` +
                  'They will score nothing.',
              [
                { text: 'Keep working', style: 'cancel' },
                { text: 'Submit', onPress: () => void finish('byHand') },
              ],
            )
          }
        />
      </ScrollView>
    </View>
  );
}

/* --------------------------------------------------------------- result */

function Result({ result, onDone }: { result: ExamResult; onDone: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Title>{result.status === 'Expired' ? 'Time up' : 'Paper submitted'}</Title>

      <Card>
        <DetailRow
          label="Score"
          value={`${result.score} of ${result.paperTotal} · ${result.percentage}%`}
        />
        <DetailRow label="Answered" value={`${result.answered} of ${result.questionCount}`} />
        <DetailRow label="This paper" value={result.passed ? 'Passed' : 'Not passed'} />
        {result.writtenMarks != null ? (
          <DetailRow label="Counted towards the programme" value={`${result.writtenMarks} marks`} />
        ) : null}
        <DetailRow label="Programme result" value={result.programmeResult} />
      </Card>

      {result.programmeResult === 'Pending' ? (
        <Banner tone="info">
          Your programme result waits on the rest of the assessment — the viva or practical, where
          your programme has one.
        </Banner>
      ) : null}

      <Button label="Back to my enrolments" onPress={onDone} />
    </ScrollView>
  );
}

/** mm:ss, which is how long is left rather than what the time is. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  bar: {
    alignItems: 'center',
    backgroundColor: colors.blush,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  barLow: { backgroundColor: colors.danger50 },
  clock: { fontSize: font.md, fontWeight: '700', color: colors.brand700 },
  clockLow: { color: colors.danger700 },
  progress: { fontSize: font.xs, color: colors.ink600, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pip: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  pipDone: { backgroundColor: colors.brand100, borderColor: colors.brand500 },
  pipAt: { borderColor: colors.brand700, borderWidth: 2 },
  pipText: { fontSize: font.xs, color: colors.ink500, fontWeight: '600' },
  pipTextDone: { color: colors.brand700 },

  qMeta: { fontSize: font.xs, color: colors.ink500, marginBottom: 6 },
  qText: { fontSize: font.base, color: colors.ink900, lineHeight: 22 },
  options: { gap: spacing.sm, marginTop: spacing.md },
  option: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  optionPicked: { backgroundColor: colors.brand100, borderColor: colors.brand500 },
  optionText: { color: colors.ink700, flex: 1, fontSize: font.sm, lineHeight: 20 },
  optionTextPicked: { color: colors.ink900, fontWeight: '600' },

  nav: { flexDirection: 'row', gap: spacing.md },
  navButton: { flex: 1 },
});
