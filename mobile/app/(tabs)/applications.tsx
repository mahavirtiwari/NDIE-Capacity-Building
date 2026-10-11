import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { me } from '../../src/api/endpoints';
import type { Application, Enrolment, ProfileStanding } from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import {
  Banner,
  Button,
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

/**
 * Everything this applicant has sent in, and where they were enrolled.
 *
 * Two kinds of thing are sent in and both belong here: the profile
 * scrutiny form, which is filled once per sub-category and is what opens
 * the programs, and the application to a program itself. They used to be
 * in different places, so somebody who had just sent a profile found this
 * screen empty and had no way to read back what they had written.
 */
type Submission =
  | { kind: 'profile'; key: string; sentOn?: string | null; profile: ProfileStanding }
  | { kind: 'application'; key: string; sentOn?: string | null; application: Application };

const FILTERS = ['All', 'Profile forms', 'Programs'] as const;
type Filter = (typeof FILTERS)[number];

export default function Applications() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('applications');
  const [filter, setFilter] = useState<Filter>('All');

  const applications = useResource<Application[]>(() => me.applications(), []);
  const enrolments = useResource<Enrolment[]>(() => me.enrolments(), []);
  const profiles = useResource<ProfileStanding[]>(() => me.myProfiles(), []);

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
      profiles.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  /* A profile that has only been drafted has not been sent to anybody, so
     it is not a submission and does not belong on this list. The screen it
     was started on is still where it is finished. */
  const sent = useMemo<Submission[]>(() => {
    const rows: Submission[] = [];

    for (const profile of profiles.data ?? []) {
      if (!profile.submittedOn && (profile.status ?? 'Draft') === 'Draft') continue;
      rows.push({
        kind: 'profile',
        key: `profile-${profile.subCategoryId}`,
        sentOn: profile.submittedOn,
        profile,
      });
    }

    for (const application of applications.data ?? []) {
      rows.push({
        kind: 'application',
        key: `application-${application.id}`,
        sentOn: application.submittedOn,
        application,
      });
    }

    /* Newest first, and anything with no date on it last rather than
       first: an undated row is older history, not today's news. */
    return rows.sort((a, b) => (b.sentOn ?? '').localeCompare(a.sentOn ?? ''));
  }, [profiles.data, applications.data]);

  const visible = useMemo(() => {
    if (filter === 'Profile forms') return sent.filter((row) => row.kind === 'profile');
    if (filter === 'Programs') return sent.filter((row) => row.kind === 'application');
    return sent;
  }, [sent, filter]);

  /* Only worth offering where there is something to narrow. One kind of
     submission on its own needs no filter above it. */
  const mixed =
    sent.some((row) => row.kind === 'profile') && sent.some((row) => row.kind === 'application');

  const active = tab === 'applications' ? applications : enrolments;
  const rows: (Submission | Enrolment)[] = tab === 'applications' ? visible : (enrolments.data ?? []);

  if (applications.loading && enrolments.loading && profiles.loading) return <Loading />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(item, index) =>
        'kind' in item ? item.key : `${item.programmeId}-${index}`
      }
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={active.refreshing} onRefresh={active.refresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.tabs}>
            <TabButton
              label={`Submissions${sent.length ? ` (${sent.length})` : ''}`}
              active={tab === 'applications'}
              onPress={() => setTab('applications')}
            />
            <TabButton
              label={`Enrolments${enrolments.data ? ` (${enrolments.data.length})` : ''}`}
              active={tab === 'enrolments'}
              onPress={() => setTab('enrolments')}
            />
          </View>

          {/* The way to start a new one, and the only place it is offered.
              A new application means choosing the discipline and filling
              the profile for it, which is the screen behind this; the
              dashboard lists what is already open to you and the Batches
              tab takes seats on dates, so neither of them is where
              somebody goes to begin. */}
          {tab === 'applications' ? (
            <Button
              label="Apply for a new program"
              icon="add-circle-outline"
              onPress={() => router.push('/profile-form')}
            />
          ) : null}

          {active.error ? <Banner tone="danger">{active.error}</Banner> : null}
          {tab === 'applications' && profiles.error ? (
            <Banner tone="danger">{profiles.error}</Banner>
          ) : null}

          {tab === 'applications' && mixed ? (
            <View style={styles.filters}>
              {FILTERS.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => setFilter(name)}
                  style={[styles.filter, filter === name && styles.filterActive]}
                >
                  <Text style={[styles.filterLabel, filter === name && styles.filterLabelActive]}>
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        tab === 'applications' ? (
          <EmptyState
            icon="document-text-outline"
            title="Nothing sent yet"
            message={
              'Fill in the profile for a sub-category from the Home tab. It appears here as '
              + 'soon as it is sent, and so does every program you apply to.'
            }
          />
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="No programs registered yet"
            message={
              'Every batch you register for appears here, from the moment you register — '
              + 'including one still waiting on its fee. Register from the Batches tab.'
            }
          />
        )
      }
      renderItem={({ item }) =>
        !('kind' in item) ? (
          <EnrolmentCard enrolment={item} />
        ) : item.kind === 'profile' ? (
          <ProfileRow
            profile={item.profile}
            onOpen={() => router.push(`/profile-submission/${item.profile.subCategoryId}`)}
          />
        ) : (
          <ApplicationRow
            application={item.application}
            onOpen={() => router.push(`/application/${item.application.id}`)}
          />
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

/**
 * One submitted row, shaped like the training material list: an icon for
 * what kind of thing it is, what it is called, the few facts worth reading
 * without opening it, and a chevron saying there is more behind it.
 */
function SubmissionRow({
  icon,
  title,
  subtitle,
  chips,
  foot,
  onOpen,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string | null;
  chips: ReactNode;
  foot: string;
  onOpen: () => void;
}) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button">
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name={icon} size={20} color={colors.brand700} />
          </View>

          <View style={styles.body}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}

            <View style={styles.chips}>{chips}</View>
            <Text style={styles.foot}>{foot}</Text>
          </View>

          <Ionicons name="chevron-forward" size={17} color={colors.ink500} />
        </View>
      </Card>
    </Pressable>
  );
}

