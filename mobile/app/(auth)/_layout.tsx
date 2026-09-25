import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.blush },
        headerTintColor: colors.brand700,
        contentStyle: { backgroundColor: colors.page },
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
      <Stack.Screen name="verify" options={{ title: 'Verify email' }} />
    </Stack>
  );
}
