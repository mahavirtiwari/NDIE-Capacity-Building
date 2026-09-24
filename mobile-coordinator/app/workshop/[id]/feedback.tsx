import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '../../../src/api/client';
import { participants as participantsApi } from '../../../src/api/endpoints';
import { Banner, Button, Card, EmptyState, Field } from '../../../src/components/ui';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Participant feedback. Optional, per the manual.
 *
 * One person at a time, chosen from the list. A rating already given is shown
 * back and can be corrected until the workshop is submitted.
 */
export default function Feedback() {
  const { detail, refresh, locked } = useWorkshop();
  const people = detail?.participants ?? [];

  const [chosen, setChosen] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
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

  const open = (id: number) => {
    const found = people.find((p) => p.id === id);
    setChosen(id);
    setRating(found?.feedbackRating ?? 0);
    setComments(found?.feedbackComments ?? '');
    setFailure(null);
  };

  const save = async () => {
    if (!person || rating < 1) return;
    setBusy(true);
    setFailure(null);
    try {
      await participantsApi.feedback(person.id, rating, comments.trim() || undefined);
      await refresh();
      setChosen(null);
      setRating(0);
      setComments('');
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not save the feedback.');
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
          <Text style={styles.heading}>Participants</Text>
          {people.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.row, chosen === item.id && styles.rowOn]}
              disabled={locked}
              onPress={() => open(item.id)}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{item.fullName}</Text>
                <Text style={styles.rowMeta}>{item.enterpriseName}</Text>
              </View>
              <Text style={[styles.tag, !!item.feedbackRating && styles.tagDone]}>
                {item.feedbackRating ? `${item.feedbackRating}/5` : 'Not given'}
              </Text>
            </Pressable>
          ))}
        </Card>

        {person && !locked ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>{person.fullName}</Text>

            <View>
              <Text style={styles.label}>Rating</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable key={value} onPress={() => setRating(value)} hitSlop={6}>
                    <Ionicons
                      name={value <= rating ? 'star' : 'star-outline'}
                      size={30}
                      color={value <= rating ? colors.accent500 : colors.ink300}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            <Field
              label="Comments"
              value={comments}
              onChangeText={setComments}
              placeholder="Optional"
              multiline
            />

            {failure ? <Banner tone="danger">{failure}</Banner> : null}

            <Button label="Save feedback" onPress={save} loading={busy} disabled={rating < 1} />
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
  label: { fontSize: 14, fontWeight: '600', color: colors.ink800, marginBottom: spacing.sm },
  stars: { flexDirection: 'row', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  rowOn: { backgroundColor: colors.brand50 },
  rowText: { flex: 1, gap: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: 12, color: colors.ink500 },
  tag: { fontSize: 12, color: colors.ink400, fontWeight: '600' },
  tagDone: { color: colors.success700 },
});
