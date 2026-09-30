import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { me } from '../../src/api/endpoints';
import type { ApplicantProgram } from '../../src/api/types';
import { useResource } from '../../src/api/useResource';
import { useAuth } from '../../src/auth/AuthContext';
import { IdentityPanel, QuickTile, QuickTiles, SectionHeading } from '../../src/components/blocks';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Loading,
  StatusPill,
  inr,
  shortDate,
} from '../../src/components/ui';
import { colors, font, labelFor, radius, spacing } from '../../src/theme';

/**
 * Everything the applicant is eligible for, which the API narrows to their
 * category and sub-category. Applying opens the Super Admin designed form.
 */
export default function Programs() {
  const router = useRouter();
  const { applicant } = useAuth();
  const [term, setTerm] = useState('');
  const programs = useResource<ApplicantProgram[]>(() => me.programs(), []);

  /* Coming back from the apply screen has to show the new standing. Without
     this the card still said Apply until the app was restarted, which is
     what made it look as though nothing had been submitted. The first focus
     is skipped because the resource already loads on mount. */
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      programs.refresh();
      /* The resource itself is a fresh object on every render, so depending
         on it re-ran this effect on every render and refetched in a loop.
         refresh is stable; that is the whole dependency. */
    }, [programs.refresh]),
  );

  const list = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const all = programs.data ?? [];
    if (!needle) return all;
    return all.filter(
      (program) =>
        program.name.toLowerCase().includes(needle) ||
        program.code.toLowerCase().includes(needle),
    );
  }, [programs.data, term]);

  /* Two things the card used to try to say at once. The details belong
     behind the card, and the standing of an application belongs behind the
     button that reports it. */
  const [details, setDetails] = useState<ApplicantProgram | null>(null);
  const [standing, setStanding] = useState<ApplicantProgram | null>(null);

  if (programs.loading) return <Loading label="Loading programs…" />;

  return (
    <FlatList
      data={list}
      keyExtractor={(program) => String(program.programTypeId)}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={programs.refreshing} onRefresh={programs.refresh} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <IdentityPanel
            applicant={applicant}
            greeting={applicant ? `Hello, ${applicant.fullName.split(' ')[0]}` : 'Welcome'}
          />

          <QuickTiles>
            <QuickTile
              icon="calendar-outline"
              label="Batches"
              action="Register"
              onPress={() => router.push('/(tabs)/batches')}
            />
          </QuickTiles>

          {programs.error ? <Banner tone="danger">{programs.error}</Banner> : null}

          <SectionHeading>Programs open to you</SectionHeading>
          <SearchBox value={term} onChange={setTerm} />
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="layers-outline"
          title={term ? 'No match' : 'No programs open yet'}
          message={
            term
              ? 'Try a different name or code.'
              : 'Programs appear here as soon as they open for your category.'
          }
        />
      }
      renderItem={({ item }) => (
        <ProgramCard
          program={item}
          onApply={() => router.push(`/apply/${item.programTypeId}`)}
          onDetails={() => setDetails(item)}
          onStanding={() => setStanding(item)}
        />
      )}
      ListFooterComponent={
        <>
          <ProgramDetails program={details} onClose={() => setDetails(null)} />
          <ApplicationStanding
            program={standing}
            onClose={() => setStanding(null)}
            onOpen={(id) => {
              setStanding(null);
              router.push(`/application/${id}`);
            }}
          />
        </>
      }
    />
  );
}

/** What a program asks of somebody, off the card and behind a tap. */
function ProgramDetails({
  program,
  onClose,
}: {
  program: ApplicantProgram | null;
  onClose: () => void;
}) {
  if (!program) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{program.name}</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.ink600} />
            </Pressable>
          </View>

          {program.shortDescription ? (
            <Text style={styles.sheetBody}>{program.shortDescription}</Text>
          ) : null}

          <DetailLine label="Minimum qualification" value={program.minQualification ?? 'None'} />
          <DetailLine
            label="Minimum experience"
            value={
              program.minExperienceYears > 0
                ? `${program.minExperienceYears} years`
                : 'None'
            }
          />
          <DetailLine label="Duration" value={`${program.durationDays} days`} />
          <DetailLine label="Mode" value={program.deliveryMode} />
          <DetailLine label="Examination" value={program.isExamMandatory ? 'Required' : 'None'} />
          <DetailLine
            label="Fee payable"
            value={program.feePayable > 0 ? inr(program.feePayable) : 'Free'}
          />

          <Button label="Close" variant="secondary" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Where the application this applicant already made has got to. */
