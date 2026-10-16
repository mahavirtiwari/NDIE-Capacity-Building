import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Button } from '../../../src/components/ui';
import { clearSections, SECTIONS } from '../../../src/offline/programmeData';
import { colors, font, radius, spacing } from '../../../src/theme';

/**
 * Putting part of a programme back to nothing, on this phone.
 *
 * A coordinator who has photographed the wrong hall, or registered a
 * day of participants against yesterday's batch, had no way out of it
 * short of reinstalling the app. This is that way out, and it is
 * deliberately section by section: clearing the venue to retake two
 * photographs should not cost a morning's register.
 *
 * It only ever touches this handset. Anything already accepted by the
 * server stays there and will come back the next time the screen is
 * opened with a signal — which is the honest thing for a button called
 * "clear saved data" to do, and it is said on the screen rather than
 * left for somebody to discover.
 */
export default function ClearData() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const programmeId = Number(id);

  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const toggle = (key: string) =>
    setPicked((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  const confirm = () => {
    if (picked.length === 0) return;

    const names = SECTIONS.filter((s) => picked.includes(s.key))
      .map((s) => s.label.toLowerCase())
      .join(', ');

    Alert.alert(
      'Clear this from the phone?',
      `This removes ${names} for this program from this handset. Anything the server has `
        + 'already accepted is safe and will come back. Anything still waiting to be sent '
        + 'has not reached the office and will be lost.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => void run() },
      ],
    );
  };

  const run = async () => {
    setBusy(true);
    try {
      const { cached, queued } = await clearSections(programmeId, picked);
      setPicked([]);
      setDone(
        queued > 0
          ? `Cleared. ${queued} unsent ${queued === 1 ? 'entry was' : 'entries were'} discarded `
            + `along with ${cached} saved ${cached === 1 ? 'page' : 'pages'}.`
          : `Cleared ${cached} saved ${cached === 1 ? 'page' : 'pages'}. Nothing was waiting to be sent.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Clear saved data', headerShown: true }} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Banner tone="warning">
          This clears what is held on this phone. It does not undo anything the office has
          already received.
        </Banner>

        <Text style={styles.lead}>Choose what to clear</Text>

        <View style={styles.card}>
          {SECTIONS.map((section, index) => {
            const on = picked.includes(section.key);
            return (
              <Pressable
                key={section.key}
                onPress={() => toggle(section.key)}
                style={[styles.row, index > 0 && styles.rowRuled]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <View style={[styles.box, on && styles.boxOn]}>
                  {on ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{section.label}</Text>
                  <Text style={styles.rowBody}>{section.describes}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {done ? <Banner tone="success">{done}</Banner> : null}

        <Button
          label={picked.length === 0 ? 'Select something to clear' : `Clear ${picked.length} selected`}
          variant="danger"
          onPress={confirm}
          disabled={picked.length === 0}
          loading={busy}
        />

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Back to the program</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  lead: { fontSize: font.sm, fontWeight: '700', color: colors.ink700 },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink200,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, alignItems: 'flex-start' },
  rowRuled: { borderTopWidth: 1, borderTopColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: font.base, fontWeight: '600', color: colors.ink900 },
  rowBody: { fontSize: font.xs, color: colors.ink500, lineHeight: 16 },

  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.ink400,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: colors.brand600, borderColor: colors.brand600 },

  back: { alignSelf: 'center', paddingVertical: spacing.sm },
  backText: { fontSize: font.sm, color: colors.ink600, fontWeight: '600' },
});
