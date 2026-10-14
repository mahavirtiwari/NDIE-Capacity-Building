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

  /**
   * Why there is no position, where there is none.
   *
   * The picture goes either way - that trade is not in question - but it
   * comes back stamped "Location not recorded", and an applicant looking
   * at that has no idea whether their phone is at fault, their settings
   * are, or the sky is. Carried so the field can tell them, and never
   * sent to the server: it is a note for the person holding the handset.
   */
  locationProblem?: 'denied' | 'off' | 'nofix';
}

/**
 * Asks the phone where and what it is.
 *
 * Never throws and never blocks for long. A fix is asked for at balanced
 * accuracy — a few metres, which is what the stamp needs — and abandoned
 * after a few seconds, because a camera field that hangs waiting for GPS
 * indoors is a camera field nobody can use.
 *
 * Which is why the fix the phone already has is taken first. Asking the
 * satellites from cold, indoors, with a certificate in one hand, does not
 * finish inside any window short enough to wait through, and the
 * photographs were coming back stamped "Location not recorded" because
 * of it. A position from the last few minutes is the same room, and it
 * arrives at once; the fresh one replaces it if it turns up in time.
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
    if (!permission.granted) {
      facts.locationProblem = 'denied';
      return facts;
    }

    /* Granted to the app, and switched off on the phone, are different
       things with different answers - one is in this app's settings and
       the other is in the pull-down. */
    if (!(await Location.hasServicesEnabledAsync())) {
      facts.locationProblem = 'off';
      return facts;
    }

    /* What the phone already knows. Minutes old at most: a position from
       this morning is not where this photograph was taken, and a stamp
       that says so would be worse than one that says nothing. */
    const known = await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60 * 1000,
      requiredAccuracy: 500,
    });

    if (known) {
      facts.latitude = known.coords.latitude;
      facts.longitude = known.coords.longitude;
    }

    /* And then the real one, which is better if it arrives. Longer than
       it was, because there is now something to fall back on and the wait
       costs nothing but the wait. */
    const fix = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      12000,
    );

    if (fix) {
      facts.latitude = fix.coords.latitude;
      facts.longitude = fix.coords.longitude;
    }

    if (facts.latitude == null) facts.locationProblem = 'nofix';
  } catch {
    /* The picture still goes. */
    if (facts.latitude == null) facts.locationProblem = 'nofix';
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

/** What to tell somebody whose picture went up without a position. */
export function locationNote(facts: CaptureFacts): string | null {
  switch (facts.locationProblem) {
    case 'denied':
      return 'Saved without a location. Allow location for this app in its settings, '
        + 'then take the picture again if the position is needed.';
    case 'off':
      return 'Saved without a location. Switch location on, then take the picture again '
        + 'if the position is needed.';
    case 'nofix':
      return 'Saved without a location: the phone could not find one indoors. '
        + 'Near a window or outside, take it again if the position is needed.';
    default:
      return null;
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
