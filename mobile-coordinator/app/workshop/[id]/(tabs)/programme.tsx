import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { Banner, Loading } from '../../../../src/components/ui';
import { MenuRow } from '../../../../src/components/MenuRow';
import { colors, spacing } from '../../../../src/theme';
import { useWorkshop } from '../../../../src/workshop/WorkshopContext';

/**
 * The capture screens, in the order the day runs.
 *
 * Session management and on-spot registration need a trainer and the venue
 * respectively, so those rows stay disabled until their prerequisite exists —
 * a coordinator should meet the requirement here, not in an error message on
 * the screen after.
 *
 * Two of the steps appear only where the programme type asks for them.
 * Participants' photographs: some of these programmes certify an individual
 * and their photograph goes on the certificate, and some train a room and
 * nobody needs a face. On-spot registration: some are open to whoever turns
 * up and some run only for the candidates who applied. The Super Admin says
 * which on the type, so a coordinator is never shown a step the scheme has
 * no use for and never has to be told by telephone that this one needs it.
 *
 * Nothing is greyed out. A row that cannot be used yet used to be dimmed and
 * unpressable, which answers "why can I not tap this?" with silence; the row
 * says what it is waiting for instead, and the screen behind it says the same
 * thing in full.
 */
export default function ProgrammeManagement() {
  const router = useRouter();
  const { id, detail, loading, failure, refresh, locked } = useWorkshop();
  const [refreshing, setRefreshing] = useState(false);

  if (loading && !detail) return <Loading label="Loading program…" />;

  const p = detail?.progress;
  const go = (path: string) => router.push(`/workshop/${id}/${path}`);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
        />
      }
    >
      <Text style={styles.lead}>Record the program as it happens.</Text>

      {failure ? <Banner tone="danger">{failure}</Banner> : null}

      {locked ? (
        <Banner tone="info">Finally submitted — these screens are read only.</Banner>
      ) : null}

      {!locked && (p?.trainerCount ?? 0) === 0 ? (
        <Banner tone="warning">
          Register a trainer on the Registration tab before recording a session.
        </Banner>
      ) : null}

      <MenuRow
        icon="easel-outline"
        title="Session capture"
        status={p?.sessionCount ? `${p.sessionCount} recorded` : 'No session recorded yet'}
        done={(p?.sessionCount ?? 0) > 0}
        onPress={() => go('session')}
      />

      {/* Only where the type allows people in at the door, and
          optional even then: a batch nobody walked into is not an
          incomplete batch. */}
      {detail?.onSpotRegistrationAllowed !== false ? (
        <MenuRow
          icon="person-add-outline"
          title="On-spot registration"
          status={
            p?.participantCount
              ? `${p.participantCount} registered`
              : 'Optional — nobody registered yet'
          }
          done={(p?.participantCount ?? 0) > 0}
          onPress={() => go('participant')}
        />
      ) : null}

      {detail?.participantPhotoRequired ? (
        <MenuRow
          icon="camera-outline"
          title="Participants photo"
          status={
            p?.participantCount
              ? `One photo per participant · ${p.participantCount} registered`
              : 'Register participants first'
          }
          onPress={() => go('participant-photo')}
        />
      ) : null}

      <MenuRow
        icon="checkbox-outline"
        title="Program attendance"
        status={
          p?.participantCount
            ? `${p.attendanceMarkedCount}/${p.participantCount} marked · ${p.presentCount} present`
            : 'Register participants first'
        }
        done={!!p?.participantCount && p.attendanceMarkedCount === p.participantCount}
        onPress={() => go('attendance')}
      />

      <MenuRow
        icon="document-attach-outline"
        title="Attendance photo (hard copy)"
        status={
          p?.attendanceSheetCount
            ? `${p.attendanceSheetCount} sheet${p.attendanceSheetCount === 1 ? '' : 's'} uploaded`
            : 'Signed sheets not uploaded yet'
        }
        done={(p?.attendanceSheetCount ?? 0) > 0}
        onPress={() => go('attendance-photo')}
      />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  lead: { color: colors.ink600, fontSize: 13 },
});
