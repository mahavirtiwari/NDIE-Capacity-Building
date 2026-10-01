import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../src/api/client';
import { me } from '../src/api/endpoints';
import type {
  ProfileChoice,
  ProfileForm,
  ProfileSection,
  ProfileStanding,
} from '../src/api/types';
import { useResource } from '../src/api/useResource';
import {
  DynamicSectionView,
  ProfileScope,
  statusLabelFor,
  useDynamicForm,
  type SectionProgress,
  type SectionStatus,
} from '../src/components/DynamicForm';
import { Picker } from '../src/components/Picker';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Loading,
  StatusPill,
  shortDate,
} from '../src/components/ui';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * The first thing an applicant does, and the gate in front of everything
 * else.
 *
 * They pick the discipline they want to work in, declare who they are for
 * it, and it goes to scrutiny. Until that comes back accepted there are no
 * programs under it to look at — so this screen has to be able to say, on
 * its own, exactly where they stand: waiting, turned down and why, how many
 * tries are left, or shut out until a date.
 *
 * One account, a profile per category. The discipline used to be chosen at
 * sign-up, which fixed it before the applicant had seen what the programs
 * were and made a second one a second account. It is chosen here instead,
 * one sub-category per category, and somebody entering a second category
 * can copy the answers from a profile they already hold rather than typing
 * their qualifications out again.
 *
 * The form is the same section-at-a-time flow as applying, because it is
 * the same kind of form and an applicant should not have to learn two.
 */
export default function ProfileFormScreen() {
  /* A link from elsewhere can name the discipline — the dashboard sends
     somebody straight back to the profile that is waiting on them. */
  const params = useLocalSearchParams<{ subCategoryId?: string }>();
  const [chosen, setChosen] = useState<number | null>(() =>
    params.subCategoryId ? Number(params.subCategoryId) : null,
  );

  const profiles = useResource<ProfileStanding[]>(() => me.myProfiles(), []);
  const choices = useResource<ProfileChoice[]>(() => me.profileChoices(), []);

  /* Depending on the stable refresh functions rather than on the resource
     objects: those are a fresh object every render, and this loop refetched
     until the device gave up. */
  useFocusEffect(
    useCallback(() => {
      profiles.refresh();
      choices.refresh();
    }, [profiles.refresh, choices.refresh]),
  );

  const held = profiles.data ?? [];
  const open = choices.data ?? [];

  const leave = useCallback(() => {
    profiles.refresh();
    choices.refresh();
    setChosen(null);
  }, [profiles.refresh, choices.refresh]);

  if (chosen !== null) {
    return (
      /* Keyed on the discipline so that switching profiles starts the form,
         its answers and its attachments over rather than carrying one
         discipline's state into another. */
      <ProfileFor
        key={chosen}
        subCategoryId={chosen}
        held={held}
        onLeave={held.length + open.length > 1 ? leave : null}
      />
    );
  }

  return (
    <ProfileChooser
      held={held}
      choices={open}
      loading={profiles.loading || choices.loading}
      error={profiles.error ?? choices.error}
      onPick={setChosen}
    />
  );
}

/* ------------------------------------------------------ pick a discipline */

/**
 * The profiles this account holds, and the disciplines a new one may be
 * started in.
 *
 * Categories already entered are not offered: the rule is one sub-category
 * per category, and a list that offers what cannot be chosen wastes a tap
 * and then has to explain itself.
 */
