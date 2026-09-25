import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, spacing } from '../theme';
import { useNetwork } from './NetworkContext';

/**
 * A bar across the top when there is no connection.
 *
 * It says what the reader can act on: the app is still working, and what is on
 * screen came from the last time it could reach the server. Saying only
 * "offline" leaves them wondering whether what they are reading is current.
 */
export function OfflineNotice({ pending }: { pending?: number }) {
  const { online } = useNetwork();
  /* The bar sits above the navigator, so when it is showing it owns the
     status bar inset that the screen header would otherwise take. */
  const insets = useSafeAreaInsets();

  if (online && !pending) return null;

  const message = !online
    ? pending
      ? `Offline. ${pending} ${pending === 1 ? 'change' : 'changes'} will be sent when you are back.`
      : 'Offline. Showing what was saved the last time you had a connection.'
    : `Sending ${pending} saved ${pending === 1 ? 'change' : 'changes'}...`;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }, online && styles.syncing]}>
      <Ionicons
        name={online ? 'cloud-upload-outline' : 'cloud-offline-outline'}
        size={15}
        color={colors.white}
      />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.ink700,
  },
  syncing: { backgroundColor: colors.success700 },
  text: { flex: 1, color: colors.white, fontSize: font.xs },
});
