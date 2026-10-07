import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { me } from '../src/api/endpoints';
import type { MyNotification } from '../src/api/types';
import { EmptyState, Loading, shortDateTime } from '../src/components/ui';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * Everything the scheme has said to this applicant.
 *
 * Fetched rather than remembered from what arrived: a notice sent while
 * the phone was off, or to a handset that never got a push token, is
 * still something they were told. The push is how they hear about it
 * sooner, not the record of it.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MyNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const standing = await me.notifications(50);
      setItems(standing.items);
    } catch {
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const open = async (notice: MyNotification) => {
    if (!notice.isRead) {
      setItems((current) =>
        (current ?? []).map((n) => (n.id === notice.id ? { ...n, isRead: true } : n)),
      );
      try {
        await me.markNotificationRead(notice.id);
      } catch {
        /* It is read either way; the next load will settle it. */
      }
    }
    if (notice.linkPath) router.push(notice.linkPath as never);
  };

  if (items === null) return <Loading label="Loading notifications…" />;

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Nothing yet"
            message="When a programme opens or there is something you need to know, it will appear here."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={[styles.row, !item.isRead && styles.rowUnread]}
            onPress={() => void open(item)}
          >
            <View style={[styles.dot, item.isRead && styles.dotRead]} />
            <View style={styles.body}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.body}</Text>
              <Text style={styles.when}>{shortDateTime(item.sentOn)}</Text>
            </View>
            {item.linkPath ? (
              <Ionicons name="chevron-forward" size={18} color={colors.ink400} />
            ) : null}
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  rowUnread: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: colors.brand600,
  },
  dotRead: { backgroundColor: colors.ink300 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  message: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },
  when: { fontSize: font.xs, color: colors.ink500, marginTop: 2 },
});
