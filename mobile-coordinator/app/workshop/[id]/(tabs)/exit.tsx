import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../../../../src/auth/AuthContext';
import { Button, Card } from '../../../../src/components/ui';
import { colors, spacing } from '../../../../src/theme';

/**
 * Tab 4: leave the workshop, or sign out entirely.
 *
 * Two separate doors on purpose. A coordinator running several workshops in a
 * day wants to step back to the list without losing their session, and only
 * rarely wants to hand the device over signed out.
 */
export default function Exit() {
  const router = useRouter();
  const { signOut } = useAuth();

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need your user ID and password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.lead}>
          Everything you have recorded is already saved on the server. Leaving does not
          discard anything.
        </Text>
        <Button label="Back to my workshops" onPress={() => router.replace('/workshops')} />
        <Button label="Sign out" onPress={confirmSignOut} variant="ghost" />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
  lead: { color: colors.ink600, fontSize: 13, lineHeight: 19 },
});