function ApplicationStanding({
  program,
  onClose,
  onOpen,
}: {
  program: ApplicantProgram | null;
  onClose: () => void;
  onOpen: (applicationId: number) => void;
}) {
  if (!program) return null;

  const rejected = program.existingApplicationStatus === 'Rejected';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Your application</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.ink600} />
            </Pressable>
          </View>

          <Text style={styles.sheetBody}>{program.name}</Text>

          <View style={styles.standingRow}>
            <StatusPill value={program.existingApplicationStatus ?? 'Submitted'} />
          </View>

          {program.existingApplicationNo ? (
            <DetailLine label="Application no." value={program.existingApplicationNo} />
          ) : null}
          {program.existingSubmittedOn ? (
            <DetailLine label="Submitted" value={shortDate(program.existingSubmittedOn)} />
          ) : null}
          {rejected && program.existingRejectionReason ? (
            <DetailLine label="Reason" value={program.existingRejectionReason} />
          ) : null}

          {rejected ? (
            <Text style={styles.sheetNote}>
              You can apply again once whatever was wrong has been put right.
            </Text>
          ) : (
            <Text style={styles.sheetNote}>
              You will be emailed as soon as scrutiny reaches a decision.
            </Text>
          )}

          {program.existingApplicationId ? (
            <Button
              label="Open the application"
              icon="arrow-forward"
              onPress={() => onOpen(program.existingApplicationId!)}
            />
          ) : null}
          <Button label="Close" variant="secondary" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={17} color={colors.ink500} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search programs"
        placeholderTextColor={colors.ink500}
        style={styles.searchInput}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => onChange('')} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={17} color={colors.ink400} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ProgramCard({
  program,
  onApply,
  onDetails,
  onStanding,
}: {
  program: ApplicantProgram;
  onApply: () => void;
  onDetails: () => void;
  onStanding: () => void;
}) {
  const applied = !!program.existingApplicationStatus;

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{program.name}</Text>
        </View>
        {applied ? <StatusPill value={program.existingApplicationStatus!} /> : null}
      </View>

      {program.shortDescription ? (
        <Text style={styles.cardBody}>{program.shortDescription}</Text>
      ) : null}

      <Pressable onPress={onDetails} accessibilityRole="button" style={styles.detailsLink}>
        <Ionicons name="information-circle-outline" size={15} color={colors.brand700} />
        <Text style={styles.detailsText}>Minimum Eligibility</Text>
      </Pressable>

      <View style={styles.cardFoot}>
        <View>
          <Text style={styles.feeLabel}>Fee payable</Text>
          <Text style={styles.fee}>{program.feePayable > 0 ? inr(program.feePayable) : 'Free'}</Text>
        </View>

        {/* An application already in flight gets its standing on the button
            and the rest of the story behind it. Tapping used to reopen the
            form, which then refused to submit — a dead end. */}
        {applied && !program.canApply ? (
          <Button
            label={labelFor(program.existingApplicationStatus!)}
            variant="secondary"
            icon="information-circle-outline"
            onPress={onStanding}
          />
        ) : program.canApply ? (
          <Button
            label={applied ? 'Apply again' : 'Apply'}
            icon="arrow-forward"
            onPress={onApply}
          />
        ) : (
          <Button label="Closed" variant="secondary" disabled onPress={onStanding} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  header: { gap: spacing.md, marginBottom: spacing.xs },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: font.base, color: colors.ink900 },

  card: { gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitleWrap: { flex: 1, gap: 2 },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900, lineHeight: 21 },
  cardBody: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },


  detailsLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  detailsText: { fontSize: font.sm, fontWeight: '600', color: colors.brand700 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  sheetBody: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },
  sheetNote: { fontSize: font.xs, color: colors.ink500, lineHeight: 17, marginTop: 2 },
  standingRow: { flexDirection: 'row', paddingVertical: 2 },

  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 7,
  },
  detailLabel: { fontSize: font.sm, color: colors.ink500 },
  detailValue: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.ink900, textAlign: 'right' },

  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  feeLabel: { fontSize: font.xs, color: colors.ink500 },
  fee: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
});
