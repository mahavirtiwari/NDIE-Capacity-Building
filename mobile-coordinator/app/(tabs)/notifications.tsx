import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { MyNotification } from '../../src/api/types';
import { Banner, EmptyState, Loading, shortDate } from '../../src/components/ui';
import { current, markRead, refresh, subscribe } from '../../src/notifications/inbox';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * Everything the scheme has said to this coordinator.
 *
 * Fetched rather than remembered from what arrived: a notice sent while
 * the phone was off, or to a handset that never got a push token, is
 * still something they were told. The push is how they hear about it
 * sooner, not the record of it.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const [inbox, setInbox] = useState(current);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => subscribe(setInbox), []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, []),
  );

  const open = async (notice: MyNotification) => {
    await markRead(notice.id);
    if (notice.linkPath) router.push(notice.linkPath as never);
  };

  if (!inbox.loaded) return <Loading label="Loading notifications…" />;

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <FlatList
        data={inbox.items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void refresh().finally(() => setRefreshing(false));
            }}
          />
        }
        /* The failure goes above the list rather than in place of it:
           what was fetched earlier is still worth reading, and an empty
           screen that says "nothing yet" when the truth is "could not
           ask" is the bug this replaced. */
        ListHeaderComponent={
          inbox.error ? <Banner tone="danger">{inbox.error}</Banner> : null
        }
        ListEmptyComponent={
          inbox.error ? null : (
            <EmptyState
              title="Nothing yet"
              message="When a batch is permitted or put off, or there is something you need to know, it will appear here."
            />
          )
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
              <Text style={styles.when}>{shortDate(item.sentOn)}</Text>
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
