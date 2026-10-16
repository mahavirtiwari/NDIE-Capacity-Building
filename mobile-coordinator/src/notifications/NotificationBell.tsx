import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { current, refresh, subscribe } from './inbox';
import { colors, font, spacing } from '../theme';

/**
 * The way into the notifications, with what has not been read on it.
 *
 * The count is fetched when the screen behind it comes back into focus
 * rather than on a timer: a badge that polls all day costs battery to
 * tell somebody something they will see the moment they look.
 */
export function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(() => current().unread);

  useEffect(() => subscribe((next) => setUnread(next.unread)), []);

  /* Asks the shared inbox rather than the server. On the notifications
     screen this is the same refresh the list is already doing, and it
     joins that one instead of racing it. */
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, []),
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      hitSlop={10}
      style={styles.button}
      onPress={() => router.push('/(tabs)/notifications')}
    >
      {/* White, like the hamburger beside it: the header is dark. */}
      <Ionicons name="notifications-outline" size={22} color={colors.white} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  badge: {
    position: 'absolute',
    top: 0,
    right: spacing.sm,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    /* A count has to be legible against the header it sits on, and the
       header is the brand colour now. */
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: font.xs, fontWeight: '700', color: colors.brand700 },
});
