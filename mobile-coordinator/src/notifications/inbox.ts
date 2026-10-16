import { notices } from '../api/endpoints';
import type { MyNotification } from '../api/types';

/**
 * The notices, held once for the whole app.
 *
 * There used to be two readers of the same endpoint: the bell in the
 * header, which wanted the unread count, and the screen behind it,
 * which wanted the list. Both fetched on focus, so opening the
 * notifications screen fired two identical requests at the same instant
 * — and because the screen treated any failure as "nothing to show",
 * whichever of the two lost came out as an empty inbox with a cheerful
 * explanation of why that was normal. A notice that exists and a notice
 * that could not be fetched are not the same thing and must not look
 * the same.
 *
 * So: one fetch, shared. A second call while one is in flight joins it
 * rather than starting another, the error is kept rather than swallowed,
 * and marking one read updates the badge immediately instead of at the
 * next focus.
 */

export interface Inbox {
  items: MyNotification[];
  unread: number;
  /** Null until the first answer. Distinguishes "none" from "not yet". */
  loaded: boolean;
  /** The last failure, in the server's words. Cleared by a good answer. */
  error: string | null;
}

let state: Inbox = { items: [], unread: 0, loaded: false, error: null };
const listeners = new Set<(next: Inbox) => void>();
let inFlight: Promise<void> | null = null;

function publish(next: Inbox): void {
  state = next;
  listeners.forEach((fn) => fn(state));
}

export function current(): Inbox {
  return state;
}

export function subscribe(listener: (next: Inbox) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fetches, or joins the fetch already running. */
export function refresh(): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const answer = await notices.list(50);
      publish({
        items: answer.items,
        unread: answer.unread,
        loaded: true,
        error: null,
      });
    } catch (caught) {
      /* The items already held are kept: a failed refresh should not
         empty a list the coordinator is reading. */
      publish({
        ...state,
        loaded: true,
        error: caught instanceof Error ? caught.message : 'Could not load your notifications.',
      });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Marks one read, on the screen first.
 *
 * The badge is what somebody is watching when they tap a notice, so it
 * comes down now rather than when the server gets round to agreeing.
 */
export async function markRead(id: number): Promise<void> {
  const already = state.items.find((n) => n.id === id)?.isRead ?? true;
  if (already) return;

  publish({
    ...state,
    items: state.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    unread: Math.max(0, state.unread - 1),
  });

  try {
    await notices.markRead(id);
  } catch {
    /* It is read either way; the next refresh settles it. */
  }
}

/** Dropped on sign-out: the next person's phone is not this one's inbox. */
export function forgetInbox(): void {
  publish({ items: [], unread: 0, loaded: false, error: null });
}
