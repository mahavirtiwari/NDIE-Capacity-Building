import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../src/api/client';
import { workshops } from '../src/api/endpoints';
import type { Workshop } from '../src/api/types';
import { useAuth } from '../src/auth/AuthContext';
import { Banner, EmptyState, Loading, StatusPill, shortDate } from '../src/components/ui';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * Where a programme stands from the coordinator's side of it.
 *
 * Not the programme's own status, which is about permission and the
 * calendar: this is about what the person holding the phone has left to
 * do. Sealed is the end of it - until then there is always something,
 * even on a programme whose dates have passed.
 */
type Standing = 'InProgress' | 'Scheduled' | 'ToSubmit' | 'Completed';

function standingOf(row: Workshop): Standing {
  if (row.isSubmitted) return 'Completed';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(row.startDate);
  const end = new Date(row.endDate);
  end.setHours(23, 59, 59, 999);

  if (today < start) return 'Scheduled';
  if (today > end) return 'ToSubmit';
  return 'InProgress';
}

const WORDS: Record<Standing, string> = {
  InProgress: 'Running now',
  Scheduled: 'Scheduled',
  ToSubmit: 'Waiting to be submitted',
  Completed: 'Submitted',
};

/**
 * The programmes assigned to this coordinator. The app's home screen.
 *
 * Everything still to do is listed first and by itself, because that is
 * what somebody opens this app to find. A programme leaves that list when
 * it is submitted - not when its dates pass, since a programme whose last
 * day is over still has a report to send.
 */
export default function Workshops() {
  const router = useRouter();
  const { session } = useAuth();

  const [rows, setRows] = useState<Workshop[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const load = useCallback(async () => {
    setFailure(null);
    try {
      setRows(await workshops.mine());
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not load your programs.');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { active, completed } = useMemo(() => {
    const all = rows ?? [];
    return {
      /* Soonest first among the ones still to do: the programme running
         today, or starting tomorrow, is the one being looked for. */
      active: all
        .filter((row) => !row.isSubmitted)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
      /* Most recently finished first. */
      completed: all
        .filter((row) => row.isSubmitted)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    };
  }, [rows]);

  const shown = showCompleted ? completed : active;

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

            <View style={styles.tabs}>
              <Pressable
                onPress={() => setShowCompleted(false)}
                style={[styles.tab, !showCompleted && styles.tabOn]}
              >
                <Text style={[styles.tabText, !showCompleted && styles.tabTextOn]}>
                  To run{active.length > 0 ? ` (${active.length})` : ''}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowCompleted(true)}
                style={[styles.tab, showCompleted && styles.tabOn]}
              >
                <Text style={[styles.tabText, showCompleted && styles.tabTextOn]}>
                  Completed{completed.length > 0 ? ` (${completed.length})` : ''}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          showCompleted ? (
            <EmptyState
              title="Nothing submitted yet"
              message="A program moves here once you have submitted its report."
            />
          ) : (
            <EmptyState
              title="No programs assigned"
              message="Programs appear here once your implementing agency assigns them to you."
            />
          )
        }
        renderItem={({ item }) => {
          const standing = standingOf(item);

          return (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/workshop/${item.id}/registration`)}
            >
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle}>{item.programmeName}</Text>
                {/* What this coordinator has left to do on it, which is a
                    different question from where the batch sits in the
                    office's workflow. */}
                <StatusPill
                  value={WORDS[standing]}
                  tone={
                    standing === 'Completed'
                      ? 'success'
                      : standing === 'InProgress'
                        ? 'primary'
                        : standing === 'ToSubmit'
                          ? 'warning'
                          : 'info'
                  }
                />
              </View>

              <Text style={styles.rowCode}>{item.programmeId}</Text>
              <Text style={styles.rowMeta}>
                {shortDate(item.startDate)} – {shortDate(item.endDate)}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {[item.venue, item.city, item.state].filter(Boolean).join(' · ')}
              </Text>
            </Pressable>
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

  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  tabOn: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  tabText: { fontSize: font.sm, fontWeight: '600', color: colors.ink600 },
  tabTextOn: { color: colors.brand700 },

  row: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink200,
    padding: spacing.lg,
    gap: 3,
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
});
