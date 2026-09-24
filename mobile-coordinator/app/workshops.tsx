import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../src/api/client';
import { workshops } from '../src/api/endpoints';
import type { Workshop } from '../src/api/types';
import { useAuth } from '../src/auth/AuthContext';
import { Banner, EmptyState, Loading, StatusPill, shortDate } from '../src/components/ui';
import { colors, radius, spacing } from '../src/theme';

/** The workshops this coordinator is assigned to. The app's home screen. */
export default function Workshops() {
  const router = useRouter();
  const { session, signOut } = useAuth();

  const [rows, setRows] = useState<Workshop[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailure(null);
    try {
      setRows(await workshops.mine());
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not load your workshops.');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (rows === null) return <Loading label="Loading your workshops…" />;

  return (
    <View style={styles.flex}>
      <View style={styles.who}>
        <View style={styles.whoText}>
          <Text style={styles.whoName}>{session?.fullName}</Text>
          <Text style={styles.whoCode}>{session?.userCode}</Text>
        </View>
        <Pressable onPress={() => void signOut()} hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {failure ? (
        <View style={styles.pad}>
          <Banner tone="danger">{failure}</Banner>
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <EmptyState
            title="No workshops assigned"
            message="Workshops appear here once your implementing agency assigns them to you."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/workshop/${item.id}/registration`)}
          >
            <View style={styles.rowHead}>
              <Text style={styles.rowTitle}>{item.programmeName}</Text>
              {/* Submitted is the state that matters most here: it decides
                  whether anything can still be recorded. */}
              <StatusPill
                value={item.isSubmitted ? 'Submitted' : item.status}
                tone={item.isSubmitted ? 'success' : 'info'}
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
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.brand50,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink200,
  },
  whoText: { gap: 1 },
  whoName: { fontWeight: '600', color: colors.ink900, fontSize: 15 },
  whoCode: { color: colors.ink500, fontSize: 12 },
  signOut: { color: colors.brand700, fontWeight: '600', fontSize: 14 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink200,
    padding: spacing.lg,
    gap: 3,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowTitle: { flex: 1, fontWeight: '600', fontSize: 15, color: colors.ink900 },
  rowCode: { color: colors.brand700, fontSize: 12, fontWeight: '600' },
  rowMeta: { color: colors.ink500, fontSize: 12 },
});
