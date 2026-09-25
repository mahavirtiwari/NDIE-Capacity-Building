import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { colors, font, spacing } from '../theme';
import { useNetwork } from './NetworkContext';
import { counts, drain, subscribe } from './outbox';

/**
 * The one line that tells a coordinator whether the afternoon's work has
 * actually left the phone.
 *
 * Silence would be the wrong default here. Somebody who registers twenty
 * participants in a hall with no signal needs to know that nothing has gone
 * yet, and needs to see it go when they get back to a road — otherwise the
 * only way to find out is to ask the office, days later.
 */
export function OutboxNotice() {
  const { online, reconnectedAt } = useNetwork();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const owner = session?.userCode ?? null;
  const [waiting, setWaiting] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    const next = await counts(owner ?? undefined);
    setWaiting(next.waiting);
    setBlocked(next.blocked);
  }, [owner]);

  useEffect(() => {
    void refresh();
    return subscribe(() => void refresh());
  }, [refresh]);

  /* Sent when the connection returns, and once on mount for anything left over
     from a previous run of the app. */
  useEffect(() => {
    if (!online || !owner) return;

    let cancelled = false;
    (async () => {
      const { waiting: pending } = await counts(owner);
      if (cancelled || pending === 0) return;

      setSending(true);
      try {
        await drain(owner);
      } finally {
        if (!cancelled) setSending(false);
        await refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [online, owner, reconnectedAt, refresh]);

  if (online && waiting === 0 && blocked === 0) return null;

  let tone: ViewStyle = styles.offline;
  let icon: keyof typeof Ionicons.glyphMap = 'cloud-offline-outline';
  let message: string;

  if (blocked > 0) {
    tone = styles.blocked;
    icon = 'alert-circle-outline';
    message = `${blocked} ${blocked === 1 ? 'item was' : 'items were'} refused by the server. Nothing after them will send.`;
  } else if (!online) {
    message =
      waiting > 0
        ? `Offline. ${waiting} ${waiting === 1 ? 'entry is' : 'entries are'} saved on this phone and will be sent when you have a signal.`
        : 'Offline. You can carry on — everything you record is saved on this phone.';
  } else {
    tone = styles.sending;
    icon = 'cloud-upload-outline';
    message = sending
      ? `Sending ${waiting} saved ${waiting === 1 ? 'entry' : 'entries'}...`
      : `${waiting} saved ${waiting === 1 ? 'entry' : 'entries'} still to send.`;
  }

  return (
    <View style={[styles.bar, tone, { paddingTop: insets.top + spacing.sm }]}>
      <Ionicons name={icon} size={15} color={colors.white} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  offline: { backgroundColor: colors.ink700 },
  sending: { backgroundColor: colors.success700 },
  blocked: { backgroundColor: colors.danger700 },
  text: { flex: 1, color: colors.white, fontSize: font.xs, lineHeight: 16 },
});
