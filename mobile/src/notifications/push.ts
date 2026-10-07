import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { me } from '../api/endpoints';

/**
 * How a notification behaves while the app is open.
 *
 * Shown rather than swallowed: a programme opening while somebody is on
 * the dashboard is the same news as one arriving while the phone is in a
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

let lastToken: string | null = null;

/**
 * Tells the server where this handset can be reached.
 *
 * Called when a session appears, because the token belongs to whoever is
 * signed in: the same phone handed to somebody else must stop receiving
 * the first person's notices. A simulator has no push token and says so
 * quietly — there is nothing for the applicant to do about it, and an
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
    await me.registerDevice({ token, platform: Platform.OS, app: 'applicant' });
  } catch {
    /* No push for this handset today. The notifications list still works,
       because it is fetched rather than pushed. */
  }
}

/** Signing out: this account's notices stop coming to this handset. */
export async function retirePush(): Promise<void> {
  try {
    if (!lastToken) return;
    await me.retireDevice(lastToken);
    lastToken = null;
  } catch {
    /* Signed out either way. */
  }
}
