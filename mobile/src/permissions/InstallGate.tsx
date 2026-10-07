import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Loading, Muted, Title } from '../components/ui';
import { colors, font, radius, spacing } from '../theme';

/** A form with photographs on it needs somewhere to put them. */
const SPACE_NEEDED = 500 * 1024 * 1024;

type Standing = 'granted' | 'ask' | 'refused';

interface Need {
  key: string;
  label: string;
  why: string;
  icon: keyof typeof Ionicons.glyphMap;
  standing: Standing;
}

/**
 * What the app is given before it is used.
 *
 * The camera takes the photographs the profile and the examination are
 * made of, the location stamps where a thing was done, and notifications
 * are how somebody is told a programme has opened. Asking for each one at
 * the moment it is first needed sounds kinder and works out worse: the
 * request arrives in the middle of a form, a refusal there is permanent
 * until somebody finds it in the settings, and the applicant is left with
 * a screen that quietly does nothing.
 *
 * So they are asked for together, at the start, with the reason beside
 * each. A refusal is recoverable from this screen rather than from the
 * depths of Android settings.
 */
export function InstallGate({ children }: { children: ReactNode }) {
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);

  const check = useCallback(async (request: boolean) => {
    setAsking(true);
    try {
      const found: Need[] = [
        {
          key: 'notifications',
          label: 'Notifications',
          why: 'So you are told when a programme opens, a profile is decided, or an examination is set.',
          icon: 'notifications-outline',
          standing: await standingOf(
            () => Notifications.getPermissionsAsync(),
            () => Notifications.requestPermissionsAsync(),
            request,
          ),
        },
        {
          key: 'camera',
          label: 'Camera',
          why: 'Your photograph on the profile form, and the picture taken at the start of an examination.',
          icon: 'camera-outline',
          standing: await standingOf(
            () => ImagePicker.getCameraPermissionsAsync(),
            () => ImagePicker.requestCameraPermissionsAsync(),
            request,
          ),
        },
        {
          key: 'media',
          label: 'Photos and media',
          why: 'To attach a document you already hold, and to keep what you download.',
          icon: 'images-outline',
          standing: await standingOf(
            () => ImagePicker.getMediaLibraryPermissionsAsync(),
            () => ImagePicker.requestMediaLibraryPermissionsAsync(),
            request,
          ),
        },
        {
          key: 'location',
          label: 'Location',
          why: 'To show the programmes near you and to stamp where an examination was sat.',
          icon: 'location-outline',
          standing: await standingOf(
            () => Location.getForegroundPermissionsAsync(),
            () => Location.requestForegroundPermissionsAsync(),
            request,
          ),
        },
      ];

      setNeeds(found);
      setFreeBytes(await freeSpace());
    } finally {
      setAsking(false);
    }
  }, []);

  useEffect(() => {
    /* The web build has none of this, and nothing to ask for. */
    if (Platform.OS === 'web') {
      setNeeds([]);
      setFreeBytes(Number.MAX_SAFE_INTEGER);
      return;
    }
    void check(true);
  }, [check]);

  if (needs === null) return <Loading label="Getting ready…" />;

  const missing = needs.filter((need) => need.standing !== 'granted');
  const cramped = freeBytes !== null && freeBytes < SPACE_NEEDED;
  if (missing.length === 0 && !cramped) return <>{children}</>;

  const refused = missing.some((need) => need.standing === 'refused');

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Title>Before you start</Title>
      <Muted>
        {cramped && missing.length === 0
          ? 'There is not enough room on this phone to fill in a form safely.'
          : 'This app needs a few things from your phone to work at all.'}
      </Muted>

      {missing.length > 0 ? (
        <Card style={styles.card}>
          {missing.map((need) => (
            <View key={need.key} style={styles.need}>
              <View style={styles.needIcon}>
                <Ionicons name={need.icon} size={18} color={colors.brand700} />
              </View>
              <View style={styles.needBody}>
                <Text style={styles.needLabel}>{need.label}</Text>
                <Text style={styles.needWhy}>{need.why}</Text>
                {need.standing === 'refused' ? (
                  <Text style={styles.needRefused}>
                    Turned down. It can only be switched back on in the phone&apos;s settings.
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {cramped ? (
        <Card style={styles.card}>
          <View style={styles.need}>
            <View style={styles.needIcon}>
              <Ionicons name="save-outline" size={18} color={colors.brand700} />
            </View>
            <View style={styles.needBody}>
              <Text style={styles.needLabel}>Free space</Text>
              <Text style={styles.needWhy}>
                {`At least ${readable(SPACE_NEEDED)} has to be free. There is `
                  + `${readable(freeBytes ?? 0)} left on this phone. Clear some room and try again `
                  + '— a form with photographs on it has nowhere to put them otherwise.'}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Button
        label={asking ? 'Checking…' : 'Try again'}
        onPress={() => void check(true)}
        disabled={asking}
      />

      {refused ? (
        <Button
          label="Open phone settings"
          variant="secondary"
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
    </ScrollView>
  );
}

/**
 * Where one permission stands, asking for it where that is still possible.
 *
 * "Refused" is kept apart from "not asked yet" because they need different
 * things from the reader: one is a button on this screen, the other is a
 * trip to the settings.
 */
async function standingOf(
  read: () => Promise<{ granted: boolean; canAskAgain?: boolean }>,
  ask: () => Promise<{ granted: boolean; canAskAgain?: boolean }>,
  request: boolean,
): Promise<Standing> {
  try {
    let answer = await read();
    if (!answer.granted && request && answer.canAskAgain !== false) answer = await ask();
    if (answer.granted) return 'granted';
    return answer.canAskAgain === false ? 'refused' : 'ask';
  } catch {
    /* A platform without it, or a module that is not there. Not a reason
       to hold the whole app shut. */
    return 'granted';
  }
}

async function freeSpace(): Promise<number | null> {
  try {
    return await FileSystem.getFreeDiskStorageAsync();
  } catch {
    return null;
  }
}

function readable(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  need: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  needIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needBody: { flex: 1, gap: 2 },
  needLabel: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  needWhy: { fontSize: font.sm, color: colors.ink600, lineHeight: 19 },
  needRefused: { fontSize: font.sm, color: colors.danger700, marginTop: 2 },
});
