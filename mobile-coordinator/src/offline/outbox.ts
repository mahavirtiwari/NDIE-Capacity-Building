import * as FileSystem from 'expo-file-system/legacy';
import { Directory, File, Paths } from 'expo-file-system';
import { API_BASE_URL, readAuthToken } from '../api/client';
import { readValue, writeValue } from './store';

/**
 * Work the coordinator has done that the server has not heard about yet.
 *
 * A workshop happens in a hall, often with no signal, and the whole job of
 * this app is recording what happened there. Refusing to accept a participant
 * because the network is down would be the app failing at the one thing it
 * exists for, so every write goes here first and the queue is drained when
 * there is a connection.
 *
 * Two things make that harder than a list of requests.
 *
 * A participant registered offline has no server id, and their photograph,
 * their attendance and their feedback all have to refer to them. So a queued
 * create is given a provisional id - negative, so it can never collide with a
 * real one - and the UI uses that immediately. When the create finally goes
 * through, the id the server assigned is substituted into everything still
 * queued that mentions the provisional one.
 *
 * And a photograph is a file. expo-image-picker hands back a path in the cache
 * directory, which the system is free to empty; a photo queued at 11am and
 * uploaded at 4pm would be gone. Queued photos are copied somewhere durable
 * first and deleted once they are up.
 */

const QUEUE_KEY = 'outbox.queue';
const PHOTO_DIR = 'outbox-photos';

export type OutboxStatus = 'waiting' | 'blocked';

export interface QueuedPhoto {
  /** Our own copy, not the picker's. */
  uri: string;
  name: string;
  type: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface OutboxEntry {
  id: string;
  /**
   * The user code this work belongs to.
   *
   * A queue survives sign-out on purpose: it is a record of what happened in a
   * hall, and discarding it because somebody tapped Sign out would throw away
   * the afternoon. But it must never be replayed under somebody else's token,
   * so the drain only touches entries whose owner is the person signed in. A
   * coordinator with unsent work signs back in and it goes.
   */
  owner: string;
  /** Shown to the coordinator: "Participant", "Session", "Venue". */
  label: string;
  method: 'POST' | 'PUT';
  path: string;
  body?: unknown;
  photo?: QueuedPhoto;
  /**
   * The provisional id this entry will turn into a real one. Present only on
   * creates.
   */
  localId?: number;
  createdAt: string;
  attempts: number;
  status: OutboxStatus;
  /** Why it is blocked, in the server's words. */
  error?: string;
}

/* ------------------------------------------------------------- local ids */

/**
 * Provisional ids count down from a long way below zero, so they are
 * unmistakable in a log and can never be confused with a key from the
 * database.
 */
let nextLocalId = -Date.now();

export function newLocalId(): number {
  nextLocalId -= 1;
  return nextLocalId;
}

export function isLocalId(id: number): boolean {
  return id < 0;
}

/* ---------------------------------------------------------------- storage */

let queue: OutboxEntry[] | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<OutboxEntry[]> {
  if (queue) return queue;
  queue = (await readValue<OutboxEntry[]>(QUEUE_KEY)) ?? [];
  return queue;
}

async function save(next: OutboxEntry[]): Promise<void> {
  queue = next;
  await writeValue(QUEUE_KEY, next);
  listeners.forEach((fn) => fn());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function snapshot(): Promise<OutboxEntry[]> {
  return [...(await load())];
}

/** What the banner counts. A blocked entry is not waiting; it needs a person. */
export async function counts(owner?: string): Promise<{ waiting: number; blocked: number }> {
  const entries = (await load()).filter((e) => !owner || e.owner === owner);
  return {
    waiting: entries.filter((e) => e.status === 'waiting').length,
    blocked: entries.filter((e) => e.status === 'blocked').length,
  };
}

/* ----------------------------------------------------------------- photos */

/**
 * Takes our own copy of a picked image, because the picker's is in a cache the
 * system may empty before the queue drains.
 */
export async function keepPhoto(uri: string, name: string, type: string): Promise<QueuedPhoto> {
  const folder = new Directory(Paths.document, PHOTO_DIR);
  if (!folder.exists) folder.create({ intermediates: true });

  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const target = new File(folder, `${Date.now()}-${safe}`);

  try {
    new File(uri).copy(target);
    return { uri: target.uri, name: safe, type };
  } catch {
    /* If the copy fails the original is still the best we have; uploading
       promptly will usually still work. */
    return { uri, name: safe, type };
  }
}

function discardPhoto(photo?: QueuedPhoto): void {
  if (!photo || !photo.uri.includes(PHOTO_DIR)) return;
  try {
    const file = new File(photo.uri);
    if (file.exists) file.delete();
  } catch {
    /* A file left behind is untidy, not wrong. */
  }
}

/* ------------------------------------------------------------- queueing */

export async function enqueue(
  entry: Omit<OutboxEntry, 'id' | 'createdAt' | 'attempts' | 'status'>,
): Promise<OutboxEntry> {
  const full: OutboxEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'waiting',
  };

  await save([...(await load()), full]);
  return full;
}

/* -------------------------------------------------- resolving provisionals */

/**
 * Replaces every provisional id with the real one, wherever it appears - in a
 * path segment, in a field, inside an array of attendance marks. Matching on
 * the value rather than on a placeholder syntax means a caller never has to
 * remember to mark a reference up.
 */
function substitute<T>(value: T, resolved: Map<number, number>): T {
  if (resolved.size === 0) return value;

  if (typeof value === 'number') {
    const real = resolved.get(value);
    return (real === undefined ? value : real) as T;
  }

  if (typeof value === 'string') {
    let out: string = value;
    resolved.forEach((real, local) => {
      out = out.split(String(local)).join(String(real));
    });
    return out as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => substitute(item, resolved)) as T;
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substitute(v, resolved);
    }
    return out as T;
  }

  return value;
}

