import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth/AuthContext';
import { BrandingProvider } from '../src/branding/BrandingContext';
import { NetworkProvider } from '../src/offline/NetworkContext';
import { OfflineNotice } from '../src/offline/OfflineNotice';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <BrandingProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <View style={{ flex: 1 }}>
            <OfflineNotice />
            <Stack
            screenOptions={{
              /* Light bar, brand in the text and the icons, as the portal
                 does it. A dark header on a light app reads as a different
                 product on the same phone. */
              headerStyle: { backgroundColor: colors.blush },
              headerTintColor: colors.brand700,
              headerTitleStyle: { fontWeight: '600', color: colors.ink900 },
              contentStyle: { backgroundColor: colors.blush },
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
          </View>
        </AuthProvider>
        </BrandingProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
