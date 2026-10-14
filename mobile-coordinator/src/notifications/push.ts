import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { notices } from '../api/endpoints';

/**
 * How a notification behaves while the app is open.
 *
 * Shown rather than swallowed: a batch being permitted while somebody is
 * in the app is the same news as one arriving while the phone is in a
 * pocket.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Where a tapped notification takes somebody.
 *
 * Nothing was listening, so the tap fell through to the operating
 * system, which opened the app at its bare scheme and the router had
 * nothing to match - an Unmatched Route screen in place of the news that
 * had just arrived.
 *
 * A notice that names a screen opens it; one that does not opens the
 * list, which is where every notice can be read.
 */
let listening: Notifications.EventSubscription | null = null;

export function listenForNotificationTaps(): void {
  if (listening) return;

  const go = (response: Notifications.NotificationResponse) => {
    const held = response.notification.request.content.data as { link?: unknown } | null;
    const link = typeof held?.link === 'string' ? held.link.trim() : '';

    /* Only a path inside the app: a notice is written by the server and
       read by a handset, and a link that could send somebody anywhere at
       all is not one this should follow. */
    const inside = link.startsWith('/') && !link.startsWith('//');

    router.push(inside ? (link as never) : '/notifications');
  };

  /* The tap that started the app, before this was listening. Android
     delivers it this way rather than through the subscription. */
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) go(response);
  });

  listening = Notifications.addNotificationResponseReceivedListener(go);
}

let lastToken: string | null = null;

/**
 * Tells the server where this handset can be reached.
 *
 * Called when a session appears, because the token belongs to whoever is
 * signed in: a handset passed to another coordinator must stop receiving
 * the first one's notices. A simulator has no push token and says so
 * quietly — there is nothing for the coordinator to do about it, and an
 * error about it would be the first thing they saw after signing in.
 */
export async function registerForPush(): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;

    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Scheme notices',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#82232f',
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )).data;

    lastToken = token;
    await notices.registerDevice({ token, platform: Platform.OS, app: 'coordinator' });
  } catch {
    /* No push for this handset today. The notifications list still works,
       because it is fetched rather than pushed. */
  }
}

/** Signing out: this account's notices stop coming to this handset. */
export async function retirePush(): Promise<void> {
  try {
    if (!lastToken) return;
    await notices.retireDevice(lastToken);
    lastToken = null;
  } catch {
    /* Signed out either way. */
  }
}
