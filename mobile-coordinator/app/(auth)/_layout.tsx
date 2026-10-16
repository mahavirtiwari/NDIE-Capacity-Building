import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

/**
 * The same shape as the applicant app's: a dark bar with a back arrow on
 * everything except the sign-in screen, which is the way in and has
 * nowhere behind it. The coordinator app hid the header everywhere, so
 * anything reached from sign-in had to carry its own way back written
 * into the page.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand700 },
        headerTintColor: colors.white,
        headerTitleStyle: { color: colors.white, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.page },
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
    </Stack>
  );
}
