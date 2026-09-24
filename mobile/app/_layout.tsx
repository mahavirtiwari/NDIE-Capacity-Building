import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth/AuthContext';
import { BrandingProvider } from '../src/branding/BrandingContext';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BrandingProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.brand900 },
              headerTintColor: colors.white,
              headerTitleStyle: { fontWeight: '600' },
              contentStyle: { backgroundColor: colors.page },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="apply/[programTypeId]"
              options={{ title: 'Apply', presentation: 'card' }}
            />
            <Stack.Screen name="application/[id]" options={{ title: 'Application' }} />
          </Stack>
        </AuthProvider>
      </BrandingProvider>
    </SafeAreaProvider>
  );
}
