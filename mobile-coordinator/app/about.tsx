import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandLogo, useBranding } from '../src/branding/BrandingContext';
import { colors, font, spacing } from '../src/theme';

/**
 * What this is.
 *
 * Its own item in the menu rather than a card at the bottom of Support,
 * where it was something you found while looking for a telephone
 * number. The words are not written here: they are set by the Super
 * Admin in the portal and served with the branding, so the scheme can
 * say what it is in its own words without an app release.
 */
export default function About() {
  const { branding } = useBranding();
  const text = branding.aboutText?.trim();

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

      <Text style={styles.footnote}>{branding.portalTitle}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  hero: { alignItems: 'center', gap: spacing.sm },
  org: { fontSize: font.sm, color: colors.ink600, textAlign: 'center' },

  /* The administrator types paragraphs; they are kept as typed rather
     than run together into one block. */
  body: { fontSize: font.base, color: colors.ink800, lineHeight: 23 },
  none: { fontSize: font.sm, color: colors.ink500, fontStyle: 'italic', lineHeight: 20 },

  footnote: { textAlign: 'center', color: colors.ink500, fontSize: font.xs },
});
