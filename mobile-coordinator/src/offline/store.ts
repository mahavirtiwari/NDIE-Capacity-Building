import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Everything the app keeps on the device between launches.
 *
 * Two kinds of thing live here. Cached GET responses, so a screen has
 * something to show when the network does not answer, and small values the
 * app owns outright — the branding, the path of the downloaded logo.
 *
 * All of it is scoped to whoever is signed in. Cached pages carry names,
 * applications and enrolments, and the next person to use the phone must not
 * see them, so `forgetEverything` runs on sign-out rather than relying on the
 * cache ageing out.
 */

const PREFIX = 'cbms.v1.';
const CACHE = PREFIX + 'cache.';

export interface Cached<T> {
  data: T;
  /** ISO timestamp, shown to the reader as "saved at". */
  savedAt: string;
}

/** A stable key for a request. Query order must not change the answer. */
export function cacheKeyFor(path: string, query?: Record<string, unknown>): string {
  const clean = path.replace(/^\//, '');
  if (!query) return clean;

  const pairs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${String(v)}`)
    .sort();

  return pairs.length ? `${clean}?${pairs.join('&')}` : clean;
}

export async function readCache<T>(key: string): Promise<Cached<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE + key);
    return raw ? (JSON.parse(raw) as Cached<T>) : null;
  } catch {
    /* A corrupt entry is not worth failing a screen over. */
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: Cached<T> = { data, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(CACHE + key, JSON.stringify(entry));
  } catch {
    /* Storage full, most likely. Losing the cache is not losing the request. */
  }
}

export async function readValue<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeValue<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* As above. */
  }
}

/**
 * Wipes the cache. Called on sign-out: what is cached is one person's data,
 * and the phone may be handed to somebody else.
 *
 * Deliberately leaves anything outside the cache namespace alone, so the
 * branding and the downloaded logo survive and the sign-in screen is still
 * branded for the next person, offline or not.
 */
export async function forgetCachedData(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(CACHE));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    /* Nothing useful to do, and sign-out must not fail because of it. */
  }
}
