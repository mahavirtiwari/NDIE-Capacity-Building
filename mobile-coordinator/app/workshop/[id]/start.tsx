import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../../src/auth/AuthContext';
import { Banner } from '../../../src/components/ui';
import { useNetwork } from '../../../src/offline/NetworkContext';
import { counts, drain, subscribe } from '../../../src/offline/outbox';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';
import { colors, font, radius, spacing } from '../../../src/theme';

/**
 * Everything that can be done to one programme, on one screen.
 *
 * The four tabs along the bottom were the way in before, which meant a
 * coordinator standing in a hall had to know that "Registration" held
 * the venue and the trainers while "Program" held the sessions and the
 * register. Named jobs in the order they are done need no such
 * knowledge, and the tabs are still there underneath for anyone who
 * prefers them.
 */
/**
 * Where one job stands.
 *
 * Three states, as the office asked for them, and each derived from
 * what is actually recorded rather than from a flag somebody has to
 * remember to set. "In progress" means begun and not finished: a venue
 * with an address and no photographs, a register with names and no
 * attendance. Jobs that cannot be half done - a trainer is on the
 * record or is not - simply never show it.
 */
type Standing = 'todo' | 'doing' | 'done';

const WORDS: Record<Standing, string> = {
  todo: 'Yet to start',
  doing: 'In progress',
  done: 'Completed',
};

function standingOf(done: number, total: number): Standing {
  if (done <= 0) return 'todo';
  return done >= total ? 'done' : 'doing';
}

