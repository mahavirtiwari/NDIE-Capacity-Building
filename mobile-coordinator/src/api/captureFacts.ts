import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * What the handset was, and when the shutter went.
 *
 * Sent with every monitoring photograph so the server can draw the time
 * and place into the picture and keep them beside it. The position is not
 * here: the screens already take a fix of their own before capturing, and
 * passing it twice would let the two disagree.
 *
 * The time is taken when the photograph is handed to the uploader, not
 * when it reaches the server. On a field visit those are routinely hours
 * apart — the app queues what it cannot send — and the useful one is the
 * first.
 */
export interface DeviceFacts {
  capturedOn: string;
  platform?: string;
  model?: string;
  osVersion?: string;
}

export function deviceFacts(): DeviceFacts {
  return {
    capturedOn: new Date().toISOString(),
    platform: Platform.OS,
    model: Device.modelName ?? undefined,
    osVersion: Device.osVersion ?? undefined,
  };
}

/**
 * The facts as query parameters, appended to an upload's URL.
 *
 * The query string and not a form field, because the offline queue
 * replays a photograph by its path: anything written here survives being
 * sent later, and anything written into the request body at send time
 * would be regenerated with the wrong clock.
 */
export function appendFacts(url: URL, facts: DeviceFacts): void {
  url.searchParams.set('capturedOn', facts.capturedOn);
  if (facts.platform) url.searchParams.set('platform', facts.platform);
  if (facts.model) url.searchParams.set('model', facts.model);
  if (facts.osVersion) url.searchParams.set('osVersion', facts.osVersion);
}

/** The same, as the tail of a path that is being queued. */
export function factsQuery(facts: DeviceFacts): string {
  const parts = [`capturedOn=${encodeURIComponent(facts.capturedOn)}`];
  if (facts.platform) parts.push(`platform=${encodeURIComponent(facts.platform)}`);
  if (facts.model) parts.push(`model=${encodeURIComponent(facts.model)}`);
  if (facts.osVersion) parts.push(`osVersion=${encodeURIComponent(facts.osVersion)}`);
  return parts.join('&');
}
