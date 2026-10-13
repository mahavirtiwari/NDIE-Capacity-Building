import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
   * Whether to list the programs this applicant qualifies for, or all of
   * them.
   *
   * Eligible to begin with: a list of courses somebody cannot take is a
   * longer list and a worse one. Not a filter that hides them for good,
   * though - the ones they do not qualify for say what they would need,
   * and somebody deciding what to study next has a right to read it.
   */
  const [onlyEligible, setOnlyEligible] = useState(true);

  /** The batch whose eligibility is being read, if any. */
  const [eligibility, setEligibility] = useState<ApplicantBatch | null>(null);

  const shown = useMemo(
    () => (rows ?? []).filter((row) => !onlyEligible || row.isEligible),
    [rows, onlyEligible],
  );

  /** How many are being kept back, so the chip can say so. */
  const hidden = (rows ?? []).length - shown.length;

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
    <>
    <FlatList
      data={shown}
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
        <View style={styles.header}>
          {failure ? <Banner tone="danger">{failure}</Banner> : null}

          {/* Only where it changes what is on screen: two chips over a
              list that reads the same either way are two chips nobody
              needs to think about. */}
          {hidden > 0 || !onlyEligible ? (
            <View style={styles.filters}>
              <Pressable
                onPress={() => setOnlyEligible(true)}
                style={[styles.filter, onlyEligible && styles.filterOn]}
              >
                <Text style={[styles.filterText, onlyEligible && styles.filterTextOn]}>
                  For me
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setOnlyEligible(false)}
                style={[styles.filter, !onlyEligible && styles.filterOn]}
              >
                <Text style={[styles.filterText, !onlyEligible && styles.filterTextOn]}>
                  All programs{hidden > 0 ? ` (+${hidden})` : ''}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        onlyEligible && hidden > 0 ? (
          <EmptyState
            title="Nothing open to you yet"
            message={
              `${hidden} program${hidden === 1 ? ' is' : 's are'} scheduled under your `
              + 'categories, but your profile does not meet what they ask for. '
              + 'Tap All programs to see what each one needs.'
            }
          />
        ) : (
          <EmptyState
            title="No programs open"
            message={
              'Nothing is scheduled under your categories just now, and programs you have '
              + 'already cleared are not listed. Pull down to check again.'
            }
          />
        )
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

          {/* What the program asks of somebody, on the card that offers
              it. Shown whether or not they qualify: before registering
              because it is worth knowing what will be checked, and after
              a refusal because "your profile does not meet any of them"
              is only half an answer without them. */}
          {item.eligibilityRoutes.length > 0 ? (
            <Pressable
              style={styles.eligibility}
              hitSlop={6}
              onPress={() => setEligibility(item)}
            >
              <Ionicons name="school-outline" size={15} color={colors.brand700} />
              <Text style={styles.eligibilityText}>View eligibility</Text>
              {!item.isEligible ? (
                <View style={styles.eligibilityFlag}>
                  <Text style={styles.eligibilityFlagText}>Not met</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}

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

    {/* The ways in, as the Super Admin listed them. Any one of them is
        enough, which is why they are numbered rather than bulleted. */}
    <Modal
      visible={eligibility !== null}
      animationType="fade"
      transparent
      onRequestClose={() => setEligibility(null)}
    >
      <Pressable style={styles.backdrop} onPress={() => setEligibility(null)}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle} numberOfLines={2}>
              {eligibility?.programTypeName}
            </Text>
            <Pressable onPress={() => setEligibility(null)} accessibilityLabel="Close" hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.ink600} />
            </Pressable>
          </View>

          <Text style={styles.sheetLead}>
            {(eligibility?.eligibilityRoutes.length ?? 0) > 1
              ? 'You qualify by meeting any one of these.'
              : 'What this program asks for.'}
          </Text>

          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyInner}>
            {(eligibility?.eligibilityRoutes ?? []).map((route, index) => (
              <View key={route.qualificationCode} style={styles.way}>
                <View style={styles.wayHead}>
                  <View style={styles.wayNo}>
                    <Text style={styles.wayNoText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.wayTitle}>{route.summary}</Text>
                </View>

                {route.requirements.map((ask) => (
                  <View key={ask} style={styles.ask}>
                    <Ionicons name="document-text-outline" size={14} color={colors.ink600} />
                    <Text style={styles.askText}>{ask}</Text>
                  </View>
                ))}
              </View>
            ))}

            {/* Said once, at the foot: the papers are read by the
                officer who scrutinises the profile, not by this screen,
                so nobody is stopped from registering for want of an
                upload the app never asked for. */}
            <Text style={styles.sheetNote}>
              Qualification and experience are read from your approved profile. Anything
              else listed here is checked with your profile at scrutiny.
            </Text>

            {eligibility && !eligibility.isEligible && eligibility.blockReason ? (
              <View style={styles.sheetWarn}>
                <Text style={styles.sheetWarnText}>{eligibility.blockReason}</Text>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

/* Sizes and colours from the tokens, like every other screen. This one had
   grown its own set of numbers, which is how a 12pt line in the palest grey
   ends up carrying the dates and the venue. */
const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md },
  filters: { flexDirection: 'row', gap: spacing.sm },
  filter: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterOn: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  filterText: { fontSize: font.sm, fontWeight: '600', color: colors.ink600 },
  filterTextOn: { color: colors.brand700 },

  eligibility: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  eligibilityText: { fontSize: font.sm, fontWeight: '600', color: colors.brand700 },
  eligibilityFlag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.warning50,
  },
  eligibilityFlagText: { fontSize: font.xs, fontWeight: '700', color: colors.warning700 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '80%',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sheetTitle: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  sheetLead: { fontSize: font.sm, color: colors.ink600 },
  sheetBody: { marginTop: spacing.xs },
  sheetBodyInner: { gap: spacing.md, paddingBottom: spacing.lg },
  way: {
    gap: 6,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.ink50,
  },
  wayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wayNo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand700,
  },
  wayNoText: { fontSize: font.xs, fontWeight: '700', color: colors.white },
  wayTitle: { flex: 1, fontSize: font.sm, fontWeight: '700', color: colors.ink900, lineHeight: 19 },
  ask: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 30 },
  askText: { flex: 1, fontSize: font.sm, color: colors.ink600, lineHeight: 18 },
  sheetNote: { fontSize: font.xs, color: colors.ink500, lineHeight: 17 },
  sheetWarn: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warning50,
  },
  sheetWarnText: { fontSize: font.sm, color: colors.warning700, lineHeight: 18 },
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
