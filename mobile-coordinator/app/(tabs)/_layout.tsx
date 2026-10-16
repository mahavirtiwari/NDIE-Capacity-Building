import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { MenuButton } from '../../src/components/SideMenu';
import { NotificationBell } from '../../src/notifications/NotificationBell';
import { colors } from '../../src/theme';

/**
 * The four places this app goes, along the bottom.
 *
 * The same shape as the applicant app, and for the same reason: the four
 * things a coordinator opens the app for are one tap apart rather than
 * behind a hamburger that has to be learned. The menu stays for the rest
 * — changing a password, unsent work, support — which is what a menu is
 * for.
 *
 * The bar at the top carries the brand colour rather than the blush it
 * had, so the header reads as a header from across a room and in
 * sunlight, which is where this app is used.
 */
export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand700 },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700', color: colors.white },
          headerLeft: () => <MenuButton />,
          headerRight: () => <NotificationBell />,
          tabBarActiveTintColor: colors.brand700,
          tabBarInactiveTintColor: colors.ink500,
          tabBarStyle: { backgroundColor: colors.blush, borderTopColor: colors.brand100 },
          tabBarLabelStyle: { fontSize: 11 },
          sceneStyle: { backgroundColor: colors.page },
        }}
      >
        <Tabs.Screen
          name="programs"
          options={{
            title: 'Programs',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="materials"
          options={{
            title: 'Material',
            tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            /* The bell is in the header too, and on purpose: the header
               one carries the unread count onto every screen, this one
               is how somebody who is not looking for a count gets here. */
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
