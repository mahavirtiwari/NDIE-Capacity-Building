import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { me } from '../../src/api/endpoints';
import type { ProfileForm, ProfileStanding } from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import {
  Banner,
  Button,
  Card,
  DetailRow,
  EmptyState,
  Loading,
  StatusPill,
  shortDate,
} from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * One submitted profile scrutiny form, read back in full.
 *
 * The form itself is a long screen meant for filling in. This is the other
 * half of it: what was sent, where it stands, and what scrutiny has done
 * with it — the same shape as a program application, because from where
 * the applicant sits they are the same kind of thing.
 */
export default function ProfileSubmissionDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subCategoryId: string }>();
  const subCategoryId = Number(params.subCategoryId);

  const standing = useResource<ProfileStanding>(
    () => me.profileStanding(subCategoryId),
    [subCategoryId],
  );

  /* The published form supplies the section headings and the labels for
     the stored answer keys. A profile can outlive the form it was filled
     on, so a missing one is a readable answer list and not an error. */
  const form = useResource<ProfileForm | null>(
    () => me.profileForm(subCategoryId),
    [subCategoryId],
  );

  const profile = standing.data;

  /* Grouped the way the form asked them, so the answers read back in the
     order they were given. Anything the form no longer knows about is
     kept under its own heading rather than dropped: it was still sent. */
  const groups = useMemo(() => {
    const responses = profile?.responses ?? {};
    const given = new Set(
      Object.keys(responses).filter((key) => {
        const value = responses[key];
        return value !== null && value !== undefined && value !== '';
      }),
    );

    const sections = (form.data?.sections ?? [])
      .filter((section) => section.isEnabled)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((section) => ({
        title: section.title,
        answers: section.fields
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .filter((field) => given.has(field.key))
          .map((field) => {
            given.delete(field.key);
            return { key: field.key, label: field.label, value: display(responses[field.key]) };
          }),
      }))
      .filter((section) => section.answers.length > 0);

    if (given.size > 0) {
      sections.push({
        title: 'Also sent',
        answers: [...given].map((key) => ({
          key,
          label: humanise(key),
          value: display(responses[key]),
        })),
      });
    }

    return sections;
  }, [profile?.responses, form.data]);

  if (standing.loading) return <Loading />;

  if (!profile) {
    return (
      <EmptyState
        icon="id-card-outline"
        title="Profile not found"
        message={standing.error ?? 'Nothing has been sent for this sub-category.'}
      />
    );
  }

  const waiting = profile.status === 'Submitted' || profile.status === 'UnderScrutiny';

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={standing.refreshing} onRefresh={standing.refresh} />
      }
    >
      <Stack.Screen options={{ title: profile.subCategoryName ?? 'Profile' }} />

      <Card style={styles.card}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={styles.title}>{profile.subCategoryName ?? 'Profile'}</Text>
            <Text style={styles.code}>Profile scrutiny form</Text>
          </View>
          <StatusPill value={profile.status ?? 'Submitted'} />
        </View>

        <View style={styles.details}>
          <DetailRow label="Category" value={profile.categoryName ?? '—'} />
          <DetailRow label="Sub-category" value={profile.subCategoryName ?? '—'} />
          <DetailRow label="Submitted" value={shortDate(profile.submittedOn)} />
          {profile.decidedOn ? (
            <DetailRow label="Decided" value={shortDate(profile.decidedOn)} />
          ) : null}
          {profile.attemptsAllowed > 1 ? (
            <DetailRow
              label="Attempt"
              value={`${profile.attemptNo} of ${profile.attemptsAllowed}`}
            />
          ) : null}
          <DetailRow
            label="Programs"
            value={profile.cleared ? 'Open to you' : 'Shut until this is accepted'}
          />
        </View>

        {profile.rejectionReasonLabel ? (
          <Banner tone="warning">{profile.rejectionReasonLabel}</Banner>
        ) : null}
        {profile.remarks ? <Text style={styles.remarks}>{profile.remarks}</Text> : null}

        {profile.blockedUntil ? (
          <Banner tone="danger">
            {`This sub-category is shut to you until ${shortDate(profile.blockedUntil)}.`}
          </Banner>
        ) : waiting ? (
          <Banner tone="info">
            It is with scrutiny. You will be emailed as soon as there is a decision.
          </Banner>
        ) : null}

        {/* The way back into the form, where there is one. Correcting a
            refused profile is the one thing somebody reads this screen to
            do, so it is offered here rather than hunted for. */}
        {profile.canSubmit ? (
          <Button
            label={profile.status === 'Rejected' ? 'Correct and send again' : 'Open the form'}
            icon="create-outline"
            onPress={() =>
              router.push({
                pathname: '/profile-form',
                params: { subCategoryId: String(profile.subCategoryId) },
              })
            }
            style={styles.action}
          />
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>What you sent</Text>
        {form.loading ? (
          <Text style={styles.muted}>Loading labels…</Text>
        ) : groups.length === 0 ? (
          <Text style={styles.muted}>No answers were recorded.</Text>
        ) : (
          groups.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.details}>
                {group.answers.map((answer) => (
                  <DetailRow key={answer.key} label={answer.label} value={answer.value} />
                ))}
              </View>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Progress</Text>
        {profile.history.length === 0 ? (
          <Banner tone="info">
            Nothing has happened yet. You will be emailed as soon as scrutiny begins.
          </Banner>
        ) : (
          <View style={styles.timeline}>
            {profile.history.map((event, index) => (
              <View key={event.id} style={styles.event}>
                <View style={styles.eventRail}>
                  <View style={styles.eventDot} />
                  {index < profile.history.length - 1 ? <View style={styles.eventLine} /> : null}
                </View>
                <View style={styles.eventBody}>
                  <Text style={styles.eventAction}>{event.action}</Text>
                  <Text style={styles.eventMeta}>
                    {`${event.byUserName} · ${event.byRole} · ${shortDate(event.on)}`}
                  </Text>
                  {event.rejectionReasonLabel ? (
                    <Text style={styles.eventReason}>{event.rejectionReasonLabel}</Text>
                  ) : null}
                  {event.remarks ? <Text style={styles.eventRemarks}>{event.remarks}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const humanise = (key: string): string =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());

/** What one answer reads as. Anything shaped is stated rather than JSON. */
const display = (value: unknown): string => {
  if (Array.isArray(value)) return value.map((item) => display(item)).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== null && inner !== undefined && inner !== '')
      .map(([key, inner]) => `${humanise(key)}: ${display(inner)}`)
      .join(' · ');
  }
  return String(value);
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headText: { flex: 1, gap: 2 },
  title: { fontSize: font.md, fontWeight: '700', color: colors.ink900, lineHeight: 21 },
  code: { fontSize: font.xs, color: colors.ink500, letterSpacing: 0.4 },

  details: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  muted: { fontSize: font.sm, color: colors.ink500 },
  remarks: { fontSize: font.xs, color: colors.ink700, lineHeight: 17 },
  action: { marginTop: spacing.sm },

  group: { gap: 4, marginTop: spacing.xs },
  groupTitle: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.brand700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  timeline: { gap: 0 },
  event: { flexDirection: 'row', gap: spacing.md },
  eventRail: { width: 12, alignItems: 'center' },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand600,
    marginTop: 5,
  },
  eventLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  eventBody: { flex: 1, paddingBottom: spacing.md, gap: 2 },
  eventAction: { fontSize: font.sm, fontWeight: '700', color: colors.ink900 },
  eventMeta: { fontSize: font.xs, color: colors.ink500 },
  eventReason: { fontSize: font.xs, fontWeight: '600', color: colors.danger700, marginTop: 2 },
  eventRemarks: {
    fontSize: font.xs,
    color: colors.ink700,
    backgroundColor: colors.ink50,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: 4,
    lineHeight: 17,
  },
});
