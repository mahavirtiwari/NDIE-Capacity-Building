import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../../src/auth/AuthContext';
import { Banner, Button, EmptyState, Loading } from '../../../src/components/ui';
import { useNetwork } from '../../../src/offline/NetworkContext';
import { drain, snapshot, subscribe, type OutboxEntry } from '../../../src/offline/outbox';
import { colors, font, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * What this phone recorded without a signal, and has not sent.
 *
 * Empty almost always, and that is the point: anything captured with a
 * connection went straight to the office and was never held here. What
 * is on this screen is only ever work done in a hall with no signal —
 * which is exactly the work a coordinator is anxious about, and the
 * only work worth a screen that says where it is.
 *
 * Grouped by the part of the day it came from, with a button each. A
 * coordinator on a thin signal at the end of an afternoon would rather
 * get the register away than watch one queue of everything stall on a
 * photograph. Order is still kept inside a section, and anything
 * pointing at something not yet created waits for it — so sending
 * Photos before Participants sends what it can and leaves the rest.
 */

/** The sections, in the order the day produces them. */
const SECTIONS: { label: string; icon: keyof typeof Ionicons.glyphMap; holds: string[] }[] = [
  { label: 'Venue', icon: 'business-outline', holds: ['Venue'] },
  { label: 'Trainers', icon: 'person-add-outline', holds: ['Trainer'] },
  { label: 'Sessions', icon: 'easel-outline', holds: ['Session'] },
  { label: 'Participants', icon: 'people-outline', holds: ['Participant', 'Feedback'] },
  { label: 'Attendance', icon: 'checkbox-outline', holds: ['Attendance'] },
  { label: 'Marks', icon: 'ribbon-outline', holds: ['Marks'] },
  { label: 'Photographs', icon: 'camera-outline', holds: ['Photo'] },
];

export default function Sync() {
  const { id } = useWorkshop();
  const { session } = useAuth();
  const { online } = useNetwork();
  const owner = session?.userCode ?? null;

  const [held, setHeld] = useState<OutboxEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const read = useCallback(async () => {
    const all = await snapshot();
    setHeld(owner ? all.filter((e) => e.owner === owner) : all);
  }, [owner]);

  useEffect(() => {
    void read();
    return subscribe(() => void read());
  }, [read]);

  if (held === null) return <Loading label="Reading what is saved…" />;

  const send = async (label: string, holds: string[]) => {
    if (!owner || !online) return;
    setBusy(label);
    setNote(null);
    try {
      const { sent, blocked } = await drain(owner, (entry) => holds.includes(entry.label));
      setNote(
        blocked > 0
          ? `${label}: ${sent} sent, ${blocked} refused. Open Unsent work to see why.`
          : sent > 0
            ? `${label}: ${sent} ${sent === 1 ? 'entry' : 'entries'} sent.`
            : `${label}: nothing could be sent yet.`,
      );
    } finally {
      setBusy(null);
      await read();
    }
  };

  const sendEverything = async () => {
    if (!owner || !online) return;
    setBusy('all');
    setNote(null);
    try {
      const { sent, blocked } = await drain(owner);
      setNote(
        blocked > 0
          ? `${sent} sent, ${blocked} refused. Open Unsent work to see why.`
          : `${sent} ${sent === 1 ? 'entry' : 'entries'} sent. Nothing is waiting.`,
      );
    } finally {
      setBusy(null);
      await read();
    }
  };

  const groups = SECTIONS.map((section) => ({
    ...section,
    entries: held.filter((e) => section.holds.includes(e.label)),
  })).filter((group) => group.entries.length > 0);

  /* Anything the labels do not account for: a kind of entry added later
     should still be visible and sendable rather than silently absent. */
  const accounted = new Set(SECTIONS.flatMap((s) => s.holds));
  const other = held.filter((e) => !accounted.has(e.label));

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      {held.length === 0 ? (
        <EmptyState
          icon="cloud-done-outline"
          title="Nothing is waiting"
          message={
            'Everything you have recorded reached the office as you recorded it. Work only '
            + 'appears here when it was captured with no signal.'
          }
        />
      ) : (
        <>
          <Banner tone={online ? 'info' : 'warning'}>
            {online
              ? `${held.length} ${held.length === 1 ? 'entry was' : 'entries were'} recorded `
                + 'without a signal and is still on this phone. Send a section, or all of it.'
              : `${held.length} ${held.length === 1 ? 'entry is' : 'entries are'} saved on this `
                + 'phone. Nothing can be sent until you have a connection.'}
          </Banner>

          {groups.map((group) => {
            const blocked = group.entries.filter((e) => e.status === 'blocked').length;
            return (
              <View key={group.label} style={styles.section}>
                <View style={styles.head}>
                  <View style={styles.icon}>
                    <Ionicons name={group.icon} size={18} color={colors.brand700} />
                  </View>
                  <View style={styles.headText}>
                    <Text style={styles.title}>{group.label}</Text>
                    <Text style={styles.count}>
                      {group.entries.length}{' '}
                      {group.entries.length === 1 ? 'entry' : 'entries'} held
                      {blocked > 0 ? ` · ${blocked} refused` : ''}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.send, (!online || busy !== null) && styles.sendOff]}
                    disabled={!online || busy !== null}
                    onPress={() => void send(group.label, group.holds)}
                  >
                    <Text style={styles.sendText}>
                      {busy === group.label ? 'Sending…' : 'Sync'}
                    </Text>
                  </Pressable>
                </View>

                {group.entries.slice(0, 4).map((entry) => (
                  <Text key={entry.id} style={styles.line} numberOfLines={1}>
                    {entry.status === 'blocked' ? '⚠ ' : '• '}
                    {entry.label} · {recorded(entry.createdAt)}
                  </Text>
                ))}
                {group.entries.length > 4 ? (
                  <Text style={styles.line}>…and {group.entries.length - 4} more</Text>
                ) : null}
              </View>
            );
          })}

          {other.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.head}>
                <View style={styles.icon}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.brand700} />
                </View>
                <View style={styles.headText}>
                  <Text style={styles.title}>Other</Text>
                  <Text style={styles.count}>
                    {other.length} {other.length === 1 ? 'entry' : 'entries'} held
                  </Text>
                </View>
              </View>
              {other.slice(0, 4).map((entry) => (
                <Text key={entry.id} style={styles.line} numberOfLines={1}>
                  • {entry.label} · {recorded(entry.createdAt)}
                </Text>
              ))}
            </View>
          ) : null}

          {note ? <Banner tone="success">{note}</Banner> : null}

          <Button
            label={busy === 'all' ? 'Sending everything…' : 'Sync everything'}
            onPress={() => void sendEverything()}
            disabled={!online || busy !== null}
          />
        </>
      )}

      <Text style={styles.footnote}>
        This phone is holding work for program {id}. Sending it does not change anything the
        office already has.
      </Text>
    </ScrollView>
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
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  section: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink200,
    padding: spacing.lg,
    gap: 4,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, gap: 1 },
  title: { fontSize: font.base, fontWeight: '600', color: colors.ink900 },
  count: { fontSize: font.xs, color: colors.ink500 },

  send: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.brand600,
  },
  sendOff: { opacity: 0.45 },
  sendText: { fontSize: font.sm, fontWeight: '700', color: colors.white },

  line: { fontSize: font.xs, color: colors.ink600, marginLeft: 48 },

  footnote: {
    fontSize: font.xs,
    color: colors.ink500,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
