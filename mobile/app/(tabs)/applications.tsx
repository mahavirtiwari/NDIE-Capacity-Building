import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { me } from '../../src/api/endpoints';
import type { Application, Enrolment } from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import {
  Banner,
  Card,
  Chip,
  EmptyState,
  Loading,
  StatusPill,
  inr,
  shortDate,
} from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

type Tab = 'applications' | 'enrolments';

/** Where an applicant tracks what they submitted and where they were enrolled. */
export default function Applications() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('applications');

  const applications = useResource<Application[]>(() => me.applications(), []);
  const enrolments = useResource<Enrolment[]>(() => me.enrolments(), []);

  /* Coming back from a submission should show the new row straight away. The
     first focus is skipped because the resources already load on mount. */
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      applications.refresh();
      enrolments.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const active = tab === 'applications' ? applications : enrolments;
  /* One list renders both shapes, so the union is stated once here. */
  const rows: (Application | Enrolment)[] =
    tab === 'applications' ? (applications.data ?? []) : (enrolments.data ?? []);

  if (applications.loading && enrolments.loading) return <Loading />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(item, index) =>
        'applicationNo' in item ? item.applicationNo : `${item.programmeId}-${index}`
      }
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={active.refreshing} onRefresh={active.refresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.tabs}>
            <TabButton
              label={`Applications${applications.data ? ` (${applications.data.length})` : ''}`}
              active={tab === 'applications'}
              onPress={() => setTab('applications')}
            />
            <TabButton
              label={`Enrolments${enrolments.data ? ` (${enrolments.data.length})` : ''}`}
              active={tab === 'enrolments'}
              onPress={() => setTab('enrolments')}
            />
          </View>
          {active.error ? <Banner tone="danger">{active.error}</Banner> : null}
        </View>
      }
      ListEmptyComponent={
        tab === 'applications' ? (
          <EmptyState
            icon="document-text-outline"
            title="No applications yet"
            message="Apply from the Programmes tab and your application will appear here."
          />
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="No enrolments yet"
            message="Once an application is approved you will be enrolled into a batch."
          />
        )
      }
      renderItem={({ item }) =>
        'applicationNo' in item ? (
          <ApplicationCard
            application={item}
            onOpen={() => router.push(`/application/${item.id}`)}
          />
        ) : (
          <EnrolmentCard enrolment={item} />
        )
      }
    />
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function ApplicationCard({
  application,
  onOpen,
}: {
  application: Application;
  onOpen: () => void;
}) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button">
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{application.programTypeName ?? 'Programme'}</Text>
            <Text style={styles.cardCode}>{application.applicationNo}</Text>
          </View>
          <StatusPill value={application.status} />
        </View>

        <View style={styles.metaRow}>
          <Meta label="Submitted" value={shortDate(application.submittedOn)} />
          <Meta label="Fee" value={application.feeAmount > 0 ? inr(application.feeAmount) : 'Free'} />
          <Meta label="Payment" value={application.paymentStatus} />
        </View>

        <View style={styles.cardFoot}>
          <View style={styles.chips}>
            {application.documents.length > 0 ? (
              <Chip>{`${application.documents.length} documents`}</Chip>
            ) : null}
            {application.score !== null && application.score !== undefined ? (
              <Chip>{`Score ${application.score}`}</Chip>
            ) : null}
          </View>
          <View style={styles.openRow}>
            <Text style={styles.openLabel}>View</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brand700} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function EnrolmentCard({ enrolment }: { enrolment: Enrolment }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{enrolment.programmeName}</Text>
          <Text style={styles.cardCode}>{enrolment.programmeId}</Text>
        </View>
        <StatusPill value={enrolment.status} />
      </View>

      <View style={styles.metaRow}>
        <Meta label="Mode" value={enrolment.mode} />
        <Meta label="Starts" value={shortDate(enrolment.startDate)} />
        <Meta label="Ends" value={shortDate(enrolment.endDate)} />
      </View>

      <View style={styles.metaRow}>
        <Meta label="Attendance" value={`${enrolment.attendancePercent}%`} />
        <Meta
          label="Exam"
          value={enrolment.examDateTime ? shortDate(enrolment.examDateTime) : '—'}
        />
        <Meta label="Result" value={enrolment.result} />
      </View>

      <Text style={styles.venue}>
        <Ionicons name="location-outline" size={13} color={colors.ink500} />{' '}
        {enrolment.venue}
        {enrolment.state ? `, ${enrolment.state}` : ''}
      </Text>

      {enrolment.certificateNo ? (
        <Banner tone="success">{`Certificate ${enrolment.certificateNo} issued.`}</Banner>
      ) : null}
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.sm },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.ink100,
    borderRadius: radius.md,
    padding: 3,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabLabel: { fontSize: font.sm, fontWeight: '600', color: colors.ink500 },
  tabLabelActive: { color: colors.brand700 },

  card: { gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitleWrap: { flex: 1, gap: 2 },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900, lineHeight: 21 },
  cardCode: { fontSize: font.xs, color: colors.ink500, letterSpacing: 0.4 },

  metaRow: { flexDirection: 'row', gap: spacing.md },
  meta: { flex: 1, gap: 1 },
  metaLabel: { fontSize: font.xs, color: colors.ink500 },
  metaValue: { fontSize: font.sm, fontWeight: '600', color: colors.ink900 },

  venue: { fontSize: font.xs, color: colors.ink600 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openLabel: { fontSize: font.sm, fontWeight: '600', color: colors.brand700 },
});
