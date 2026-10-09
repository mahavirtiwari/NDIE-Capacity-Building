import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

/**
 * What the handset knew when a photograph was taken.
 *
 * Sent up beside the image so the server can draw the time and place into
 * the picture and keep them beside it. Every part is optional and the
 * whole thing is best-effort: an applicant standing inside a building
 * with location switched off still has a certificate to photograph, and
 * refusing the photograph to gain a coordinate would be the wrong trade.
 */
export interface CaptureFacts {
  capturedOn: string;
  latitude?: number;
  longitude?: number;
  platform?: string;
  model?: string;
  osVersion?: string;
}

/**
 * Asks the phone where and what it is.
 *
 * Never throws and never blocks for long. A fix is asked for at balanced
 * accuracy — a few metres, which is what the stamp needs — and abandoned
 * after a few seconds, because a camera field that hangs waiting for GPS
 * indoors is a camera field nobody can use.
 */
export async function captureFacts(): Promise<CaptureFacts> {
  const facts: CaptureFacts = {
    capturedOn: new Date().toISOString(),
    platform: Platform.OS,
    model: Device.modelName ?? undefined,
    osVersion: Device.osVersion ?? undefined,
  };

  try {
    /* Only if it has already been granted. The install gate asks for
       location once, up front; asking again from inside a form would put
       a system dialog over the camera the applicant just used. */
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return facts;

    const fix = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      6000,
    );

    if (fix) {
      facts.latitude = fix.coords.latitude;
      facts.longitude = fix.coords.longitude;
    }
  } catch {
    /* No fix, no permission, no location services. The picture still goes. */
  }

  return facts;
}

/** Whichever finishes first: the fix, or giving up on it. */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The same facts as the strings a multipart upload can carry.
 *
 * Empty entries are left out rather than sent as "undefined", which is
 * what a plain template string would have produced and what the server
 * would then have stored as the model name.
 */
export function asFields(facts: CaptureFacts): Record<string, string> {
  const fields: Record<string, string> = { capturedOn: facts.capturedOn };

  if (facts.latitude != null) fields.latitude = String(facts.latitude);
  if (facts.longitude != null) fields.longitude = String(facts.longitude);
  if (facts.platform) fields.platform = facts.platform;
  if (facts.model) fields.model = facts.model;
  if (facts.osVersion) fields.osVersion = facts.osVersion;

  return fields;
}