function ProfileRow({ profile, onOpen }: { profile: ProfileStanding; onOpen: () => void }) {
  const attempts =
    profile.attemptsAllowed > 1 ? `Attempt ${profile.attemptNo} of ${profile.attemptsAllowed}` : null;

  return (
    <SubmissionRow
      icon="id-card"
      title={profile.subCategoryName ?? 'Profile'}
      subtitle={profile.categoryName}
      chips={
        <>
          <StatusPill value={profile.status ?? 'Submitted'} />
          {attempts ? <Chip>{attempts}</Chip> : null}
          {profile.cleared ? <Chip>Programs open</Chip> : null}
        </>
      }
      foot={`Profile scrutiny form · sent ${shortDate(profile.submittedOn)}`}
      onOpen={onOpen}
    />
  );
}

function ApplicationRow({
  application,
  onOpen,
}: {
  application: Application;
  onOpen: () => void;
}) {
  const where = [application.categoryName, application.subCategoryName]
    .filter(Boolean)
    .join(' · ');

  return (
    <SubmissionRow
      icon="document-text"
      title={application.programTypeName ?? 'Program'}
      subtitle={where || null}
      chips={
        <>
          <StatusPill value={application.status} />
          <Chip>
            {application.feeAmount > 0
              ? `${inr(application.feeAmount)} · ${application.paymentStatus}`
              : 'Free'}
          </Chip>
          {application.documents.length > 0 ? (
            <Chip>{`${application.documents.length} documents`}</Chip>
          ) : null}
          {application.score !== null && application.score !== undefined ? (
            <Chip>{`Score ${application.score}`}</Chip>
          ) : null}
        </>
      }
      foot={`${application.applicationNo} · sent ${shortDate(application.submittedOn)}`}
      onOpen={onOpen}
    />
  );
}

