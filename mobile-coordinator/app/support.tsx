import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { agency as agencyApi } from '../src/api/endpoints';
import type { AgencyContact } from '../src/api/types';
import { useAuth } from '../src/auth/AuthContext';
import { useBranding } from '../src/branding/BrandingContext';
import { Card, Title } from '../src/components/ui';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * Where to take a question.
 *
 * A screen rather than a link straight out of the menu: a coordinator at
 * a venue may have no browser worth opening and no signal to open it
 * with, and an address they can read and dial is more use than a page
 * that will not load. The web page is offered as well where the
 * department has published one.
 */
export default function Support() {
  const { branding } = useBranding();
  const { session } = useAuth();

  /* Fetched rather than carried in the session: an agency's contact
     person changes more often than a coordinator signs in. */
  const [agency, setAgency] = useState<AgencyContact | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mine = await agencyApi.mine();
        if (!cancelled) setAgency(mine);
      } catch {
        /* The office below is still shown, which is the point of the
           screen; an agency that cannot be fetched is one row missing,
           not a failure worth a banner. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const email = branding.supportEmail?.trim();
  const page = branding.supportUrl?.trim();

  /* The user ID goes in the subject line: the first thing anybody
     answering will ask for is which account this is about. */
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(
        `Coordinator app — ${session?.userCode ?? 'support request'}`,
      )}`
    : null;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Title>Need help?</Title>
      <Text style={styles.lead}>
        For anything about a program you are running — the venue, the participants, the
        marksheet — your implementing agency is the first place to ask. For the app itself,
        the office below.
      </Text>

      {/* The agency first: it is the answer to almost every question a
          coordinator has, and it was the one contact this screen told
          them to use and did not give them. */}
      {agency ? (
        <Card style={styles.card}>
          <Text style={styles.section}>Your implementing agency</Text>
          <Text style={styles.agencyName}>{agency.name}</Text>
          {agency.contactPerson ? (
            <Text style={styles.agencyPerson}>{agency.contactPerson}</Text>
          ) : null}

          {agency.mobile ? (
            <Pressable
              style={styles.row}
              onPress={() => void Linking.openURL(`tel:${agency.mobile}`)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="call-outline" size={18} color={colors.brand700} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Mobile</Text>
                <Text style={styles.rowValue}>{agency.mobile}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={colors.ink400} />
            </Pressable>
          ) : null}

          {agency.email ? (
            <Pressable
              style={styles.row}
              onPress={() =>
                void Linking.openURL(
                  `mailto:${agency.email}?subject=${encodeURIComponent(
                    `Program query - ${session?.userCode ?? ''}`,
                  )}`,
                )
              }
            >
              <View style={styles.rowIcon}>
                <Ionicons name="mail-outline" size={18} color={colors.brand700} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowValue}>{agency.email}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={colors.ink400} />
            </Pressable>
          ) : null}

          {!agency.mobile && !agency.email ? (
            <Text style={styles.none}>
              No contact has been recorded for this agency. The office below can reach them.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.section}>The scheme's office</Text>
        {mailto ? (
          <Pressable style={styles.row} onPress={() => void Linking.openURL(mailto)}>
            <View style={styles.rowIcon}>
              <Ionicons name="mail-outline" size={18} color={colors.brand700} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{email}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.ink400} />
          </Pressable>
        ) : null}

        {page ? (
          <Pressable style={styles.row} onPress={() => void Linking.openURL(page)}>
            <View style={styles.rowIcon}>
              <Ionicons name="help-buoy-outline" size={18} color={colors.brand700} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Help page</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {page}
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.ink400} />
          </Pressable>
        ) : null}

        {!mailto && !page ? (
          <Text style={styles.none}>
            No support address has been published yet. Ask your implementing agency.
          </Text>
        ) : null}
      </Card>

      <Text style={styles.footnote}>
        Signed in as {session?.fullName} ({session?.userCode}).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg },
  lead: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },
  card: { gap: spacing.sm },
  section: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  agencyName: { fontSize: font.base, fontWeight: '600', color: colors.ink900 },
  agencyPerson: { fontSize: font.sm, color: colors.ink600, marginTop: -2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 1 },
  rowLabel: { fontSize: font.xs, color: colors.ink500, letterSpacing: 0.3 },
  rowValue: { fontSize: font.base, fontWeight: '600', color: colors.ink900 },
  none: { fontSize: font.sm, color: colors.ink500, lineHeight: 18 },

  footnote: { fontSize: font.xs, color: colors.ink500, textAlign: 'center' },
});
