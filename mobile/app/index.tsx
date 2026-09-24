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
        <ActivityIndicator color={colors.white} style={styles.spinner} />
      </View>
    );
  }

  return <Redirect href={applicant ? '/(tabs)/programs' : '/(auth)/sign-in'} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand900,
    gap: spacing.xs,
  },
  org: { fontSize: font.sm, color: colors.onBrandMuted, marginTop: spacing.sm, textAlign: 'center' },
  spinner: { marginTop: spacing.lg },
});
