import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { me } from '../../src/api/endpoints';
import type { FeedbackForm, FeedbackQuestion } from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import { Picker, RadioGroup } from '../../src/components/Picker';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  KeyboardAvoider,
  Loading,
} from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * One feedback form, answered once.
 *
 * Nothing on this screen is read back afterwards: the answers go to the
 * batch with no record of who gave them, so there is no "your previous
 * answers" to return to. Said plainly at the top, because somebody is
 * more honest when they know that is true.
 */
export default function FeedbackFormScreen() {
  const router = useRouter();
  const { participantId } = useLocalSearchParams<{ participantId: string }>();
  const id = Number(participantId);

  const form = useResource<FeedbackForm>(() => me.feedbackForm(id), [id]);

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: unknown) =>
    setAnswers((current) => ({ ...current, [key]: value }));

  if (form.loading && !form.data) return <Loading label="Loading the questions…" />;

  if (!form.data) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Could not load the questions"
        message={form.error ?? 'Pull down to try again.'}
      />
    );
  }

  const questions = [...form.data.questions].sort((a, b) => a.displayOrder - b.displayOrder);

  const send = async () => {
    const missing = questions.filter(
      (q) => q.required && (answers[q.key] === undefined || answers[q.key] === ''),
    );

    if (missing.length > 0) {
      setError(`Please answer: ${missing.map((q) => q.text).slice(0, 2).join(', ')}${
        missing.length > 2 ? ` and ${missing.length - 2} more.` : '.'
      }`);
      return;
    }

    setSending(true);
    setError(null);
    try {
      await me.submitFeedback(id, answers);
      Alert.alert(
        'Thank you',
        'Your feedback has been recorded anonymously. It is not kept against your name, '
          + 'so it will not be shown back to you.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send your feedback.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoider style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={styles.title}>{form.data.title}</Text>
          {form.data.intro ? <Text style={styles.intro}>{form.data.intro}</Text> : null}
          <Banner tone="info">
            Anonymous. Your answers are recorded against the program, not against you, and
            cannot be read back to you afterwards.
          </Banner>
        </Card>

        {questions.map((question) => (
          <Card key={question.key} style={styles.card}>
            <Text style={styles.question}>
              {question.text}
              {question.required ? <Text style={styles.required}> *</Text> : null}
            </Text>
            {question.helpText ? <Text style={styles.help}>{question.helpText}</Text> : null}

            <Answer
              question={question}
              value={answers[question.key]}
              onChange={(value) => set(question.key, value)}
            />
          </Card>
        ))}

        {error ? <Banner tone="danger">{error}</Banner> : null}

        <Button
          label={sending ? 'Sending…' : 'Send feedback'}
          icon="send"
          onPress={send}
          loading={sending}
        />
      </ScrollView>
    </KeyboardAvoider>
  );
}

/* ------------------------------------------------------------ one answer */

function Answer({
  question,
  value,
  onChange,
}: {
  question: FeedbackQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (question.type) {
    case 'Rating': {
      const max = Math.max(question.maxRating || 5, 2);
      const picked = Number(value) || 0;
      return (
        <View style={styles.stars}>
          {Array.from({ length: max }, (_, i) => i + 1).map((score) => (
            <Pressable
              key={score}
              onPress={() => onChange(score)}
              accessibilityRole="button"
              accessibilityLabel={`${score} out of ${max}`}
              hitSlop={6}
            >
              <Ionicons
                name={score <= picked ? 'star' : 'star-outline'}
                size={30}
                color={score <= picked ? colors.warning700 : colors.ink400}
              />
            </Pressable>
          ))}
        </View>
      );
    }

    case 'YesNo':
      return (
        <RadioGroup
          label=""
          value={typeof value === 'string' ? value : null}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
          onChange={onChange}
        />
      );

    case 'Radio':
      return (
        <RadioGroup
          label=""
          value={typeof value === 'string' ? value : null}
          options={question.options.map((o) => ({ value: o.value, label: o.label }))}
          onChange={onChange}
        />
      );

    case 'Select':
      return (
        <Picker
          label=""
          value={typeof value === 'string' ? value : null}
          options={question.options.map((o) => ({ value: o.value, label: o.label }))}
          onChange={onChange}
        />
      );

    default:
      return (
        <Field
          label=""
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          placeholder="Anything you would like to say"
          multiline
          numberOfLines={4}
          style={styles.textarea}
        />
      );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm },
  title: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  intro: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },
  question: { fontSize: font.sm, fontWeight: '700', color: colors.ink900 },
  required: { color: colors.danger700 },
  help: { fontSize: font.xs, color: colors.ink500 },
  stars: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 4 },
  textarea: { minHeight: 90, textAlignVertical: 'top', borderRadius: radius.md },
});
