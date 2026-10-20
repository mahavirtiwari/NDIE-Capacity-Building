import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandLogo, useBranding } from '../src/branding/BrandingContext';
import { Card } from '../src/components/ui';
import { colors, font, radius, spacing } from '../src/theme';

/**
 * What this system is, in the department's own words.
 *
 * Nothing on this screen is written here. The paragraphs, the support
 * link and the mark all come off the branding record, which is the Super
 * Admin's to maintain — so a department that rewords what the system is
 * for does not need a new build to say it.
 */
export default function About() {
  const { branding } = useBranding();

  const paragraphs = (branding.aboutText ?? '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'About' }} />

      <View style={styles.hero}>
        {/* The mark carries the organisation's name already; printing it
            again underneath was the same words twice. */}
        <BrandLogo size={66} />
        {branding.portalTitle ? <Text style={styles.title}>{branding.portalTitle}</Text> : null}
      </View>

      {paragraphs.length > 0 ? (
        <Card style={styles.card}>
          {paragraphs.map((paragraph, index) => (
            <Text key={index} style={styles.body}>
              {paragraph}
            </Text>
          ))}
        </Card>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.body}>
            {`${branding.organisationName} runs its training and certification through this `
              + 'app: the programs on offer, the profile you fill in once for a discipline, '
              + 'the batches you register for, the examination, and the certificate '
              + 'afterwards.'}
          </Text>
        </Card>
      )}

      <Text style={styles.version}>{`Version ${version}`}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: font.sm, color: colors.ink600, textAlign: 'center' },

  card: { gap: spacing.sm },
  body: { fontSize: font.sm, color: colors.ink700, lineHeight: 21 },

  version: { fontSize: font.xs, color: colors.ink500, textAlign: 'center' },
});
