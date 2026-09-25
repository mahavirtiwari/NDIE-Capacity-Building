import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth/AuthContext';
import { BrandingProvider } from '../src/branding/BrandingContext';
import { SiteTextProvider } from '../src/content/SiteTextContext';
import { NetworkProvider } from '../src/offline/NetworkContext';
import { OutboxNotice } from '../src/offline/OutboxNotice';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <BrandingProvider>
          <SiteTextProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <View style={{ flex: 1 }}>
              <OutboxNotice />
              <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.blush },
            headerTintColor: colors.brand700,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.page },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="workshops" options={{ title: 'My workshops' }} />
          <Stack.Screen name="workshop/[id]" options={{ headerShown: false }} />
              </Stack>
            </View>
          </AuthProvider>
          </SiteTextProvider>
        </BrandingProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
