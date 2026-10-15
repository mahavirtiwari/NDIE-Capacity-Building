import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/auth/AuthContext';
import { Button, EmptyState, Loading } from '../src/components/ui';
import { useNetwork } from '../src/offline/NetworkContext';
import {
  discard,
  drain,
  retry,
  retryAll,
  snapshot,
  subscribe,
  type OutboxEntry,
} from '../src/offline/outbox';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * What this phone has recorded and the server has not got yet.
 *
 * The banner counts it; this says what it is. Without the list there was
 * no way, on the handset or from the office, to find out which piece of
 * the afternoon had not arrived or what the server had said about it —
 * the coordinator saw a number that would not go down, and the office
 * saw a programme missing its participants, and neither could tell the
 * other anything useful.
 *
 * It is also the way out. An entry blocks when the server has refused it
 * several times, and most of the reasons for that are fixed on the
 * server; when they are, these want sending rather than discarding, so
 * Try again is the first thing offered and Discard asks before it does
 * anything.
 */
export default function UnsentScreen() {
  const { session } = useAuth();
  const { online } = useNetwork();
  const owner = session?.userCode ?? null;

  const [entries, setEntries] = useState<OutboxEntry[] | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const all = await snapshot();
    setEntries(owner ? all.filter((e) => e.owner === owner) : all);
  }, [owner]);

  useEffect(() => {
    void refresh();
    return subscribe(() => void refresh());
  }, [refresh]);

  const sendNow = useCallback(async () => {
    if (!owner || !online) return;
    setBusy(true);
    try {
      await drain(owner);
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [owner, online, refresh]);

  const tryAgain = useCallback(
    async (entry: OutboxEntry) => {
      await retry(entry.id);
      await sendNow();
    },
    [sendNow],
  );

  const tryEverything = useCallback(async () => {
    if (!owner) return;
    await retryAll(owner);
    await sendNow();
  }, [owner, sendNow]);

  const throwAway = useCallback(
    (entry: OutboxEntry) => {
      Alert.alert(
        `Discard this ${entry.label.toLowerCase()}?`,
        'It was recorded on this phone and has never reached the server. '
          + 'Discarding it means it is gone for good and will have to be entered again.',
        [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => void discard(entry.id).then(refresh),
          },
        ],
      );
    },
    [refresh],
  );

  if (entries === null) return <Loading label="Reading what is saved…" />;

  const blocked = entries.filter((e) => e.status === 'blocked').length;

  return (
    <>
      <Stack.Screen options={{ title: 'Unsent work' }} />
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          entries.length === 0 ? null : (
            <View style={styles.head}>
              <Text style={styles.headText}>
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'} saved on this
                phone.{' '}
                {online
                  ? 'They send in the order they were recorded.'
                  : 'They will send when you have a signal.'}
              </Text>
              <View style={styles.headActions}>
                <Button
                  label={busy ? 'Sending…' : 'Send now'}
                  onPress={sendNow}
                  disabled={!online || busy}
                />
                {blocked > 0 ? (
                  <Button label="Try all again" variant="secondary" onPress={tryEverything} />
                ) : null}
              </View>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.row, item.status === 'blocked' && styles.rowBlocked]}>
            <View style={styles.rowHead}>
              <Ionicons
                name={item.status === 'blocked' ? 'alert-circle' : 'time-outline'}
                size={16}
                color={item.status === 'blocked' ? colors.danger700 : colors.ink500}
              />
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.when}>{recorded(item.createdAt)}</Text>
            </View>

            {item.status === 'blocked' ? (
              <>
                <Text style={styles.error}>
                  {item.error ?? 'The server would not accept this.'}
                </Text>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => void tryAgain(item)} hitSlop={8}>
                    <Text style={styles.action}>Try again</Text>
                  </Pressable>
                  <Pressable onPress={() => throwAway(item)} hitSlop={8}>
                    <Text style={[styles.action, styles.danger]}>Discard</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.waiting}>
                {online ? 'Waiting its turn to send.' : 'Saved. Waiting for a signal.'}
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="cloud-done-outline"
            title="Everything has been sent"
            message="Nothing recorded on this phone is waiting for the server."
          />
        }
      />
    </>
  );
}

/** "11:42, 15 Oct" — the time first, because that is what is remembered. */
function recorded(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const time = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const day = at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${time}, ${day}`;
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm },
  head: { gap: spacing.sm, marginBottom: spacing.xs },
  headText: { fontSize: font.sm, color: colors.ink700, lineHeight: 20 },
  headActions: { flexDirection: 'row', gap: spacing.sm },

  row: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowBlocked: { borderColor: colors.danger700 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1, fontSize: font.base, fontWeight: '600', color: colors.ink900 },
  when: { fontSize: font.xs, color: colors.ink500 },

  waiting: { fontSize: font.xs, color: colors.ink500 },
  error: { fontSize: font.xs, color: colors.danger700, lineHeight: 17 },

  rowActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  action: { fontSize: font.sm, fontWeight: '600', color: colors.brand700 },
  danger: { color: colors.danger700 },
});