/** True when anything in here still points at something not yet created. */
function hasUnresolved(value: unknown): boolean {
  if (typeof value === 'number') return value < 0 && value < -1_000_000_000;
  if (typeof value === 'string') return /-1\d{12}/.test(value);
  if (Array.isArray(value)) return value.some(hasUnresolved);
  if (value && typeof value === 'object') return Object.values(value).some(hasUnresolved);
  return false;
}

/* -------------------------------------------------------------- draining */

interface SendResult {
  ok: boolean;
  /** Set when the server answered and will answer the same way again. */
  permanent?: boolean;
  serverId?: number;
  error?: string;
}

async function send(entry: OutboxEntry): Promise<SendResult> {
  const token = readAuthToken();
  const url = `${API_BASE_URL}/${entry.path.replace(/^\//, '')}`;

  let response: Response;
  try {
    if (entry.photo) {
      /* The same reason as the live upload: the runtime will not encode a
         file part itself, so the file system module does it. */
      const sent = await FileSystem.uploadAsync(url, entry.photo.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: entry.photo.type,
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      response = new Response(sent.body, { status: sent.status });
    } else {
      response = await fetch(url, {
        method: entry.method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: entry.body === undefined ? undefined : JSON.stringify(entry.body),
      });
    }
  } catch {
    /* Still no network. Not the entry's fault; try again later. */
    return { ok: false, error: 'No connection' };
  }

  const envelope = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: { id?: number }; message?: string }
    | null;

  if (response.ok && envelope?.success !== false) {
    return { ok: true, serverId: envelope?.data?.id };
  }

  /*
   * 401 is not permanent - the token expired while the phone was in a pocket,
   * and the next sign-in fixes it. A 4xx that is not 401 or 408 or 429 will be
   * refused identically forever, and retrying it silently would hide from the
   * coordinator that something they recorded is never going to arrive.
   */
  const permanent =
    response.status >= 400 &&
    response.status < 500 &&
    ![401, 408, 429].includes(response.status);

  return {
    ok: false,
    permanent,
    error: envelope?.message ?? `Refused with ${response.status}`,
  };
}

let draining = false;

/**
 * Sends everything waiting, oldest first.
 *
 * Order is kept, and a failure stops the run rather than skipping past it: the
 * entries behind a participant create usually refer to that participant, and
 * sending a photo for somebody who does not exist yet would fail anyway. What
 * is queued is a sequence of events in a hall, and replaying it out of order
 * would record something that did not happen.
 */
export async function drain(owner: string): Promise<{ sent: number; blocked: number }> {
  if (draining) return { sent: 0, blocked: 0 };
  draining = true;

  try {
    const entries = await load();
    if (entries.length === 0) return { sent: 0, blocked: 0 };

    const resolved = new Map<number, number>();
    const remaining: OutboxEntry[] = [];
    let sent = 0;
    let stopped = false;

    for (const entry of entries) {
      if (entry.owner !== owner) {
        /* Somebody else's work, waiting for them to sign back in. Skipped
           rather than stopping the run: it has no bearing on this queue. */
        remaining.push(entry);
        continue;
      }

      if (stopped || entry.status === 'blocked') {
        remaining.push(resolved.size ? applyResolved(entry, resolved) : entry);
        continue;
      }

      const ready = applyResolved(entry, resolved);

      if (hasUnresolved(ready.path) || hasUnresolved(ready.body)) {
        /* Whatever creates this reference has not gone through, so neither can
           this. Keep it and stop; the next run picks it up in order. */
        remaining.push(ready);
        stopped = true;
        continue;
      }

      const result = await send(ready);

      if (result.ok) {
        if (ready.localId !== undefined && result.serverId !== undefined) {
          resolved.set(ready.localId, result.serverId);
        }
        discardPhoto(ready.photo);
        sent += 1;
        continue;
      }

      if (result.permanent) {
        remaining.push({ ...ready, status: 'blocked', error: result.error, attempts: ready.attempts + 1 });
        stopped = true;
        continue;
      }

      remaining.push({ ...ready, attempts: ready.attempts + 1, error: result.error });
      stopped = true;
    }

    await save(remaining);
    return { sent, blocked: remaining.filter((e) => e.status === 'blocked').length };
  } finally {
    draining = false;
  }
}

function applyResolved(entry: OutboxEntry, resolved: Map<number, number>): OutboxEntry {
  if (resolved.size === 0) return entry;
  return {
    ...entry,
    path: substitute(entry.path, resolved),
    body: entry.body === undefined ? undefined : substitute(entry.body, resolved),
  };
}

/** Lets the coordinator throw away something the server will never accept. */
export async function discard(id: string): Promise<void> {
  const entries = await load();
  const entry = entries.find((e) => e.id === id);
  if (entry) discardPhoto(entry.photo);
  await save(entries.filter((e) => e.id !== id));
}

/**
 * Throws the whole queue away. Not called on sign-out - see `owner` - and only
 * ever from somewhere the coordinator has been told what they are discarding.
 */
export async function clearOutbox(): Promise<void> {
  const entries = await load();
  entries.forEach((e) => discardPhoto(e.photo));
  await save([]);
}
