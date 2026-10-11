import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../../../src/api/client';
import { exam } from '../../../src/api/endpoints';
import type { ExamQuestion, ExamResult, ExamSitting } from '../../../src/api/types';
import { Banner, Button, Card, DetailRow, Loading, Title } from '../../../src/components/ui';
import { useSiteText } from '../../../src/content/SiteTextContext';
import { colors, font, radius, spacing } from '../../../src/theme';

/** How many questions are put on one screen before Save and next. */
const PAGE_SIZE = 10;

/**
 * The paper itself.
 *
 * Ten questions to a screen, saved together by Save and next, and a review
 * screen at the end that lists every question with the answer given and
 * carries the declaration. One question at a time meant a tap and a round
 * trip for every single answer; ten is a page somebody can work through.
 *
 * Every answer is still sent as it is given rather than all at the end. A
 * candidate whose phone dies on the last question has still answered the
 * first twenty, and the server has them. The countdown runs from the
 * seconds the server reported, never the device clock, and when it reaches
 * zero the paper submits itself — which is what happens in a hall.
 *
 * Leaving the app closes the paper. An online sitting is supervised by
 * nothing except the phone, and the one thing the phone can see is whether
 * the candidate is still looking at it: a call taken, a switch to another
 * app or the screen going away ends the sitting, and the next attempt
 * starts at question one.
 */