function ProfileChooser({
  held,
  choices,
  loading,
  error,
  onPick,
}: {
  held: ProfileStanding[];
  choices: ProfileChoice[];
  loading: boolean;
  error: string | null;
  onPick: (subCategoryId: number) => void;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);

  const screenOptions = useMemo(() => ({ title: 'Your profile' }), []);

  const categories = useMemo(() => {
    const seen = new Map<number, string>();
    for (const choice of choices) seen.set(choice.categoryId, choice.categoryName);
    return [...seen].map(([value, label]) => ({ value: String(value), label }));
  }, [choices]);

  const subCategories = useMemo(
    () =>
      choices
        .filter((choice) => String(choice.categoryId) === categoryId)
        .map((choice) => ({
          value: String(choice.subCategoryId),
          label: choice.subCategoryName,
        })),
    [choices, categoryId],
  );

  const picked = useMemo(
    () => choices.find((choice) => String(choice.subCategoryId) === subCategoryId) ?? null,
    [choices, subCategoryId],
  );

  /* What choosing this one actually means, said before forty answers are
     typed rather than after they are sent. */
  const consequence = !picked
    ? null
    : !picked.requiresProfileForm
      ? 'This sub-category asks for no profile form. Its programs are open to you already.'
      : !picked.formPublished
        ? 'No profile form has been published for this sub-category yet, so nothing can be '
          + 'sent. Please check again later.'
        : picked.requiresScrutiny
          ? 'The profile for this sub-category is read before its programs open. You will be '
            + 'told the outcome.'
          : 'The profile for this sub-category is not scrutinised. Its programs open to you as '
            + 'soon as you send it.';

  if (loading && held.length === 0 && choices.length === 0) {
    return <Loading label="Checking your profiles…" />;
  }

  if (error && held.length === 0 && choices.length === 0) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Could not load your profiles"
        message={error}
      />
    );
  }

  if (held.length === 0 && choices.length === 0) {
    return (
      <EmptyState
        icon="layers-outline"
        title="Nothing to apply for yet"
        message="No disciplines are open at the moment. Please check again later."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={screenOptions} />

      {held.length > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Your profiles</Text>
          <Text style={styles.muted}>
            One profile for each category you have entered. Open one to see where it stands or
            to correct it.
          </Text>

          <View style={styles.list}>
            {held.map((profile) => (
              <ProfileRow
                key={profile.subCategoryId}
                profile={profile}
                onPress={() => onPick(profile.subCategoryId)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {choices.length > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>
            {held.length > 0 ? 'Enter another category' : 'Choose what you are applying for'}
          </Text>
          <Text style={styles.muted}>
            Pick a category and the sub-category within it. The form for that sub-category is
            listed below once you continue.
          </Text>

          <Picker
            label="Category"
            required
            value={categoryId}
            options={categories}
            onChange={(next) => {
              setCategoryId(next);
              setSubCategoryId(null);
            }}
          />

          <Picker
            label="Sub-category"
            required
            value={subCategoryId}
            options={subCategories}
            disabled={!categoryId}
            hint={
              categoryId
                ? 'One sub-category for each category, so this cannot be changed afterwards.'
                : 'Choose a category first.'
            }
            onChange={setSubCategoryId}
          />

          {consequence ? (
            <Banner tone={picked?.formPublished === false ? 'warning' : 'info'}>
              {consequence}
            </Banner>
          ) : null}

          <Button
            label="Continue"
            icon="arrow-forward"
            disabled={!subCategoryId || picked?.formPublished === false}
            onPress={() => subCategoryId && onPick(Number(subCategoryId))}
          />
        </Card>
      ) : held.length > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.muted}>
            You have a profile in every category open to you. One category is entered once,
            under one sub-category.
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function ProfileRow({
  profile,
  onPress,
}: {
  profile: ProfileStanding;
  onPress: () => void;
}) {
  const tone = profile.cleared
    ? statusTone.done
    : profile.status === 'Rejected' || profile.blockedUntil
      ? statusTone.pending
      : statusTone.progress;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${profile.subCategoryName ?? 'Profile'}, ${profile.status ?? 'not started'}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
        <Ionicons
          name={profile.cleared ? 'checkmark' : 'document-text-outline'}
          size={16}
          color={tone.fg}
        />
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{profile.subCategoryName ?? 'Profile'}</Text>
        {profile.categoryName ? (
          <Text style={styles.rowMeta}>{profile.categoryName}</Text>
        ) : null}
      </View>

      {profile.status ? <StatusPill value={profile.status} /> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.ink400} />
    </Pressable>
  );
}

/* --------------------------------------------------- one discipline's form */

function ProfileFor({
  subCategoryId,
  held,
  onLeave,
}: {
  subCategoryId: number;
  held: ProfileStanding[];
  /** Null where there is nothing else to switch to. */
  onLeave: (() => void) | null;
}) {
  const router = useRouter();

  const standing = useResource<ProfileStanding>(
    () => me.profileStanding(subCategoryId),
    [subCategoryId],
  );
  const form = useResource<ProfileForm>(() => me.profileForm(subCategoryId), [subCategoryId]);

  const state = useDynamicForm(form.data);

  const sections = useMemo(
    () =>
      (form.data?.sections ?? [])
        .filter((s) => s.isEnabled && s.fields.some((f) => f.isEnabled))
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [form.data],
  );

  /* What they said last time, put back so a correction starts from it
     rather than from an empty form. Once only: typing over a prefilled
     answer must not be undone by a re-render. */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !form.data || !standing.data?.responses) return;
    seeded.current = true;
    state.prefill(standing.data.responses);
  }, [form.data, standing.data, state]);

  useFocusEffect(
    useCallback(() => {
      standing.refresh();
    }, [standing.refresh]),
  );

  /* Whether a submission is read before the programs open. The whole
     screen speaks differently either way: a form that nobody reads is
     accepted as it arrives, so telling the applicant to wait for an
     outcome would be promising something that will never come. Defaults
     to true, which is the safe reading of a form the server has not
     answered for yet. */
  const scrutinised = form.data?.requiresScrutiny ?? true;

  const [openId, setOpenId] = useState<number | null>(null);
  const open = useMemo(() => sections.find((s) => s.id === openId) ?? null, [sections, openId]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  /* Other profiles that were accepted, which a new one can start from.
     Only accepted ones: copying answers that scrutiny turned down would
     carry the fault into the new discipline, and the API refuses it. */
  const sources = useMemo(
    () =>
      held
        .filter(
          (profile) =>
            profile.subCategoryId !== subCategoryId && profile.status === 'Approved',
        )
        .map((profile) => ({
          value: String(profile.subCategoryId),
          label: profile.subCategoryName ?? `Sub-category ${profile.subCategoryId}`,
        })),
    [held, subCategoryId],
  );

  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async () => {
    if (!copyFrom) return;
    setCopying(true);
    setError(null);
    try {
      const answers = await me.fetchProfile(subCategoryId, Number(copyFrom));
      state.prefill(answers);
      /* Said out loud, because nothing has been sent: the applicant still
         has to read every answer and submit it themselves. */
      setCopied(
        'Answers copied in. Check every section — nothing has been sent to scrutiny yet.',
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not copy those answers.',
      );
    } finally {
      setCopying(false);
    }
  };

  const backToSections = useCallback(() => {
    setSectionError(null);
    setOpenId(null);
  }, []);

  const screenOptions = useMemo(() => {
    const back = open ? backToSections : onLeave;
    return {
      title: open ? open.title : (standing.data?.subCategoryName ?? 'Your profile'),
      headerLeft: back
        ? () => (
            <Pressable
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel={open ? 'Back to sections' : 'Back to your profiles'}
              hitSlop={10}
            >
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </Pressable>
          )
        : undefined,
    };
  }, [open, backToSections, onLeave, standing.data?.subCategoryName]);

  if (standing.loading) return <Loading label="Checking your profile…" />;

  /* Without this the screen fell through to "tell us who you are" when the
     standing could not be loaded at all — an empty form offered to somebody
     whose session had expired, which would have been sent and refused. */
  if (!standing.data) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Could not load your profile"
        message={standing.error ?? 'Pull down to try again.'}
      />
    );
  }

  const where = standing.data;

  /* Nothing to fill in: this discipline asks for no profile form, so the
     programs were never behind it. */
  if (!where.required) {
    return (
      <EmptyState
        icon="checkmark-circle-outline"
        title="No profile form needed"
        message={`${where.subCategoryName ?? 'This sub-category'} does not ask for one. The programs open to you are under Dashboard.`}
      />
    );
  }

  const submit = async () => {
    if (!state.validate()) {
      setError('Something is still missing. Check whatever is marked in red.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const sent = await me.submitProfile(subCategoryId, state.payload());
      standing.refresh();
      Alert.alert(
        sent.cleared ? 'Profile complete' : 'Profile sent',
        sent.cleared
          ? 'Your profile has been accepted. The programs open to you are ready now.'
          : 'Your profile has gone for scrutiny. You will be told the outcome, and the '
            + 'programs open to you will appear once it is accepted.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/programs') }],
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send your profile.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------------------------- one section, alone */

  if (open) {
    const at = sections.indexOf(open);
    const next = sections[at + 1] ?? null;

    const keep = () => {
      if (!state.validateSection(open)) {
        setSectionError('Please correct the highlighted fields before moving on.');
        return;
      }
      setError(null);
      setSectionError(null);
      setOpenId(next ? next.id : null);
    };

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Stack.Screen options={screenOptions} />

        <ScrollView
          key={`section-${open.id}`}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepRow}>
            <Text style={styles.stepText}>{`Section ${at + 1} of ${sections.length}`}</Text>
            <StatusChip status={state.progressOf(open).status} />
          </View>

          <ProfileScope subCategoryId={subCategoryId}>
            <DynamicSectionView section={open} state={state} />
          </ProfileScope>

          {sectionError ? <Banner tone="danger">{sectionError}</Banner> : null}

          <Button
            label={next ? 'Save and continue' : 'Save and finish'}
            icon={next ? 'arrow-forward' : 'checkmark'}
            onPress={keep}
          />
          <Button label="Back to sections" variant="secondary" onPress={backToSections} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  /* ------------------------------------------------------ where they are */

  const completed = sections.filter((s) => state.progressOf(s).status === 'done').length;
  const blocked = !!where.blockedUntil;
  const waiting = where.status === 'Submitted' || where.status === 'UnderScrutiny';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <Stack.Screen options={screenOptions} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>{where.subCategoryName ?? 'Your profile'}</Text>
            {where.status ? <StatusPill value={where.status} /> : null}
          </View>

          {where.categoryName ? (
            <Text style={styles.muted}>{where.categoryName}</Text>
          ) : null}

          {blocked ? (
            <>
              <Banner tone="danger">
                {`Your profile was turned down ${where.attemptsAllowed} times. You can try `
                  + `again after ${shortDate(where.blockedUntil)}.`}
              </Banner>
              {where.blockReason ? (
                <Text style={styles.note}>{`Last reason: ${where.blockReason}`}</Text>
              ) : null}
            </>
          ) : waiting ? (
            <Banner tone="info">
              Your profile is with scrutiny. You will be told the outcome, and the programs open
              to you will appear here once it is accepted.
            </Banner>
          ) : where.cleared ? (
            <Banner tone="success">
              Your profile has been accepted. The programs open to you are under Dashboard.
            </Banner>
          ) : where.status === 'Rejected' ? (
            <>
              <Banner tone="warning">
                {where.rejectionReasonLabel ?? 'Your profile was turned down.'}
              </Banner>
              {where.remarks ? <Text style={styles.note}>{where.remarks}</Text> : null}
              <Text style={styles.note}>
                {`Your answers are filled in below. Correct what was wrong and send it again — `
                  + `${where.attemptsLeft} `
                  + `${where.attemptsLeft === 1 ? 'try' : 'tries'} left.`}
              </Text>
            </>
          ) : (
            <Text style={styles.note}>
              {scrutinised
                ? 'Tell us who you are. This is asked once for this sub-category. It goes to '
                  + 'scrutiny, and every program under it opens to you once it has been '
                  + 'accepted.'
                : 'Tell us who you are. This is asked once for this sub-category, and every '
                  + 'program under it opens to you as soon as you send it \u2014 there is '
                  + 'nothing to wait for.'}
            </Text>
          )}
        </Card>

        {where.cleared || blocked ? (
          <Button
            label="Back to programs"
            variant="secondary"
            onPress={() => router.replace('/(tabs)/programs')}
          />
        ) : null}

        {/* Only while the form can still be sent, and only where there is
            another profile to copy from. Somebody entering a second
            category has already typed their qualifications out once. */}
        {where.canSubmit && sources.length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Start from a profile you already have</Text>
            <Text style={styles.muted}>
              The answers are copied into the form for you to check. Only what this form asks
              is brought across, and nothing is sent until you send it.
            </Text>

            <Picker
              label="Copy answers from"
              value={copyFrom}
              options={sources}
              onChange={setCopyFrom}
            />

            <Button
              label={copying ? 'Copying…' : 'Copy answers'}
              icon="copy-outline"
              variant="secondary"
              disabled={!copyFrom}
              loading={copying}
              onPress={copy}
            />

            {copied ? <Banner tone="info">{copied}</Banner> : null}
          </Card>
        ) : null}

        {where.canSubmit && form.data && sections.length > 0 ? (
          <>
            <Card style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.sectionTitle}>The form</Text>
                {scrutinised ? null : (
                  <View style={[styles.statusChip, { backgroundColor: statusTone.done.bg }]}>
                    <Text style={[styles.statusText, { color: statusTone.done.fg }]}>
                      No scrutiny
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.muted}>
                {`${completed} of ${sections.length} sections completed. Open a section to fill `
                  + `it in.`}
              </Text>

              <View style={styles.track}>
                <View style={[styles.trackFill, { flex: completed }]} />
                <View style={{ flex: Math.max(sections.length - completed, 0) }} />
              </View>

              <View style={styles.list}>
                {sections.map((section, index) => (
                  <SectionRow
                    key={section.id}
                    index={index}
                    section={section}
                    progress={state.progressOf(section)}
                    onPress={() => {
                      setSectionError(null);
                      setOpenId(section.id);
                    }}
                  />
                ))}
              </View>
            </Card>

            {error ? <Banner tone="danger">{error}</Banner> : null}

            {/* Named for what actually happens. "Send for scrutiny" on a form
                nobody reads described a queue the submission never joins. */}
            <Button
              label={
                submitting
                  ? 'Sending…'
                  : scrutinised
                    ? 'Send for scrutiny'
                    : 'Submit and open my programs'
              }
              icon="send"
              onPress={submit}
              loading={submitting}
            />
          </>
        ) : null}

        {where.history.length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>What happened</Text>
            {where.history.map((event, index) => (
              <View key={event.id} style={styles.event}>
                <View style={styles.eventRail}>
                  <View style={styles.eventDot} />
                  {index < where.history.length - 1 ? <View style={styles.eventLine} /> : null}
                </View>
                <View style={styles.eventBody}>
                  <Text style={styles.eventAction}>{event.action}</Text>
                  <Text style={styles.eventMeta}>
                    {`${event.byUserName} · ${shortDate(event.on)}`}
                  </Text>
                  {event.rejectionReasonLabel ? (
                    <Text style={styles.eventReason}>{event.rejectionReasonLabel}</Text>
                  ) : null}
                  {event.remarks ? <Text style={styles.eventRemarks}>{event.remarks}</Text> : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {onLeave ? (
          <Button label="Your other profiles" variant="secondary" onPress={onLeave} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------- the list */

const statusTone: Record<SectionStatus, { bg: string; fg: string }> = {
  done: { bg: colors.success50, fg: colors.success700 },
  progress: { bg: colors.warning50, fg: colors.warning700 },
  pending: { bg: colors.ink100, fg: colors.ink500 },
};

function StatusChip({ status }: { status: SectionStatus }) {
  const tone = statusTone[status];
  return (
    <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusText, { color: tone.fg }]}>{statusLabelFor(status)}</Text>
    </View>
  );
}

function SectionRow({
  index,
  section,
  progress,
  onPress,
}: {
  index: number;
  section: ProfileSection;
  progress: SectionProgress;
  onPress: () => void;
}) {
  const tone = statusTone[progress.status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${section.title}, ${statusLabelFor(progress.status)}`}
      style={({ pressed }) => [
        styles.row,
        progress.wrong > 0 && styles.rowWrong,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
        {progress.status === 'done' ? (
          <Ionicons name="checkmark" size={16} color={tone.fg} />
        ) : (
          <Text style={[styles.rowNumber, { color: tone.fg }]}>{index + 1}</Text>
        )}
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{section.title}</Text>
        <View style={styles.rowStanding}>
          <StatusChip status={progress.status} />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.ink400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  card: { gap: spacing.sm },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  note: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },
  muted: { fontSize: font.sm, color: colors.ink500 },

  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepText: { fontSize: font.sm, fontWeight: '600', color: colors.ink600 },

  track: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.ink200,
    overflow: 'hidden',
  },
  trackFill: { backgroundColor: colors.brand600 },

  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.brand50,
    borderWidth: 1,
    borderColor: colors.brand100,
    borderRadius: radius.md,
  },
  rowPressed: { backgroundColor: colors.brand100 },
  rowWrong: { borderColor: colors.danger500, backgroundColor: colors.danger50 },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowNumber: { fontSize: font.sm, fontWeight: '700' },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: font.sm, fontWeight: '700', color: colors.ink900 },
  rowMeta: { fontSize: font.xs, color: colors.ink500 },
  rowStanding: { flexDirection: 'row', alignItems: 'center' },

  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  statusText: { fontSize: font.xs, fontWeight: '700' },

  event: { flexDirection: 'row', gap: spacing.md },
  eventRail: { alignItems: 'center', width: 14 },
  eventDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.brand600,
    marginTop: 5,
  },
  eventLine: { flex: 1, width: 1, backgroundColor: colors.border, marginVertical: 3 },
  eventBody: { flex: 1, paddingBottom: spacing.md, gap: 1 },
  eventAction: { fontSize: font.sm, fontWeight: '700', color: colors.ink900 },
  eventMeta: { fontSize: font.xs, color: colors.ink500 },
  eventReason: { fontSize: font.sm, color: colors.danger700, marginTop: 2 },
  eventRemarks: { fontSize: font.sm, color: colors.ink600, lineHeight: 18, marginTop: 2 },
});
