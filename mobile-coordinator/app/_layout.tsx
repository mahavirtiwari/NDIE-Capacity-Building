import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { BrandingProvider } from '../src/branding/BrandingContext';
import { MenuProvider } from '../src/components/SideMenu';
import { SiteTextProvider } from '../src/content/SiteTextContext';
import { NetworkProvider } from '../src/offline/NetworkContext';
import { OutboxNotice } from '../src/offline/OutboxNotice';
import { InstallGate } from '../src/permissions/InstallGate';
import { NotificationBell } from '../src/notifications/NotificationBell';
import { listenForNotificationTaps } from '../src/notifications/push';
import { colors } from '../src/theme';

/**
 * Sends anybody without a session back to the sign-in screen.
 *
 * Signing out cleared the session and nothing else, so the screen that was
 * open stayed open - a coordinator pressed Sign out and sat looking at
 * their programs, signed out, with no way to tell. The same happens on its
 * own when a token expires or an account is disabled from the portal: the
 * API client drops the session, and without this the app would carry on
 * showing whatever had already been fetched.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { session, restoring } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  /* A tap has to go somewhere, and the router only exists once this is
     mounted. Registered once; the listener guards against a second. */
  useEffect(() => {
    listenForNotificationTaps();
  }, []);

  useEffect(() => {
    if (restoring) return;

    const onSignIn = segments[0] === '(auth)';
    if (!session && !onSignIn) router.replace('/(auth)/sign-in');
  }, [session, restoring, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <BrandingProvider>
          <SiteTextProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            {/* Nothing is reachable until the phone has given the app what
                it is made of: the camera, the location, notifications and
                room for a day of photographs. */}
            <InstallGate>
            <AuthGate>
            {/* One menu for the whole app, mounted here so every screen
                opens the same panel. */}
            <MenuProvider>
            <View style={{ flex: 1 }}>
              <OutboxNotice />
              <Stack
          screenOptions={{
            /* Dark, like the applicant app's: a pale header on a pale
               page gave the screen no top edge at all outdoors. */
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '700', color: colors.white },
            headerRight: () => <NotificationBell />,
            contentStyle: { backgroundColor: colors.page },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          {/* The four tabs bring their own header and their own menu
              button, so the stack must not draw a second one above. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
          <Stack.Screen name="support" options={{ title: 'Support' }} />
          <Stack.Screen name="about" options={{ title: 'About' }} />
          <Stack.Screen name="unsent" options={{ title: 'Unsent work' }} />
          <Stack.Screen name="workshop/[id]" options={{ headerShown: false }} />
              </Stack>
            </View>
            </MenuProvider>
            </AuthGate>
            </InstallGate>
          </AuthProvider>
          </SiteTextProvider>
        </BrandingProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