function EnrolmentCard({ enrolment }: { enrolment: Enrolment }) {
  const router = useRouter();

  return (
    <Card style={styles.enrolment}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{enrolment.programmeName}</Text>
          <Text style={styles.cardCode}>{enrolment.programmeId}</Text>
        </View>
        <StatusPill value={enrolment.seatTaken ? enrolment.status : 'Pending'} />
      </View>

      <View style={styles.metaRow}>
        <Meta label="Mode" value={enrolment.mode} />
        <Meta label="Starts" value={shortDate(enrolment.startDate)} />
        <Meta label="Ends" value={shortDate(enrolment.endDate)} />
      </View>

      {/* Attendance, the paper and a result belong to a seat that has been
          taken. A registration still waiting on its fee has none of them,
          and three dashes would say less than the line below does. */}
      {enrolment.seatTaken ? (
        <View style={styles.metaRow}>
          <Meta label="Attendance" value={`${enrolment.attendancePercent}%`} />
          <Meta
            label="Exam"
            value={enrolment.examDateTime ? shortDate(enrolment.examDateTime) : '—'}
          />
          <Meta label="Result" value={enrolment.result} />
        </View>
      ) : null}

      <Text style={styles.venue}>
        <Ionicons name="location-outline" size={13} color={colors.ink500} />{' '}
        {enrolment.venue}
        {enrolment.state ? `, ${enrolment.state}` : ''}
      </Text>

      {enrolment.certificateNo ? (
        <Banner tone="success">{`Certificate ${enrolment.certificateNo} issued.`}</Banner>
      ) : null}

      {/* Registered, and the seat is held only once the fee arrives. Said
          here rather than left to a missing attendance figure, with the way
          to settle it on the card: somebody who stopped halfway through
          paying has no other route back to this batch. */}
      {!enrolment.seatTaken ? (
        <>
          <Banner tone="warning">
            {enrolment.amountDue > 0
              ? `Your seat is held once the fee of ${inr(enrolment.amountDue)} is paid.`
              : 'Your seat is held once the fee is paid.'}
          </Banner>
          <Button
            label={enrolment.paymentStatus === 'Failed' ? 'Try the payment again' : 'Pay the fee'}
            icon="card-outline"
            onPress={() => router.push(`/payment/${enrolment.applicationId}`)}
          />
        </>
      ) : null}

      {/* Offered once an examination has been scheduled. Whether it can
          actually be sat — the window, the attempts left, whether the paper is
          online at all — is the server's answer, given on the screen behind
          this, rather than guessed at from the little this card knows. */}
      {enrolment.seatTaken && enrolment.examDateTime ? (
        <Button
          label="Written examination"
          variant="secondary"
          icon="document-text-outline"
          onPress={() => router.push(`/exam/${enrolment.participantId}`)}
        />
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

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  filterLabel: { fontSize: font.xs, fontWeight: '600', color: colors.ink600 },
  filterLabelActive: { color: colors.white },

  card: { paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  title: { fontSize: font.base, fontWeight: '700', color: colors.ink900, lineHeight: 20 },
  subtitle: { fontSize: font.xs, color: colors.ink600, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 2 },
  foot: { fontSize: font.xs, color: colors.ink500, marginTop: 2 },

  enrolment: { gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitleWrap: { flex: 1, gap: 2 },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900, lineHeight: 21 },
  cardCode: { fontSize: font.xs, color: colors.ink500, letterSpacing: 0.4 },

  metaRow: { flexDirection: 'row', gap: spacing.md },
  meta: { flex: 1, gap: 1 },
  metaLabel: { fontSize: font.xs, color: colors.ink500 },
  metaValue: { fontSize: font.sm, fontWeight: '600', color: colors.ink900 },

  venue: { fontSize: font.xs, color: colors.ink600 },
});
