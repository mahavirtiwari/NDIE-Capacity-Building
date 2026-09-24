import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { Banner, Loading } from '../../../../src/components/ui';
import { MenuRow } from '../../../../src/components/MenuRow';
import { colors, spacing } from '../../../../src/theme';
import { useWorkshop } from '../../../../src/workshop/WorkshopContext';

/**
 * Tab 2 of the manual: the six capture screens, in the order the day runs.
 *
 * Session management and on-spot registration need a trainer and the venue
 * respectively, so those rows stay disabled until their prerequisite exists —
 * a coordinator should meet the requirement here, not in an error message on
 * the screen after.
 */
export default function ProgrammeManagement() {
  const router = useRouter();
  const { id, detail, loading, failure, refresh, locked } = useWorkshop();
  const [refreshing, setRefreshing] = useState(false);

  if (loading && !detail) return <Loading label="Loading workshop…" />;

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
      <Text style={styles.lead}>Record the workshop as it happens.</Text>

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
        title="Session management"
        status={p?.sessionCount ? `${p.sessionCount} recorded` : 'No session recorded yet'}
        done={(p?.sessionCount ?? 0) > 0}
        disabled={!locked && (p?.trainerCount ?? 0) === 0}
        onPress={() => go('session')}
      />

      <MenuRow
        icon="person-add-outline"
        title="On-spot registration"
        status={p?.participantCount ? `${p.participantCount} registered` : 'Nobody registered yet'}
        done={(p?.participantCount ?? 0) > 0}
        onPress={() => go('participant')}
      />

      <MenuRow
        icon="camera-outline"
        title="Participant photo"
        status="Optional — one photo per participant"
        disabled={(p?.participantCount ?? 0) === 0}
        onPress={() => go('participant-photo')}
      />

      <MenuRow
        icon="checkbox-outline"
        title="Programme attendance"
        status={
          p?.participantCount
            ? `${p.attendanceMarkedCount}/${p.participantCount} marked · ${p.presentCount} present`
            : 'Register participants first'
        }
        done={!!p?.participantCount && p.attendanceMarkedCount === p.participantCount}
        disabled={(p?.participantCount ?? 0) === 0}
        onPress={() => go('attendance')}
      />

      <MenuRow
        icon="document-attach-outline"
        title="Add attendance photo"
        status={
          p?.attendanceSheetCount
            ? `${p.attendanceSheetCount} sheet${p.attendanceSheetCount === 1 ? '' : 's'} uploaded`
            : 'Signed sheets not uploaded yet'
        }
        done={(p?.attendanceSheetCount ?? 0) > 0}
        onPress={() => go('attendance-photo')}
      />

      <MenuRow
        icon="star-outline"
        title="Participant feedback"
        status={
          p?.participantCount
            ? `Optional — ${p.feedbackCount}/${p.participantCount} given`
            : 'Register participants first'
        }
        disabled={(p?.participantCount ?? 0) === 0}
        onPress={() => go('feedback')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  lead: { color: colors.ink600, fontSize: 13 },
});
