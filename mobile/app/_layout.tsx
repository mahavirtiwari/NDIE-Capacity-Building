import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth/AuthContext';
import { BrandingProvider } from '../src/branding/BrandingContext';
import { SiteTextProvider } from '../src/content/SiteTextContext';
import { NetworkProvider } from '../src/offline/NetworkContext';
import { OfflineNotice } from '../src/offline/OfflineNotice';
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
            <OfflineNotice />
            <Stack
            screenOptions={{
              /* The crimson of the primary button, carried across every bar
                 in the app so the top of a screen and the action at the
                 bottom of it belong to the same thing. */
              headerStyle: { backgroundColor: colors.brand700 },
              headerTintColor: colors.white,
              headerTitleStyle: { fontWeight: '700', color: colors.white },
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
            <Stack.Screen name="payments" options={{ title: 'Payments' }} />
            <Stack.Screen name="payment/[applicationId]" options={{ title: 'Pay fee' }} />
            {/* No back arrow: behind it is the summary that opens a second
                attempt, and a payer looking at a result should not be one tap
                from paying again. */}
            <Stack.Screen
              name="payment/status/[orderId]"
              options={{ title: 'Payment', headerBackVisible: false, gestureEnabled: false }}
            />
            <Stack.Screen name="exam/[participantId]" options={{ title: 'Examination' }} />
            {/* No back arrow: a paper is left through the submit button or the
                warning behind the hardware key, not by drifting out of it. */}
            <Stack.Screen
              name="exam/sitting/[attemptId]"
              options={{ title: 'Examination', headerBackVisible: false, gestureEnabled: false }}
            />
            </Stack>
          </View>
        </AuthProvider>
        </SiteTextProvider>
        </BrandingProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
