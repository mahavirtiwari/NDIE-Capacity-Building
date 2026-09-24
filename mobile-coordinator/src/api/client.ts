import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ApiEnvelope } from './types';

/**
 * A device on the same Wi-Fi cannot reach the developer machine on
 * `localhost`, so the host is taken from the Metro connection when the app is
 * running in Expo Go. Set `extra.apiBaseUrl` in app.json for a real deployment.
 */
function resolveBaseUrl(): string {
  const configured = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
    ?.apiBaseUrl;

  if (configured && !configured.includes('localhost')) return configured;

  const fallback = configured ?? 'http://localhost:5210/api';

  if (Platform.OS === 'web') return fallback;

  /* hostUri looks like "192.168.1.8:8081" while Metro is serving the bundle. */
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return fallback.replace(/\/\/[^/:]+/, `//${host}`);
  }

  /* The Android emulator reaches the host machine on this address. */
  if (Platform.OS === 'android') return fallback.replace('localhost', '10.0.2.2');

  return fallback;
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: string[] | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenReader = () => string | null;
let readToken: TokenReader = () => null;
let onUnauthorised: () => void = () => {};

/** Wired up once by the auth provider. */
export function configureApi(reader: TokenReader, unauthorised: () => void): void {
  readToken = reader;
  onUnauthorised = unauthorised;
}

/**
 * The bearer token, for the multipart photo uploads.
 *
 * Those go out through `fetch` directly rather than through `request`, because
 * FormData has to set its own boundary on the Content-Type header — so they
 * need the token the same way, from the same place.
 */
export function readAuthToken(): string | null {
  return readToken();
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Skips the bearer header, for sign-up and OTP. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE_URL}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (!options.anonymous) {
    const token = readToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    throw new ApiError(
      `Cannot reach the server at ${API_BASE_URL}. Check your connection.`,
      0,
    );
  }

  if (response.status === 401 && !options.anonymous) {
    onUnauthorised();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    /* A body-less response such as 204 is fine. */
  }

  if (!response.ok || envelope?.success === false) {
    throw new ApiError(
      envelope?.message ?? `Request failed (${response.status}).`,
      response.status,
      envelope?.errors,
    );
  }

  return (envelope?.data ?? (null as T)) as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], anonymous = false) =>
    request<T>(path, { method: 'GET', query, anonymous }),
  post: <T>(path: string, body?: unknown, anonymous = false) =>
    request<T>(path, { method: 'POST', body, anonymous }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
};
