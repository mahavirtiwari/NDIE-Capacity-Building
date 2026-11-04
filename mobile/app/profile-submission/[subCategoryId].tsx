import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { me } from '../../src/api/endpoints';
import type {
  ProfileField,
  ProfileForm,
  ProfileSection,
  ProfileStanding,
} from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import {
  Banner,
  Button,
  Card,
  DetailRow,
  EmptyState,
  Loading,
  StatusPill,
  actedBy,
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

  /* The answer being read in full, where one is too long to sit in a
     row. A work-experience entry runs to a paragraph; printed into the
     value column it pushed the rest of the page down by a screen and
     was still hard to read at that width. */
  const [reading, setReading] = useState<{ label: string; value: string } | null>(null);

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
            return {
              key: field.key,
              label: field.label,
              value: display(responses[field.key], field),
            };
          }),
      }))
      .filter((section) => section.answers.length > 0);

    /* What is left: a repeating section's rows, stored under the section's
       own key, and anything a republished form no longer asks.

       Both were headed by running the stored key through humanise, which
       can only split on an underscore or a capital - and a section key has
       neither, so "educationalqualifications" came out as
       "Educationalqualifications". The form knows what that section is
       called; it is asked first. Each row is listed on its own, against
       that section's own field labels, rather than every row of every
       section run together into one paragraph of codes. */
    for (const key of given) {
      const owner = sectionByKey(form.data?.sections, key);
      const rows = responses[key];

      if (owner && Array.isArray(rows)) {
        rows.forEach((row, index) => {
          const answers = rowAnswers(owner, row);
          if (answers.length === 0) return;

          sections.push({
            title: rows.length > 1 ? `${owner.title} ${index + 1}` : owner.title,
            answers,
          });
        });
        continue;
      }

      sections.push({
        title: owner?.title ?? 'Also sent',
        answers: [{ key, label: owner ? owner.title : humanise(key), value: display(rows) }],
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
            label={
              profile.status === 'Rejected'
                ? 'Correct and send again'
                : profile.isUpdate
                  ? 'Update your details'
                  : 'Open the form'
            }
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
          groups.map((group, index) => (
            <View key={`${group.title}-${index}`} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.details}>
                {group.answers.map((answer) => (
                  <Answer
                    key={answer.key}
                    label={answer.label}
                    value={answer.value}
                    onRead={() => setReading({ label: answer.label, value: answer.value })}
                  />
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
                    {`${actedBy(event.byRole)} · ${shortDate(event.on)}`}
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

      {/* One answer, read in full. */}
      <Modal
        visible={!!reading}
        animationType="fade"
        transparent
        onRequestClose={() => setReading(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setReading(null)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{reading?.label}</Text>
              <Pressable onPress={() => setReading(null)} accessibilityLabel="Close" hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.ink600} />
              </Pressable>
            </View>
            <ScrollView style={styles.sheetBody}>
              <Text style={styles.sheetText}>{reading?.value}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

/**
 * One answer in the list.
 *
 * Short ones read in place. A long one - a work-experience entry runs to
 * a paragraph - is cut to three lines with a way to read the rest: printed
 * in full it pushed the page down by a screen and was still hard to read
 * at the width of a value column.
 */
function Answer({
  label,
  value,
  onRead,
}: {
  label: string;
  value: string;
  onRead: () => void;
}) {
  const long = value.length > 140;

  return (
    <View style={styles.answer}>
      <Text style={styles.answerLabel}>{label}</Text>
      <Text style={styles.answerValue} numberOfLines={long ? 3 : undefined}>
        {value}
      </Text>
      {long ? (
        <Pressable accessibilityRole="button" onPress={onRead} style={styles.answerMore}>
          <Ionicons name="eye-outline" size={14} color={colors.brand700} />
          <Text style={styles.answerMoreText}>View</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The section a leftover key belongs to, where one does.
 *
 * A repeating section's rows are stored under the section's own key, and
 * the form is the only thing that knows which section that is.
 */
const sectionByKey = (
  sections: ProfileSection[] | undefined,
  key: string,
): ProfileSection | undefined =>
  (sections ?? []).find(
    (section) =>
      section.key === key || section.title.toLowerCase().replace(/[^a-z0-9]+/g, '') === key,
  );

/** One row of a repeating section, against that section's field labels. */
const rowAnswers = (
  section: ProfileSection,
  row: unknown,
): { key: string; label: string; value: string }[] => {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) {
    return [{ key: section.title, label: section.title, value: display(row) }];
  }

  const held = row as Record<string, unknown>;

  return section.fields
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .filter((field) => {
      const value = held[field.key];
      return value !== null && value !== undefined && value !== '';
    })
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: display(held[field.key], field),
    }));
};

/**
 * A stored key as a heading.
 *
 * Underscores and camel case split into words. A key with neither - the
 * ones a repeating section is stored under, like
 * "educationalqualifications" - cannot be split by looking at it, which
 * is why {@link titleFor} asks the form for the section's real title
 * first and only falls back to here.
 */
const humanise = (key: string): string =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase())
    .trim();

/**
 * A stored option code as the words the applicant picked.
 *
 * Answers to a choice field are kept as codes, and the codes were being
 * printed: an applicant read back
 * "QUALIFIED_LEAD_AUDITOR_CERTIFICATION_IN_QUALITY_MANAGEMENT_SYSTEMS..."
 * where they had chosen a sentence. The form knows the wording; where it
 * no longer carries the option - a form republished since - the code is
 * at least turned back into words rather than shouted in full.
 */
const optionLabel = (field: ProfileField | undefined, raw: string): string => {
  const match = field?.options?.find((option) => option.value === raw);
  if (match) return match.label;

  /* A code and nothing else: all capitals, with underscores. Anything
     the applicant typed is left exactly as they typed it. */
  if (/^[A-Z0-9]+(_[A-Z0-9]+)+$/.test(raw)) {
    const words = raw.toLowerCase().replace(/_+/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  return raw;
};

/** What one answer reads as, against the field that asked it. */
const display = (value: unknown, field?: ProfileField): string => {
  if (Array.isArray(value)) {
    return value.map((item) => display(item, field)).join(', ');
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== null && inner !== undefined && inner !== '')
      .map(([key, inner]) => `${humanise(key)}: ${display(inner)}`)
      .join(' · ');
  }
  return optionLabel(field, String(value));
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  /* An answer stacked under its label rather than squeezed into a column
     beside it: half the width for a work-experience entry meant eighteen
     lines of four words. */
  answer: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  answerLabel: { fontSize: font.xs, color: colors.ink500 },
  answerValue: { fontSize: font.sm, color: colors.ink900, lineHeight: 20 },
  answerMore: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 4,
    paddingVertical: 4,
  },
  answerMoreText: { fontSize: font.xs, fontWeight: '700', color: colors.brand700 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxHeight: '75%',
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  sheetBody: { padding: spacing.lg },
  sheetText: { fontSize: font.sm, color: colors.ink800, lineHeight: 22 },

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
