import { Stack, useLocalSearchParams } from 'expo-router';
import { WorkshopProvider } from '../../../src/workshop/WorkshopContext';
import { colors } from '../../../src/theme';

/**
 * Everything under one workshop. The provider sits here rather than in the tab
 * layout so the capture screens pushed on top share the same loaded record.
 */
export default function WorkshopLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <WorkshopProvider id={Number(id)}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.blush },
          headerTintColor: colors.brand700,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.page },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="venue" options={{ title: 'Register venue' }} />
        <Stack.Screen name="trainer" options={{ title: 'Register trainer' }} />
        <Stack.Screen name="session" options={{ title: 'Session management' }} />
        <Stack.Screen name="participant" options={{ title: 'On-spot registration' }} />
        <Stack.Screen name="participant-photo" options={{ title: 'Participant photo' }} />
        <Stack.Screen name="attendance" options={{ title: 'Programme attendance' }} />
        <Stack.Screen name="attendance-photo" options={{ title: 'Attendance photo' }} />
        <Stack.Screen name="feedback" options={{ title: 'Participant feedback' }} />
        <Stack.Screen name="marksheet" options={{ title: 'Trainer marksheet' }} />
      </Stack>
    </WorkshopProvider>
  );
}
