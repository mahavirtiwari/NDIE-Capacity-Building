import Constants from 'expo-constants';
import { cacheKeyFor, readCache, writeCache } from '../offline/store';
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

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Skips the bearer header, for sign-up and OTP. */
  anonymous?: boolean;
  signal?: AbortSignal;
  /**
   * Keep the answer for use when the server cannot be reached, and serve it
   * then. On by default for GET. Turn it off for anything whose staleness
   * would mislead rather than help.
   */
  cache?: boolean;
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
    /*
     * The server could not be reached. For a read, the last answer it gave is
     * far better than an error screen — the applicant on a train wants to see
     * their application, not be told about the network. Writes are not served
     * from here: a stale write is not a write.
     */
    if ((options.method ?? 'GET') === 'GET' && options.cache !== false) {
      const cached = await readCache<T>(cacheKeyFor(path, options.query));
      if (cached) return cached.data;
    }

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

  const data = (envelope?.data ?? (null as T)) as T;

  /* Kept after the fact rather than before, so only an answer the server
     actually stood behind is ever replayed. Not awaited: a slow write to
     storage should not hold up the screen that asked for the data. */
  if ((options.method ?? 'GET') === 'GET' && options.cache !== false && data !== null) {
    void writeCache(cacheKeyFor(path, options.query), data);
  }

  return data;
}

/**
 * Fetches a file the server will only hand to a signed-in applicant, and
 * returns it as bytes with the name and type the server gave it.
 *
 * Not part of `request`: that one speaks the JSON envelope and caches the
 * answer, and neither is right for a document. A failure here still carries
 * the envelope's message when the server sent one, so "the invoice has not
 * been raised yet" reaches the applicant rather than a status code.
 */
export interface DownloadedFile {
  bytes: ArrayBuffer;
  fileName: string;
  contentType: string;
}

export async function download(path: string, fallbackName = 'download'): Promise<DownloadedFile> {
  const url = `${API_BASE_URL}/${path.replace(/^\//, '')}`;
  const headers: Record<string, string> = {};

  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch {
    throw new ApiError(`Cannot reach the server at ${API_BASE_URL}. Check your connection.`, 0);
  }

  if (response.status === 401) {
    onUnauthorised();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  if (!response.ok) {
    /* The refusal is a JSON envelope even though the success is a file. */
    let message: string | null = null;
    try {
      message = ((await response.json()) as ApiEnvelope<unknown>).message ?? null;
    } catch {
      /* Not every failure has a body. */
    }
    throw new ApiError(message ?? `Could not download the file (${response.status}).`, response.status);
  }

  return {
    bytes: await response.arrayBuffer(),
    /* The header is the server's own name for the file, but a browser
       cannot read it across origins unless the server says so, and a
       proxy may drop it. The caller's fallback is what keeps the saved
       file from being called "download". */
    fileName: fileNameFrom(response.headers.get('content-disposition')) ?? fallbackName,
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
  };
}

/** RFC 5987 first, because that is the one that carries a non-ASCII name. */
function fileNameFrom(disposition: string | null): string | null {
  if (!disposition) return null;

  const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim().replace(/^"|"$/g, ''));
    } catch {
      /* A malformed header should not cost the download. */
    }
  }

  return /filename="?([^";]+)"?/i.exec(disposition)?.[1]?.trim() ?? null;
}

/**
 * A multipart POST, for the few places that send a file.
 *
 * Separate from `request` because the Content-Type has to be left alone —
 * the runtime sets it with the boundary, and naming it ourselves produces
 * a body the server cannot parse.
 */
async function postForm<T>(path: string, body: FormData): Promise<T> {
  const url = `${API_BASE_URL}/${path.replace(/^\//, '')}`;
  const headers: Record<string, string> = { Accept: 'application/json' };

  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers, body });
  } catch {
    throw new ApiError(`Cannot reach the server at ${API_BASE_URL}. Check your connection.`, 0);
  }

  if (response.status === 401) {
    onUnauthorised();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    /* A body-less response is fine. */
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
  postForm,
  get: <T>(path: string, query?: RequestOptions['query'], anonymous = false) =>
    request<T>(path, { method: 'GET', query, anonymous }),
  /** A read that must be fresh or fail, such as a fee about to be paid. */
  getLive: <T>(path: string, query?: RequestOptions['query'], anonymous = false) =>
    request<T>(path, { method: 'GET', query, anonymous, cache: false }),
  post: <T>(path: string, body?: unknown, anonymous = false) =>
    request<T>(path, { method: 'POST', body, anonymous }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
