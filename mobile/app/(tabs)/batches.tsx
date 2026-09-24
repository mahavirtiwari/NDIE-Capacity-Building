import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { batches as batchesApi } from '../../src/api/endpoints';
import type { ApplicantBatch } from '../../src/api/types';
import { Banner, EmptyState, Loading, shortDate } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

/**
 * The dated batches an applicant can join.
 *
 * Distinct from the Programmes tab, which lists the tracks on offer. A track
 * says what the training is; a batch says when and where it is actually
 * running, and whether there is still room.
 */
export default function Batches() {
  const router = useRouter();

  const [rows, setRows] = useState<ApplicantBatch[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailure(null);
    try {
      setRows(await batchesApi.mine());
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not load batches.');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (rows === null) return <Loading label="Loading batches…" />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
        failure ? <Banner tone="danger">{failure}</Banner> : null
      }
      ListEmptyComponent={
        <EmptyState
          title="No batches open"
          message="Nothing is scheduled for your track just now. Pull down to check again."
        />
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => router.push(`/apply/${item.programTypeId}`)}
          disabled={item.isEnrolled}
        >
          <View style={styles.head}>
            <Text style={styles.title}>{item.programTypeName}</Text>
            {/* Seats left is the thing that decides whether it is worth
                applying, so it sits where the eye lands first. */}
            <View style={[styles.seats, item.seatsLeft === 0 && styles.seatsGone]}>
              <Text style={[styles.seatsText, item.seatsLeft === 0 && styles.seatsGoneText]}>
                {item.seatsLeft > 0 ? `${item.seatsLeft} left` : 'Full'}
              </Text>
            </View>
          </View>

          <Text style={styles.code}>{item.programmeId}</Text>

          <Text style={styles.meta}>
            {shortDate(item.startDate)} – {shortDate(item.endDate)} · {item.durationDays} days
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.mode === 'Virtual'
              ? 'Online'
              : [item.venue, item.city, item.state].filter(Boolean).join(', ')}
          </Text>
          {item.agencyName ? <Text style={styles.meta}>By {item.agencyName}</Text> : null}

          <View style={styles.foot}>
            {item.isEnrolled ? (
              <Text style={styles.enrolled}>You are enrolled on this batch</Text>
            ) : item.hasApplied ? (
              <Text style={styles.applied}>Application in progress for this track</Text>
            ) : (
              <Text style={styles.apply}>Tap to apply</Text>
            )}
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink200,
    padding: spacing.lg,
    gap: 3,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink900 },
  seats: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.success50,
  },
  seatsGone: { backgroundColor: colors.ink100 },
  seatsText: { fontSize: 11, fontWeight: '700', color: colors.success700 },
  seatsGoneText: { color: colors.ink500 },
  code: { fontSize: 12, fontWeight: '600', color: colors.brand700 },
  meta: { fontSize: 12, color: colors.ink500 },
  foot: { marginTop: spacing.sm },
  enrolled: { fontSize: 12, fontWeight: '600', color: colors.success700 },
  applied: { fontSize: 12, fontWeight: '600', color: colors.warning700 },
  apply: { fontSize: 12, fontWeight: '600', color: colors.brand700 },
});