export default function Start() {
  const router = useRouter();
  const { detail, id, refresh } = useWorkshop();
  const { session } = useAuth();
  const { online } = useNetwork();

  const [syncing, setSyncing] = useState(false);
  const [unsent, setUnsent] = useState({ waiting: 0, blocked: 0 });
  const sealed = detail?.isSubmitted === true;

  /* The record changes while this screen is open - a venue registered
     on the screen behind it, a trainer added - so the standings are
     re-read on the way back rather than left as they were on the way
     out. */
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const owner = session?.userCode;

  const countUnsent = useCallback(async () => {
    if (!owner) return;
    setUnsent(await counts(owner));
  }, [owner]);

  useEffect(() => {
    void countUnsent();
    return subscribe(() => void countUnsent());
  }, [countUnsent]);

  const progress = detail?.progress;

  /* Venue: an address, a map pin and two photographs. */
  const venueDone =
    (progress?.venueRegistered ? 1 : 0)
    + (progress?.venueGeoTagged ? 1 : 0)
    + (progress?.venueExteriorPhoto ? 1 : 0)
    + (progress?.venueInteriorPhoto ? 1 : 0);

  /* The day itself: sessions taught, people registered, attendance
     marked against them, and the signed sheet photographed. */
  const runDone =
    ((progress?.sessionCount ?? 0) > 0 ? 1 : 0)
    + ((progress?.participantCount ?? 0) > 0 ? 1 : 0)
    + ((progress?.attendanceMarkedCount ?? 0) > 0 ? 1 : 0)
    + ((progress?.attendanceSheetCount ?? 0) > 0 ? 1 : 0);

  const venueStanding = standingOf(venueDone, 4);
  const trainerStanding: Standing = (progress?.trainerCount ?? 0) > 0 ? 'done' : 'todo';
  const runStanding = standingOf(runDone, 4);
  /* Nothing held is the finished state here: the phone is empty
     because the office has it all. */
  const syncStanding: Standing =
    unsent.waiting > 0 || unsent.blocked > 0 ? 'doing' : 'done';
  const submitStanding: Standing = sealed
    ? 'done'
    : (progress?.blockers?.length ?? 1) === 0
      ? 'doing'
      : 'todo';

  /**
   * Sends anything this handset is still holding.
   *
   * The queue drains on its own when the signal returns, but a
   * coordinator about to leave a venue wants to know it has gone
   * rather than trust that it will, and the answer has to be a number.
   */
  const sync = async () => {
    const owner = session?.userCode;
    if (!owner) return;

    if (!online) {
      Alert.alert('No signal', 'Nothing can be sent until this phone has a connection.');
      return;
    }

    setSyncing(true);
    try {
      const before = await counts(owner);
      if (before.waiting === 0 && before.blocked === 0) {
        Alert.alert('Nothing to send', 'Everything recorded on this phone has reached the office.');
        return;
      }

      const { sent, blocked } = await drain(owner);
      Alert.alert(
        'Sync',
        blocked > 0
          ? `${sent} sent. ${blocked} ${blocked === 1 ? 'item was' : 'items were'} refused — open Unsent work to see why.`
          : `${sent} ${sent === 1 ? 'entry' : 'entries'} sent. Nothing is waiting.`,
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      {detail ? (
        <View style={styles.head}>
          <Text style={styles.title}>{detail.programmeName}</Text>
          <Text style={styles.code}>{detail.programmeId}</Text>
        </View>
      ) : null}

      {sealed ? (
        <Banner tone="info">
          This program was finally submitted. Nothing on it can be changed.
        </Banner>
      ) : null}

      <Job
        icon="business-outline"
        label="Register Venue"
        hint={`${venueDone} of 4: address, map pin, outside and inside.`}
        standing={venueStanding}
        onPress={() => router.push(`/workshop/${id}/venue`)}
      />
      <Job
        icon="person-add-outline"
        label="Register Trainer"
        hint={
          (progress?.trainerCount ?? 0) > 0
            ? `${progress?.trainerCount} on the record.`
            : 'Who is teaching, and what they are qualified in.'
        }
        standing={trainerStanding}
        onPress={() => router.push(`/workshop/${id}/trainer`)}
      />
      <Job
        icon="clipboard-outline"
        label="Program Management"
        hint={`${runDone} of 4: sessions, register, attendance, signed sheet.`}
        standing={runStanding}
        onPress={() => router.push(`/workshop/${id}/programme`)}
      />
      <Job
        icon="cloud-upload-outline"
        label="Sync Data"
        hint={
          unsent.blocked > 0
            ? `${unsent.blocked} refused by the server.`
            : unsent.waiting > 0
              ? `${unsent.waiting} saved on this phone, not yet sent.`
              : 'Everything recorded here has reached the office.'
        }
        standing={syncStanding}
        busy={syncing}
        onPress={() => void sync()}
      />
      <Job
        icon="lock-closed-outline"
        label="Final Submit"
        hint={
          sealed
            ? 'Submitted. Nothing on it can be changed.'
            : submitStanding === 'doing'
              ? 'Everything required is recorded. Ready to seal.'
              : `${progress?.blockers?.length ?? 0} ${
                  (progress?.blockers?.length ?? 0) === 1 ? 'thing is' : 'things are'
                } still needed before this can be sealed.`
        }
        standing={submitStanding}
        onPress={() => router.push(`/workshop/${id}/submit`)}
      />
    </ScrollView>
  );
}

/** One job, what it covers, and where it stands. */
function Job({
  icon,
  label,
  hint,
  standing,
  busy,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  standing: Standing;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.job, pressed && styles.jobPressed]}
    >
      <View style={styles.jobIcon}>
        <Ionicons name={icon} size={20} color={colors.brand700} />
      </View>
      <View style={styles.jobText}>
        <Text style={styles.jobLabel}>{busy ? `${label}…` : label}</Text>
        <Text style={styles.jobHint}>{hint}</Text>
        <Text style={[styles.standing, STANDING_STYLE[standing]]}>{WORDS[standing]}</Text>
      </View>
      <Ionicons
        name={standing === 'done' ? 'checkmark-circle' : 'chevron-forward'}
        size={18}
        color={standing === 'done' ? colors.success700 : colors.ink400}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },

  head: { gap: 2, marginBottom: spacing.xs },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.ink900 },
  code: { fontSize: font.sm, color: colors.brand700, fontWeight: '600' },

  job: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink200,
    padding: spacing.lg,
  },
  jobPressed: { backgroundColor: colors.brand50 },
  jobIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobText: { flex: 1, gap: 2 },
  jobLabel: { fontSize: font.base, fontWeight: '600', color: colors.ink900 },
  jobHint: { fontSize: font.xs, color: colors.ink500, lineHeight: 16 },

  /* The word, not only a tick: a coordinator reporting to the office
     has to be able to say which of the five is unfinished. */
  standing: {
    alignSelf: 'flex-start',
    marginTop: 3,
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.2,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});

const STANDING_STYLE: Record<Standing, { color: string; backgroundColor: string }> = {
  todo: { color: colors.ink600, backgroundColor: colors.ink100 },
  doing: { color: colors.brand800, backgroundColor: colors.brand50 },
  done: { color: colors.success700, backgroundColor: colors.success50 },
};
