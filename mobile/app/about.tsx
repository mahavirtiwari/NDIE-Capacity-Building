import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
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
        <BrandLogo size={66} />
        <Text style={styles.org}>{branding.organisationName}</Text>
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

      {branding.supportEmail || branding.supportUrl ? (
        <Card style={styles.card}>
          <Text style={styles.heading}>Getting help</Text>
          {branding.supportUrl ? (
            <Row
              icon="globe-outline"
              label="Contact us"
              value={branding.supportUrl}
              onPress={() => void Linking.openURL(branding.supportUrl!)}
            />
          ) : null}
          {branding.supportEmail ? (
            <Row
              icon="mail-outline"
              label="Email"
              value={branding.supportEmail}
              onPress={() => void Linking.openURL(`mailto:${branding.supportEmail}`)}
            />
          ) : null}
        </Card>
      ) : null}

      <Text style={styles.version}>{`Version ${version}`}</Text>
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Text style={styles.row} onPress={onPress} accessibilityRole="link">
      <Ionicons name={icon} size={14} color={colors.brand700} /> {label}:{' '}
      <Text style={styles.link}>{value}</Text>
    </Text>
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
  org: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.ink900,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  title: { fontSize: font.sm, color: colors.ink600, textAlign: 'center' },

  card: { gap: spacing.sm },
  heading: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  body: { fontSize: font.sm, color: colors.ink700, lineHeight: 21 },
  row: { fontSize: font.sm, color: colors.ink700, lineHeight: 22 },
  link: { color: colors.brand700, fontWeight: '600' },

  version: { fontSize: font.xs, color: colors.ink500, textAlign: 'center' },
});
