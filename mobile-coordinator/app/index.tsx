import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../src/auth/AuthContext';
import { colors } from '../src/theme';

/**
 * The only job of the entry route is to wait for the stored session to be read
 * and then send the coordinator to the right place. Deciding this before the
 * read finishes would flash the sign-in screen at someone already signed in.
 */
export default function Entry() {
  const { session, restoring } = useAuth();

  if (restoring) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.brand600} />
      </View>
    );
  }

  return <Redirect href={session ? '/workshops' : '/(auth)/sign-in'} />;
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush },
});
