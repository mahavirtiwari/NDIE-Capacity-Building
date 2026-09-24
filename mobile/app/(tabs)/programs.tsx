import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
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
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Loading,
  StatusPill,
  inr,
} from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * Everything the applicant is eligible for, which the API narrows to their
 * category and sub-category. Applying opens the Super Admin designed form.
 */
export default function Programs() {
  const router = useRouter();
  const { applicant } = useAuth();
  const [term, setTerm] = useState('');
  const programs = useResource<ApplicantProgram[]>(() => me.programs(), []);

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

  if (programs.loading) return <Loading label="Loading programmes…" />;

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
          <Text style={styles.greeting}>
            {applicant ? `Hello, ${applicant.fullName.split(' ')[0]}` : 'Programmes'}
          </Text>
          <Text style={styles.scope}>
            {applicant
              ? `${applicant.categoryName ?? 'All categories'} · ${applicant.subCategoryName ?? 'All sub-categories'}`
              : ''}
          </Text>

          {programs.error ? <Banner tone="danger">{programs.error}</Banner> : null}

          <SearchBox value={term} onChange={setTerm} />
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="layers-outline"
          title={term ? 'No match' : 'No programmes open yet'}
          message={
            term
              ? 'Try a different name or code.'
              : 'Programmes appear here as soon as they open for your category.'
          }
        />
      }
      renderItem={({ item }) => (
        <ProgramCard
          program={item}
          onApply={() => router.push(`/apply/${item.programTypeId}`)}
        />
      )}
    />
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={17} color={colors.ink400} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search programmes"
        placeholderTextColor={colors.ink400}
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
}: {
  program: ApplicantProgram;
  onApply: () => void;
}) {
  const applied = !!program.existingApplicationStatus;

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{program.name}</Text>
          <Text style={styles.cardCode}>{program.code}</Text>
        </View>
        {applied ? <StatusPill value={program.existingApplicationStatus!} /> : null}
      </View>

      {program.shortDescription ? (
        <Text style={styles.cardBody}>{program.shortDescription}</Text>
      ) : null}

      <View style={styles.chips}>
        <Chip>{`${program.durationDays} days`}</Chip>
        <Chip>{program.deliveryMode}</Chip>
        {program.isExamMandatory ? <Chip>Exam</Chip> : null}
        {program.minExperienceYears > 0 ? (
          <Chip>{`${program.minExperienceYears}+ yrs experience`}</Chip>
        ) : null}
      </View>

      {program.minQualification ? (
        <Text style={styles.qualification}>
          <Text style={styles.qualificationLabel}>Minimum qualification: </Text>
          {program.minQualification}
        </Text>
      ) : null}

      <View style={styles.cardFoot}>
        <View>
          <Text style={styles.feeLabel}>Fee payable</Text>
          <Text style={styles.fee}>{program.feePayable > 0 ? inr(program.feePayable) : 'Free'}</Text>
        </View>

        {applied ? (
          <Button label="Applied" variant="secondary" icon="checkmark" onPress={onApply} />
        ) : program.acceptingApplications ? (
          <Button label="Apply" icon="arrow-forward" onPress={onApply} />
        ) : (
          <Button label="Closed" variant="secondary" disabled onPress={onApply} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  header: { gap: spacing.sm, marginBottom: spacing.xs },
  greeting: { fontSize: font.xl, fontWeight: '700', color: colors.ink900 },
  scope: { fontSize: font.sm, color: colors.ink500 },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: font.base, color: colors.ink900 },

  card: { gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitleWrap: { flex: 1, gap: 2 },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900, lineHeight: 21 },
  cardCode: { fontSize: font.xs, color: colors.ink500, letterSpacing: 0.4 },
  cardBody: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  qualification: { fontSize: font.xs, color: colors.ink600, lineHeight: 17 },
  qualificationLabel: { color: colors.ink500 },

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
