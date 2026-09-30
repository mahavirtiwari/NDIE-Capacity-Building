import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { MenuButton, SideMenu } from '../../src/components/SideMenu';
import { Loading } from '../../src/components/ui';
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
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.ink500,
        tabBarStyle: { backgroundColor: colors.blush, borderTopColor: colors.brand100 },
        sceneStyle: { backgroundColor: colors.page },
      }}
    >
      <Tabs.Screen
        name="programs"
        options={{
          title: 'Programs',
          tabBarIcon: ({ color, size }) => <Ionicons name="layers" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="batches"
        options={{
          title: 'Batches',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
          tabBarIcon: ({ color, size }) => <Ionicons name="documents" size={size} color={color} />,
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
