import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { BrandingProvider } from '../src/branding/BrandingContext';
import { Loading } from '../src/components/ui';
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
              {/* Light, because every bar in the app is now the dark brand
                  crimson and dark-on-dark cannot be read. */}
              <StatusBar style="light" />
              <Routes />
            </AuthProvider>
          </SiteTextProvider>
        </BrandingProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}

/**
 * The navigator, held back until the stored session has been read.
 *
 * Screens outside the tab group — a payment, an application, an exam — are
 * reached by a link as well as by tapping through, and a link can arrive at a
 * cold start. Mounting one before the token has been restored sends its first
 * request without the token, and the applicant is told their session has
 * expired at the very moment they return from paying.
 *
 * The tab group gated on this already. Everything else did not, because
 * nothing used to link straight into it.
 */
function Routes() {
  const { loading } = useAuth();

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <OfflineNotice />
      <Stack
        screenOptions={{
          /* The crimson of the primary button, carried across every bar in
             the app so the top of a screen and the action at the bottom of
             it belong to the same thing. */
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
        <Stack.Screen name="exam/index" options={{ title: 'Examinations' }} />
        <Stack.Screen name="exam/[participantId]" options={{ title: 'Examination' }} />
        {/* No back arrow: a paper is left through the submit button or the
            warning behind the hardware key, not by drifting out of it. */}
        <Stack.Screen
          name="exam/sitting/[attemptId]"
          options={{ title: 'Examination', headerBackVisible: false, gestureEnabled: false }}
        />
      </Stack>
    </View>
  );
}
