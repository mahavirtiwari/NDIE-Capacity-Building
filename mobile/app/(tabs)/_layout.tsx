import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { MenuButton, SideMenu } from '../../src/components/SideMenu';
import { Loading } from '../../src/components/ui';
import { NotificationBell } from '../../src/notifications/NotificationBell';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  const { loading, applicant } = useAuth();
  const [menu, setMenu] = useState(false);

  if (loading) return <Loading />;
  if (!applicant) return <Redirect href="/(auth)/sign-in" />;

  return (
    <View style={{ flex: 1 }}>
    <SideMenu open={menu} onClose={() => setMenu(false)} />
    <Tabs
      screenOptions={{
        /* The bar at the top carries the same crimson as the primary button,
           and the menu behind the hamburger reaches everything the five tabs
           along the bottom cannot. */
        headerStyle: { backgroundColor: colors.brand700 },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700', color: colors.white },
        headerLeft: () => <MenuButton onPress={() => setMenu(true)} />,
        headerRight: () => <NotificationBell />,
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.ink500,
        tabBarStyle: { backgroundColor: colors.blush, borderTopColor: colors.brand100 },
        sceneStyle: { backgroundColor: colors.page },
      }}
    >
      {/* The dashboard first, because it is where the app lands. It holds
          the identity panel, the quick tiles and the programs open to
          them, and it is the screen that tells a new applicant to choose
          a sub-category and fill in a profile. */}
      <Tabs.Screen
        name="programs"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
          tabBarIcon: ({ color, size }) => <Ionicons name="documents" size={size} color={color} />,
        }}
      />
      {/* "Programs": the dated ones, which is what an applicant registers
          for. The tracks they are open to are on the dashboard. */}
      <Tabs.Screen
        name="batches"
        options={{
          title: 'Programs',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
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
    </Tabs>
    </View>
  );
}
