import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { workshops } from '../../src/api/endpoints';
import type { Workshop } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { Banner, EmptyState, Loading, shortDate } from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * Where a programme stands from the coordinator's side of it.
 *
 * Not the programme's own status, which is about permission and the
 * calendar. This is about what the person holding the phone has done
 * with it, and the office asked for it in three words:
 *
 *   Scheduled   — yet to be started.
 *   In progress — the venue has been registered, so work has begun.
 *   Completed   — finally submitted, and sealed.
 *
 * Registering the venue is the dividing line rather than the start
 * date, because it is the first thing a coordinator does at a hall and
 * the first thing they do in this app. A batch whose dates have come
 * and gone with nothing recorded against it has not been started, and
 * putting it under "In progress" because of the calendar would hide
 * exactly the programme somebody needs to chase.
 */
type Standing = 'Scheduled' | 'InProgress' | 'Completed';

function standingOf(row: Workshop): Standing {
  if (row.isSubmitted) return 'Completed';
  return row.venueRegistered ? 'InProgress' : 'Scheduled';
}

const ORDER: Standing[] = ['Scheduled', 'InProgress', 'Completed'];
const WORDS: Record<Standing, string> = {
  Scheduled: 'Scheduled',
  InProgress: 'In progress',
  Completed: 'Completed',
};

/** Nothing here, and why — which differs by which of the three is open. */
const BLANK: Record<Standing, { icon: string; title: string; message: string }> = {
  Scheduled: {
    icon: 'calendar-outline',
    title: 'Nothing waiting to start',
    message:
      'Programs appear here once your implementing agency allocates them to you and the '
      + 'operation manager has given permission.',
  },
  InProgress: {
    icon: 'play-circle-outline',
    title: 'Nothing under way',
    message:
      'A program moves here the moment you register its venue. Open a scheduled program '
      + 'and start with the venue.',
  },
  Completed: {
    icon: 'checkmark-done-outline',
    title: 'Nothing submitted yet',
    message:
      'A program moves here once you have finally submitted it. Everything it held on this '
      + 'phone is cleared at that point.',
  },
};

/**
 * The programmes allocated to this coordinator. The app's home screen.
 */
export default function Programs() {
  const router = useRouter();
  const { session } = useAuth();

  const [rows, setRows] = useState<Workshop[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<Standing>('Scheduled');

  const load = useCallback(async () => {
    setFailure(null);
    try {
      setRows(await workshops.mine());
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not load your programs.');
      setRows([]);
    }
  }, []);

  /* On focus rather than on mount: clearing a programme's data or
     submitting one both come back to this screen, and a list that still
     says what was true before the coordinator acted is worse than one
     that takes a moment to catch up. */
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const grouped = useMemo(() => {
    const all = rows ?? [];
    const bucket: Record<Standing, Workshop[]> = {
      Scheduled: [],
      InProgress: [],
      Completed: [],
    };
    all.forEach((row) => bucket[standingOf(row)].push(row));

    /* Soonest first among the two that are still live - the programme
       running today is the one being looked for - and most recently
       finished first among the sealed. */
    bucket.Scheduled.sort((a, b) => a.startDate.localeCompare(b.startDate));
    bucket.InProgress.sort((a, b) => a.startDate.localeCompare(b.startDate));
    bucket.Completed.sort((a, b) => b.startDate.localeCompare(a.startDate));
    return bucket;
  }, [rows]);

  const shown = grouped[open];

  if (rows === null) return <Loading label="Loading your programs…" />;

  return (
    <View style={styles.flex}>
      <View style={styles.who}>
        <Text style={styles.whoName} numberOfLines={1}>
          {session?.fullName}
        </Text>
        <Text style={styles.whoCode}>{session?.userCode}</Text>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            /* try/finally, and only one at a time.

               The spinner is dismissed by the state going back to false,
               so anything that can leave it true leaves a wheel turning
               in the middle of the screen with nothing behind it. A pull
               that lands while another is still in flight did exactly
               that: the second one set it true, the first one set it
               false, and the second had nothing left to turn it off. */
            onRefresh={() => {
              if (refreshing) return;
              setRefreshing(true);
              void (async () => {
                try {
                  await load();
                } finally {
                  setRefreshing(false);
                }
              })();
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {failure ? <Banner tone="danger">{failure}</Banner> : null}

            <View style={styles.tabs}>
              {ORDER.map((standing) => {
                const count = grouped[standing].length;
                const on = open === standing;
                return (
                  <Pressable
                    key={standing}
                    onPress={() => setOpen(standing)}
                    style={[styles.tab, on && styles.tabOn]}
                  >
                    <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                      {WORDS[standing]}
                      {count > 0 ? ` (${count})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={BLANK[open].icon as never}
            title={BLANK[open].title}
            message={BLANK[open].message}
          />
        }
        renderItem={({ item }) => {
          const standing = standingOf(item);
          const sealed = standing === 'Completed';

          const card = (
            <>
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle}>{item.programmeName}</Text>
                {sealed ? (
                  <Ionicons name="lock-closed" size={14} color={colors.ink500} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={colors.ink400} />
                )}
              </View>

              <Text style={styles.rowCode}>{item.programmeId}</Text>
              <Text style={styles.rowMeta}>
                {shortDate(item.startDate)} – {shortDate(item.endDate)}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {[item.venue, item.city, item.state].filter(Boolean).join(' · ')}
              </Text>

              {/* A sealed programme is a line in a register, not a way in.
                  Everything it held was cleared from this phone when it
                  was submitted, so there is nothing behind it to open and
                  the office's copy is the record now. */}
              {sealed ? (
                <Text style={styles.sealed}>
                  Submitted{item.submittedOn ? ` on ${shortDate(item.submittedOn)}` : ''}
                </Text>
              ) : null}
            </>
          );

          if (sealed) return <View style={styles.rowSealed}>{card}</View>;

          return (
            <View style={styles.rowWrap}>
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/workshop/${item.id}/registration`)}
              >
                {card}
              </Pressable>

              {/* Only where there is something to clear. A scheduled
                  programme has nothing on the phone yet. */}
              {standing === 'InProgress' ? (
                <Pressable
                  style={styles.clear}
                  onPress={() => router.push(`/workshop/${item.id}/clear-data`)}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.ink600} />
                  <Text style={styles.clearText}>Clear saved data</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  who: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.brand50,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink200,
    gap: 1,
  },
  whoName: { fontWeight: '600', color: colors.ink900, fontSize: font.base },
  whoCode: { color: colors.ink500, fontSize: font.xs, letterSpacing: 0.4 },

  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md },

  /* Three now, so they share the width rather than sitting at their own
     sizes: at three the row wrapped on a narrow handset and the third
     looked like it belonged to something else. */
  tabs: { flexDirection: 'row', gap: spacing.xs },
  tab: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  tabText: { fontSize: font.xs, fontWeight: '600', color: colors.ink600 },
  tabTextOn: { color: colors.brand700 },

  rowWrap: { gap: 0 },
  row: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink200,
    padding: spacing.lg,
    gap: 3,
  },
  rowSealed: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink200,
    padding: spacing.lg,
    gap: 3,
    opacity: 0.85,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: { flex: 1, fontWeight: '600', fontSize: font.base, color: colors.ink900 },
  rowCode: { color: colors.brand700, fontSize: font.xs, fontWeight: '600' },
  rowMeta: { color: colors.ink500, fontSize: font.xs },
  sealed: { marginTop: spacing.xs, color: colors.ink600, fontSize: font.xs, fontWeight: '600' },

  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  clearText: { fontSize: font.xs, color: colors.ink600, fontWeight: '600' },
});
