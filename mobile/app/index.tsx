import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/auth/AuthContext';
import { BrandLogo, useBranding } from '../src/branding/BrandingContext';
import { colors, font, spacing } from '../src/theme';

/** Decides where to land once the stored session has been read. */
export default function Index() {
  const { loading, applicant } = useAuth();
  const { branding } = useBranding();

  if (loading) {
    return (
      <View style={styles.splash}>
        <BrandLogo size={58} />
        <Text style={styles.org}>{branding.organisationName}</Text>
        <ActivityIndicator color={colors.brand700} style={styles.spinner} />
      </View>
    );
  }

  /* The dashboard. It carries who they are, the quick tiles, and the
     programs open to them; where none are open yet it says so and offers
     the sub-category to start a profile in, so it is the right first
     screen for somebody who signed up a minute ago as well as for
     somebody halfway through a batch. */
  return <Redirect href={applicant ? '/(tabs)/programs' : '/(auth)/sign-in'} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blush,
    gap: spacing.xs,
  },
  org: { fontSize: font.sm, color: colors.ink600, marginTop: spacing.sm, textAlign: 'center' },
  spinner: { marginTop: spacing.lg },
});
