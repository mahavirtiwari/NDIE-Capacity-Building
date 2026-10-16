import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { coordinatorProfile } from '../../src/api/endpoints';
import type { CoordinatorProfile } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { Banner, Card, Loading } from '../../src/components/ui';
import { colors, font, radius, spacing } from '../../src/theme';

/**
 * The account as the implementing agency set it up.
 *
 * It used to show four lines - ID, e-mail, mobile, role - which is not
 * enough for the person whose record it is to tell whether the office
 * has it right. Everything the creation form asks for is here, the
 * territory included, because a coordinator who cannot see which
 * districts they are allocated to cannot tell anybody they are wrong.
 *
 * Nothing on it can be edited. That is not an omission: the record is
 * the agency's, and a coordinator correcting their own mobile number on
 * a phone would put the office's copy and the app's out of step.
 */
export default function Profile() {
  const { session } = useAuth();

  const [me, setMe] = useState<CoordinatorProfile | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailure(null);
    try {
      setMe(await coordinatorProfile.mine());
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not load your profile.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!me && !failure) return <Loading label="Loading your profile…" />;

  const initials = (me?.fullName ?? session?.fullName ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {failure ? <Banner tone="danger">{failure}</Banner> : null}

      {/* The identity band: who, which account, which role. Everything
          below is detail about this. */}
      <View style={styles.who}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{me?.fullName ?? session?.fullName}</Text>
        {me?.designation ? <Text style={styles.designation}>{me.designation}</Text> : null}
        <View style={styles.codeRow}>
          <Text style={styles.code}>{me?.userCode ?? session?.userCode}</Text>
          {me?.roleName ? <Text style={styles.rolePill}>{me.roleName}</Text> : null}
        </View>
      </View>

      {me ? (
        <>
          <Section icon="call-outline" title="Contact">
            <Line label="Mobile" value={me.mobile} />
            <Line label="Email" value={me.email} />
          </Section>

          <Section icon="business-outline" title="Appointed by">
            <Line
              label="Implementing agency"
              value={me.agencyName}
              note={me.agencyCode ?? undefined}
            />
            <Line
              label="Reports to"
              value={me.reportsToName}
              note={me.reportsToCode ?? undefined}
            />
            <Line label="Organisation" value={me.organisationName} />
          </Section>

          {/* The territory, which is the part a coordinator most often
              needs to check: it decides which programmes reach them. */}
          <Section icon="map-outline" title="Coverage">
            <Tags label="States" values={me.states} />
            <Tags label="Districts" values={me.districts} />
            <Tags label="Categories" values={me.categories} />
            <Tags label="Sub-categories" values={me.subCategories} />
            <Tags label="Program types" values={me.programTypes} />
          </Section>

          <Section icon="location-outline" title="Where you are posted">
            <Line label="City" value={me.city} />
            <Line label="District" value={me.districtName} />
            <Line label="State" value={me.stateName} />
            <Line label="PIN code" value={me.pincode} />
          </Section>

          <Section icon="document-text-outline" title="On record">
            <Line
              label="PAN"
              value={me.panLast4 ? `•••••• ${me.panLast4}` : null}
              note={me.panLast4 ? 'last four digits' : undefined}
            />
            <Line
              label="Aadhaar"
              value={me.aadhaarLast4 ? `•••• •••• ${me.aadhaarLast4}` : null}
              note={me.aadhaarLast4 ? 'last four digits' : undefined}
            />
          </Section>
        </>
      ) : null}

      <Text style={styles.footnote}>
        This record is held by the implementing agency that issued your account. Ask them to
        correct anything that is wrong.
      </Text>
    </ScrollView>
  );
}

/** A headed group of lines. */
function Section({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={15} color={colors.brand700} />
        <Text style={styles.section}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

/**
 * One fact. Shown even when it is blank, with a dash: a coordinator
 * checking their record needs to see that the office left the
 * designation empty, not to be shown a shorter list.
 */
function Line({ label, value, note }: { label: string; value?: string | null; note?: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <View style={styles.lineRight}>
        <Text style={[styles.lineValue, !value && styles.lineEmpty]}>
          {value?.trim() ? value : 'Not recorded'}
        </Text>
        {note ? <Text style={styles.lineNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

/** A list of names as chips, because a comma-run of fifteen districts is unreadable. */
function Tags({ label, values }: { label: string; values: string[] }) {
  return (
    <View style={styles.tags}>
      <Text style={styles.lineLabel}>{label}</Text>
      {values.length === 0 ? (
        <Text style={[styles.lineValue, styles.lineEmpty]}>None allocated</Text>
      ) : (
        <View style={styles.tagRow}>
          {values.map((value) => (
            <Text key={value} style={styles.tag}>
              {value}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  who: { alignItems: 'center', gap: 3, paddingVertical: spacing.sm },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.brand700,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarText: { color: colors.white, fontSize: font.lg, fontWeight: '700', letterSpacing: 1 },
  name: { fontSize: font.lg, fontWeight: '700', color: colors.ink900, textAlign: 'center' },
  designation: { fontSize: font.sm, color: colors.ink600, textAlign: 'center' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  code: { fontSize: font.sm, color: colors.brand700, fontWeight: '700', letterSpacing: 0.5 },
  rolePill: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.brand800,
    backgroundColor: colors.brand50,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },

  card: { gap: spacing.xs },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  section: { fontSize: font.sm, fontWeight: '700', color: colors.ink900, letterSpacing: 0.2 },

  /* Label left, value right, on one line: a record is read by running
     down the labels and across once, not by reading every pair. */
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  lineLabel: { fontSize: font.sm, color: colors.ink500, flexShrink: 0 },
  lineRight: { flex: 1, alignItems: 'flex-end' },
  lineValue: { fontSize: font.sm, fontWeight: '600', color: colors.ink900, textAlign: 'right' },
  lineEmpty: { fontWeight: '400', color: colors.ink400, fontStyle: 'italic' },
  lineNote: { fontSize: font.xs, color: colors.ink400 },

  tags: {
    gap: 5,
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: {
    fontSize: font.xs,
    color: colors.ink800,
    backgroundColor: colors.brand50,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },

  footnote: {
    fontSize: font.xs,
    color: colors.ink500,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: spacing.xs,
  },
});
