import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        /* The same crimson as the primary button, so the bar at the top and
           the action at the bottom read as one product rather than two. */
        headerStyle: { backgroundColor: colors.brand600 },
        headerTintColor: colors.white,
        headerTitleStyle: { color: colors.white, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.page },
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
      <Stack.Screen name="verify" options={{ title: 'Verify email' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="reset-password" options={{ title: 'Reset password' }} />
      {/* No way back: the account exists by now, and returning to the code
          screen would only offer a code that has already been spent. */}
      <Stack.Screen
        name="registered"
        options={{ title: 'Registration complete', headerBackVisible: false, gestureEnabled: false }}
      />
    </Stack>
  );
}
