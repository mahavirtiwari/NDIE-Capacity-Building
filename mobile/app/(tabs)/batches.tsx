import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { batches as batchesApi } from '../../src/api/endpoints';
import type { ApplicantBatch } from '../../src/api/types';
import { Banner, EmptyState, Loading, shortDate } from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * The programmes an applicant can join: the dated ones, run by the
 * implementing agencies, under the categories their profile clears them
 * for.
 *
 * Distinct from the dashboard, which lists the tracks on offer. A track
 * says what the training is; this says when and where it is actually
 * running, whether there is still room, and - where their own history
 * closes one to them - why they cannot take it.
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

  /** Which batch is being registered, so only its own card says so. */
  const [busy, setBusy] = useState<number | null>(null);

  /**
   * Takes the seat.
   *
   * The server decides whether money is owed — the app only routes on the
   * answer. Confirmed first, because a free registration is immediate and
   * a batch is a date somebody has to turn up on.
   */
  const register = useCallback(
    (batch: ApplicantBatch) => {
      if (batch.isEnrolled || batch.seatsLeft === 0) return;

      /* Why not, before the trip to the server. The same rules are
         enforced there - this only saves the applicant a refusal. */
      if (!batch.canRegister) {
        Alert.alert('You cannot register for this', batch.blockReason ?? 'It is not open to you.');
        return;
      }

      Alert.alert(
        'Register for this batch?',
        [
          batch.programTypeName,
          `${shortDate(batch.startDate)} – ${shortDate(batch.endDate)}`,
          batch.isFeeApplicable ? 'You will be asked to pay the fee.' : '',
        ]
          .filter(Boolean)
          .join('\n'),
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Register',
            onPress: async () => {
              setBusy(batch.id);
              setFailure(null);
              try {
                const outcome = await batchesApi.register(batch.id);
                if (outcome.status === 'PaymentRequired') {
                  router.push(`/payment/${outcome.applicationId}`);
                } else {
                  Alert.alert('Registered', outcome.message);
                }
                await load();
              } catch (caught) {
                setFailure(
                  caught instanceof ApiError ? caught.message : 'Could not register.',
                );
              } finally {
                setBusy(null);
              }
            },
          },
        ],
      );
    },
    [load, router],
  );


  if (rows === null) return <Loading label="Loading programs…" />;

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
          title="No programs open"
          message={
            'Nothing is scheduled under your categories just now, and programs you have '
            + 'already cleared are not listed. Pull down to check again.'
          }
        />
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => register(item)}
          disabled={item.isEnrolled || busy !== null}
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
              <Text style={styles.enrolled}>You are registered for this program</Text>
            ) : busy === item.id ? (
              <Text style={styles.apply}>Registering…</Text>
            ) : item.seatsLeft === 0 ? (
              <Text style={styles.applied}>No seats left</Text>
            ) : !item.canRegister ? (
              /* The rule that closes it, said on the card. Being told only
                 after pressing Register is what this answers. */
              <Text style={styles.blocked}>{item.blockReason}</Text>
            ) : (
              <Text style={styles.apply}>
                {item.isFeeApplicable ? 'Tap to register and pay' : 'Tap to register'}
              </Text>
            )}
          </View>
        </Pressable>
      )}
    />
  );
}

/* Sizes and colours from the tokens, like every other screen. This one had
   grown its own set of numbers, which is how a 12pt line in the palest grey
   ends up carrying the dates and the venue. */
const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900, lineHeight: 21 },
  seats: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.success50,
  },
  seatsGone: { backgroundColor: colors.ink100 },
  seatsText: { fontSize: font.xs, fontWeight: '700', color: colors.success700 },
  seatsGoneText: { color: colors.ink600 },
  code: { fontSize: font.xs, fontWeight: '600', color: colors.brand700, letterSpacing: 0.4 },
  meta: { fontSize: font.sm, color: colors.ink600, lineHeight: 18 },
  foot: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  enrolled: { fontSize: font.sm, fontWeight: '600', color: colors.success700 },
  blocked: { fontSize: font.sm, fontWeight: '600', color: colors.warning700, lineHeight: 18 },
  applied: { fontSize: font.sm, fontWeight: '600', color: colors.warning700 },
  apply: { fontSize: font.sm, fontWeight: '600', color: colors.brand700 },
});
