import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { me } from '../../src/api/endpoints';
import type { FeedbackInvitation } from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import { Card, EmptyState, Loading, shortDate } from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * The batches that are over and are waiting on this applicant's view of
 * them.
 *
 * A programme they sat appears here once it has been conducted, and stops
 * asking once they have answered. What they said is not listed back to
 * them, because it is not kept against them — the answers go to the batch
 * and nothing records which of the people on it wrote them.
 */
export default function Feedback() {
  const router = useRouter();
  const invitations = useResource<FeedbackInvitation[]>(() => me.feedbackInvitations(), []);

  /* The stable refresh, not the resource: the resource is a fresh object
     every render and depending on it refetches in a loop. */
  useFocusEffect(
    useCallback(() => {
      invitations.refresh();
    }, [invitations.refresh]),
  );

  if (invitations.loading && !invitations.data) {
    return <Loading label="Loading your feedback…" />;
  }

  if (invitations.error && !invitations.data) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Could not load your feedback"
        message={invitations.error}
      />
    );
  }

  const rows = invitations.data ?? [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="chatbox-ellipses-outline"
        title="Nothing to give feedback on"
        message="A program appears here once the batch you attended has been conducted."
      />
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => String(row.participantId)}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={invitations.refreshing} onRefresh={invitations.refresh} />
      }
      ListHeaderComponent={
        <Text style={styles.intro}>
          Your answers are anonymous. They are recorded against the program, not against you.
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          disabled={item.given}
          onPress={() => router.push(`/feedback/${item.participantId}`)}
          accessibilityRole="button"
          accessibilityLabel={`${item.programmeName}, ${item.given ? 'already given' : 'give feedback'}`}
        >
          <Card style={item.given ? styles.cardDone : styles.card}>
            <View style={styles.head}>
              <Text style={styles.title}>{item.programmeName}</Text>
              {item.given ? (
                <View style={styles.done}>
                  <Ionicons name="checkmark" size={13} color={colors.success700} />
                  <Text style={styles.doneText}>Given</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.ink400} />
              )}
            </View>

            <Text style={styles.meta}>{item.programTypeName}</Text>
            <Text style={styles.meta}>
              {`${item.programmeCode} · ended ${shortDate(item.endedOn)}`}
            </Text>

            {item.given ? (
              <Text style={styles.thanks}>
                Thank you. What you wrote is not shown back to you, because it is not kept
                against your name.
              </Text>
            ) : null}
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { fontSize: font.sm, color: colors.ink600, lineHeight: 19, marginBottom: spacing.xs },
  card: { gap: 3 },
  /* Dimmed once given, so the list reads as "these still need you". */
  cardDone: { gap: 3, opacity: 0.75 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  meta: { fontSize: font.xs, color: colors.ink500 },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.success50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  doneText: { fontSize: font.xs, fontWeight: '700', color: colors.success700 },
  thanks: { fontSize: font.xs, color: colors.ink500, lineHeight: 17, marginTop: 4 },
});
