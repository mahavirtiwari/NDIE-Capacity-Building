import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '../../../../src/theme';

/**
 * The four tabs the monitoring manual defines: Registration, Programme
 * Management, Final Submission and Exit.
 */
export default function WorkshopTabs() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand700 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.ink500,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.ink200 },
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
          title: 'Programme',
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