export default function ExamSittingScreen() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const id = Number(attemptId);
  const router = useRouter();
  const words = useSiteText();

  const [sitting, setSitting] = useState<ExamSitting | null>(null);
  const [chosen, setChosen] = useState<Record<number, number[]>>({});
  const [page, setPage] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);

  /*
   * Answers the server has not taken yet.
   *
   * An answer that fails to send stays here and goes with the next one, and
   * again before the paper is submitted. Clearing the warning on the next
   * success would tell the candidate everything had landed while one of their
   * answers was still sitting on the phone.
   */
  const pending = useRef<Map<number, number[]>>(new Map());
  const [unsent, setUnsent] = useState(0);

  /* Guards the auto-submit: a tick and a tap must not both submit. */
  const closing = useRef(false);

  /** Set once the sitting has been given up, so nothing closes it twice. */
  const abandoned = useRef(false);

  const top = useRef<ScrollView>(null);

  /** Sends everything outstanding. Returns whether the server took it all. */
  const flush = useCallback(async () => {
    if (pending.current.size === 0) return true;

    const batch = [...pending.current].map(([questionId, optionIds]) => ({
      questionId,
      optionIds,
    }));

    try {
      await exam.answer(id, batch);

      /* Only what was actually sent is cleared: a tap during the round trip
         changed the answer again, and that one still has to go. */
      for (const answer of batch) {
        const latest = pending.current.get(answer.questionId);
        if (latest && sameIds(latest, answer.optionIds)) {
          pending.current.delete(answer.questionId);
        }
      }
      setUnsent(pending.current.size);
      setFailure(null);
      return pending.current.size === 0;
    } catch (caught) {
      setUnsent(pending.current.size);
      if (caught instanceof ApiError && caught.status !== 0) setFailure(caught.message);
      return false;
    }
  }, [id]);

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

      /* One last try at anything outstanding. On the bell it goes either way —
         the server closes the paper on what it has, which is the honest
         outcome — but by hand it waits, because there is still time to find a
         signal. */
      const sent = await flush();
      if (!sent && reason === 'byHand') {
        setFailure('Some answers have not reached the server yet. Find a signal and try again.');
        return;
      }

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
    [id, flush],
  );

  /**
   * Gives the sitting up because the candidate left the app.
   *
   * Everything answered so far goes with it, so the attempt is closed on
   * what it had rather than on nothing. Best effort: the phone may be
   * locked a second later, and the server closes the paper when the clock
   * runs out regardless.
   */
  const giveUp = useCallback(async () => {
    if (abandoned.current || closing.current) return;
    abandoned.current = true;
    await flush().catch(() => false);
    await exam.abandon(id).catch(() => false);
  }, [id, flush]);

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

  /*
   * Leaving the app ends the sitting.
   *
   * Anything other than active counts: another app, the home screen, the
   * lock button, and a telephone call, which is the common one and is not
   * allowed during a paper. iOS reports a call banner or a swipe from the
   * top as inactive before it reports background, so both are taken —
   * strictly, because an unsupervised paper has nothing else keeping it
   * honest.
   *
   * On the way back the candidate is told, and sent to the desk to start
   * again. The paper does not resume: the attempt behind it is closed.
   */
  useEffect(() => {
    if (result) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void giveUp();
        return;
      }

      if (!abandoned.current) return;

      Alert.alert(
        'The paper was closed',
        'You left the app while the examination was open, so the sitting was ended. '
          + 'Start again from the first question.',
        [
          {
            text: 'Back to the examination',
            onPress: () =>
              router.replace(
                sitting ? `/exam/${sitting.participantId}` : '/exam',
              ),
          },
        ],
        { cancelable: false },
      );
    });

    return () => sub.remove();
  }, [giveUp, result, router, sitting]);

  /* The hardware back button leaves the paper, which ends it for the same
     reason as leaving the app does. Asked first, because a stray press
     should not cost somebody their sitting without a word. */
  useEffect(() => {
    if (result) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Leave the paper?',
        'The sitting will be closed and you will have to start again from the first question.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              await giveUp();
              router.replace(sitting ? `/exam/${sitting.participantId}` : '/exam');
            },
          },
        ],
      );
      return true;
    });
    return () => sub.remove();
  }, [giveUp, result, router, sitting]);

  const questions = sitting?.questions ?? [];
  const pageCount = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const onPage = useMemo(
    () => questions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [questions, page],
  );

  if (failure && !sitting) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Banner tone="danger">{failure}</Banner>
      </ScrollView>
    );
  }

  if (!sitting) return <Loading label="Opening the paper…" />;

  if (result) {
    return <Result result={result} onDone={() => router.replace('/(tabs)/applications')} />;
  }

  const answered = Object.values(chosen).filter((ids) => ids.length > 0).length;
  const low = remaining <= 300;

  const choose = async (question: ExamQuestion, option: number) => {
    const multiple = question.type === 'MultipleChoice';
    const current = chosen[question.id] ?? [];

    const next = multiple
      ? current.includes(option)
        ? current.filter((optionId) => optionId !== option)
        : [...current, option]
      : /* Tapping the chosen answer again takes it back, which under negative
           marking is the difference between wrong and unanswered. */
        current.includes(option)
        ? []
        : [option];

    setChosen((prev) => ({ ...prev, [question.id]: next }));

    /* Queued, and sent with the page rather than on every tap: ten
       questions used to be ten round trips. Anything a failed send left
       behind goes with the next one. */
    pending.current.set(question.id, next);
    setUnsent(pending.current.size);
  };

  const saveAndGo = async (to: number | 'review') => {
    await flush();
    if (to === 'review') {
      setReviewing(true);
    } else {
      setReviewing(false);
      setPage(to);
    }
    top.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.bar, low && styles.barLow]}>
        <Text style={[styles.clock, low && styles.clockLow]}>
          <Ionicons name="time-outline" size={14} /> {clock(remaining)}
        </Text>
        <Text style={styles.progress}>
          {answered} of {questions.length} answered
        </Text>
      </View>

      <ScrollView ref={top} contentContainerStyle={styles.content}>
        {unsent > 0 ? (
          <Banner tone="warning">
            {unsent} answer{unsent === 1 ? ' has' : 's have'} not reached the server.{' '}
            {words(
              'exam.unsent',
              'Find a signal — answers only count once they are sent, and they go again with Save and next.',
            )}
          </Banner>
        ) : null}
        {failure ? <Banner tone="danger">{failure}</Banner> : null}

        {reviewing ? (
          <Review
            questions={questions}
            chosen={chosen}
            declared={declared}
            onDeclare={setDeclared}
            onJump={(index) => void saveAndGo(Math.floor(index / PAGE_SIZE))}
            submitting={submitting}
            onSubmit={() =>
              Alert.alert(
                'Submit the paper?',
                answered === questions.length
                  ? 'Your answers will be marked and cannot be changed afterwards.'
                  : `${questions.length - answered} question(s) are unanswered. `
                    + 'They will score nothing.',
                [
                  { text: 'Keep working', style: 'cancel' },
                  { text: 'Submit', onPress: () => void finish('byHand') },
                ],
              )
            }
          />
        ) : (
          <>
            <Text style={styles.pageOf}>
              Page {page + 1} of {pageCount} · questions {page * PAGE_SIZE + 1} to{' '}
              {page * PAGE_SIZE + onPage.length}
            </Text>

            {onPage.map((question, index) => (
              <Card key={question.id}>
                <Text style={styles.qMeta}>
                  Question {page * PAGE_SIZE + index + 1} · {question.marks} mark
                  {question.marks === 1 ? '' : 's'}
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
                        onPress={() => void choose(question, option.id)}
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
            ))}

            <View style={styles.nav}>
              <Button
                label="Previous"
                variant="secondary"
                disabled={page === 0}
                onPress={() => void saveAndGo(Math.max(0, page - 1))}
                style={styles.navButton}
              />
              <Button
                label={page >= pageCount - 1 ? 'Save and review' : 'Save and next'}
                onPress={() => void saveAndGo(page >= pageCount - 1 ? 'review' : page + 1)}
                style={styles.navButton}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* --------------------------------------------------------------- review */

/**
 * Every question and what was answered, before anything is submitted.
 *
 * The declaration is the last thing: a candidate should say the work is
 * theirs with the whole paper in front of them, not at the top of a screen
 * they have not read.
 */
function Review({
  questions,
  chosen,
  declared,
  onDeclare,
  onJump,
  submitting,
  onSubmit,
}: {
  questions: ExamQuestion[];
  chosen: Record<number, number[]>;
  declared: boolean;
  onDeclare: (value: boolean) => void;
  onJump: (index: number) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const missing = questions.filter((q) => (chosen[q.id] ?? []).length === 0).length;

  return (
    <>
      <Title>Check your paper</Title>

      {missing > 0 ? (
        <Banner tone="warning">
          {missing} question{missing === 1 ? ' is' : 's are'} unanswered. Tap one to go back
          to it.
        </Banner>
      ) : (
        <Banner tone="success">Every question has been answered.</Banner>
      )}

      <Card>
        {questions.map((question, index) => {
          const picked = chosen[question.id] ?? [];
          const text = question.options
            .filter((option) => picked.includes(option.id))
            .map((option) => option.text)
            .join(', ');

          return (
            <Pressable key={question.id} onPress={() => onJump(index)} style={styles.reviewRow}>
              <Text style={styles.reviewNo}>{index + 1}</Text>
              <View style={styles.reviewBody}>
                <Text style={styles.reviewQuestion} numberOfLines={2}>
                  {question.text}
                </Text>
                <Text style={[styles.reviewAnswer, !text && styles.reviewMissing]}>
                  {text || 'Not answered'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.ink400} />
            </Pressable>
          );
        })}
      </Card>

      <Pressable
        onPress={() => onDeclare(!declared)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: declared }}
        style={styles.declare}
      >
        <Ionicons
          name={declared ? 'checkbox' : 'square-outline'}
          size={20}
          color={declared ? colors.brand600 : colors.ink400}
        />
        <Text style={styles.declareText}>
          I declare that I have answered this paper myself, without help from any person or
          material, and that the answers above are my own.
        </Text>
      </Pressable>

      <Button
        label="Submit the paper"
        loading={submitting}
        disabled={!declared}
        onPress={onSubmit}
      />
    </>
  );
}

/* --------------------------------------------------------------- result */

function Result({ result, onDone }: { result: ExamResult; onDone: () => void }) {
  const words = useSiteText();

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
          <DetailRow label="Counted towards the program" value={`${result.writtenMarks} marks`} />
        ) : null}
        <DetailRow label="Program result" value={result.programmeResult} />
      </Card>

      {result.programmeResult === 'Pending' ? (
        <Banner tone="info">
          {words(
            'exam.resultPending',
            'Your program result waits on the rest of the assessment — the viva or practical, where your program has one.',
          )}
        </Banner>
      ) : null}

      <Button label="Back to my enrolments" onPress={onDone} />
    </ScrollView>
  );
}

/** Whether two choices are the same answer, order aside. */
function sameIds(a: number[], b: number[]): boolean {
  return a.length === b.length && [...a].sort().every((id, i) => id === [...b].sort()[i]);
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

  pageOf: { fontSize: font.xs, fontWeight: '700', color: colors.ink600, letterSpacing: 0.4 },

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

  reviewRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  reviewNo: {
    color: colors.ink500,
    fontSize: font.xs,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'right',
  },
  reviewBody: { flex: 1, gap: 2 },
  reviewQuestion: { color: colors.ink700, fontSize: font.xs, lineHeight: 17 },
  reviewAnswer: { color: colors.ink900, fontSize: font.sm, fontWeight: '600' },
  reviewMissing: { color: colors.warning700, fontWeight: '600' },

  declare: {
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  declareText: { color: colors.ink700, flex: 1, fontSize: font.sm, lineHeight: 19 },
});
