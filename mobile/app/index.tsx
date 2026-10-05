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

  /* Applications, not Programs. Nothing is open to an applicant until the
     profile for a discipline has been accepted, so landing on the list of
     programmes showed an empty screen to everybody who had just signed up.
     Applications is where they choose a category and fill the form, which
     is the next thing they have to do. */
  return <Redirect href={applicant ? '/(tabs)/applications' : '/(auth)/sign-in'} />;
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
