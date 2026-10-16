import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { colors, spacing } from '../../../../src/theme';

/**
 * The way back to the list of programmes.
 *
 * A tab layout draws its own header and does not inherit the stack's
 * back arrow, so these four screens were the only ones in the app with
 * no way out of them except the handset's own back key - which on a
 * phone with gesture navigation is not a button anybody can see.
 */
function BackToPrograms() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to programs"
      hitSlop={10}
      style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/programs'))}
    >
      <Ionicons name="arrow-back" size={22} color={colors.white} />
    </Pressable>
  );
}

/**
 * The four tabs the monitoring manual defines: Registration, Programme
 * Management, Final Submission and Exit.
 */
export default function WorkshopTabs() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand700 },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700', color: colors.white },
        headerLeft: () => <BackToPrograms />,
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.ink500,
        tabBarStyle: { backgroundColor: colors.blush, borderTopColor: colors.brand100 },
        tabBarLabelStyle: { fontSize: 11 },
        sceneStyle: { backgroundColor: colors.page },
      }}
    >
      <Tabs.Screen
        name="registration"
        options={{
          title: 'Registration',
          tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="programme"
        options={{
          title: 'Program',
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: 'Submission',
          tabBarIcon: ({ color, size }) => <Ionicons name="lock-closed-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="exit"
        options={{
          title: 'Exit',
          tabBarIcon: ({ color, size }) => <Ionicons name="exit-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
