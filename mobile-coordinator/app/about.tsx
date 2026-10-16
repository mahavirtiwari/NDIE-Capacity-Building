import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { auth as authApi } from '../src/api/endpoints';
import type { AuthUser } from '../src/api/types';
import { BrandLogo, useBranding } from '../src/branding/BrandingContext';
import { Card } from '../src/components/ui';
import { colors, font, spacing } from '../src/theme';

/**
 * What this is, and what this account may do in it.
 *
 * Its own item in the menu rather than a card at the foot of Support,
 * where it was something you found while looking for a telephone
 * number. Neither half is written into the app: the words come from the
 * Super Admin's branding screen in the portal, and the list of what the
 * role grants is the Super Admin's role configuration read back. An app
 * release is not needed to change either.
 */
export default function About() {
  const { branding } = useBranding();
  const text = branding.aboutText?.trim();

  const [me, setMe] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const answer = await authApi.me();
        if (!cancelled) setMe(answer);
      } catch {
        /* The words above are the point of the screen and are already
           on the device; what the role grants is worth showing when it
           can be fetched and not worth an error when it cannot. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <BrandLogo size={48} />
        <Text style={styles.org}>{branding.organisationName}</Text>
      </View>

      {text ? (
        <Text style={styles.body}>{text}</Text>
      ) : (
        <Text style={styles.none}>
          Nothing has been published here yet. The scheme's administrator can set this text
          from the portal.
        </Text>
      )}

      {me ? (
        <Card style={styles.card}>
          <Text style={styles.section}>What this role lets you do</Text>
          <Text style={styles.lead}>
            Granted by the Super Admin against your role. Ask your implementing agency if
            something you need is not here.
          </Text>

          {me.permissions.length === 0 ? (
            <Text style={styles.none}>Nothing is granted on this role yet.</Text>
          ) : (
            me.permissions.map((key) => (
              <View key={key} style={styles.grant}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success700} />
                <View style={styles.grantText}>
                  <Text style={styles.grantWords}>{PERMISSION_WORDS[key] ?? key}</Text>
                  <Text style={styles.grantKey}>{key}</Text>
                </View>
              </View>
            ))
          )}
        </Card>
      ) : null}

      <Text style={styles.footnote}>{branding.portalTitle}</Text>
    </ScrollView>
  );
}

/**
 * What a permission key means to somebody who did not write it.
 *
 * The keys are the vocabulary the API and the portal share; nobody signing
 * in on a phone should have to read "programs.manage" and work out what it
 * lets them do. Anything unrecognised is shown as it is rather than hidden:
 * a key added later is still something this account holds.
 */
const PERMISSION_WORDS: Record<string, string> = {
  'programs.view': 'See the programs assigned to you',
  'programs.manage': 'Record a program: venue, sessions, attendance and marks',
  'programs.create': 'Raise a new program',
  'programs.approve': 'Permit or postpone a program',
  'programs.qc': "Quality check a conducted program's report",
  'trainers.view': 'See the faculty register',
  'trainers.manage': 'Put a trainer on the record',
  'materials.view': 'Open the training material published to you',
  'coordinators.view': 'See coordinators',
  'applications.view': 'See applications',
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  hero: { alignItems: 'center', gap: spacing.sm },
  org: { fontSize: font.sm, color: colors.ink600, textAlign: 'center' },

  /* The administrator types paragraphs; they are kept as typed rather
     than run together into one block. */
  body: { fontSize: font.base, color: colors.ink800, lineHeight: 23 },
  none: { fontSize: font.sm, color: colors.ink500, fontStyle: 'italic', lineHeight: 20 },

  card: { gap: spacing.sm },
  section: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  lead: { fontSize: font.sm, color: colors.ink600, lineHeight: 18 },

  grant: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 5 },
  grantText: { flex: 1, gap: 1 },
  grantWords: { fontSize: font.sm, color: colors.ink900, lineHeight: 18 },
  grantKey: { fontSize: font.xs, color: colors.ink400, letterSpacing: 0.3 },

  footnote: { textAlign: 'center', color: colors.ink500, fontSize: font.xs },
});
