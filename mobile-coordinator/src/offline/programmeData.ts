import { discardWhere, type OutboxEntry } from './outbox';
import { forgetCachedWhere } from './store';

/**
 * What one programme has left on this phone, and how to get rid of it.
 *
 * Two kinds of thing, and a coordinator thinks of them as one: pages
 * cached so a screen has something to show with no signal, and work
 * queued because the server could not be reached. Both are keyed by the
 * request path, which is what makes "everything belonging to programme
 * 12" answerable at all.
 *
 * It is cleared in two circumstances. A programme that has been finally
 * submitted is sealed — nothing on this handset can change it and
 * nothing on it will ever be sent again, so keeping a hall full of
 * participants' names and photographs on a phone that is carried around
 * is holding somebody else's personal data for no reason. And a
 * coordinator who has recorded the wrong thing against the wrong batch
 * needs a way to put it back, section by section, rather than being
 * told to uninstall the app.
 */

export interface Section {
  key: string;
  label: string;
  /** What it will remove, in the words of the screen it was recorded on. */
  describes: string;
  /** Does this request path belong to this section of this programme? */
  owns: (path: string, programmeId: number) => boolean;
}

const head = (programmeId: number) => `coordinator/programmes/${programmeId}`;

/** Everything under the programme that is not claimed by a named section. */
const base = (path: string, programmeId: number) => path.startsWith(head(programmeId));

export const SECTIONS: Section[] = [
  {
    key: 'venue',
    label: 'Venue',
    describes: 'The address, the map pin and the venue photographs.',
    owns: (path, id) => path.startsWith(`${head(id)}/venue`),
  },
  {
    key: 'trainers',
    label: 'Trainers',
    describes: 'Trainers registered on this programme from this phone.',
    owns: (path, id) => path.startsWith(`${head(id)}/trainers`),
  },
  {
    key: 'sessions',
    label: 'Sessions',
    describes: 'Sessions recorded against the curriculum, and their photographs.',
    owns: (path, id) => path.startsWith(`${head(id)}/sessions`),
  },
  {
    key: 'participants',
    label: 'Participants',
    describes: 'The register, participant photographs and their feedback.',
    owns: (path, id) => path.startsWith(`${head(id)}/participants`),
  },
  {
    key: 'attendance',
    label: 'Attendance',
    describes: 'Day-by-day marking and the photographed signed sheets.',
    owns: (path, id) => path.startsWith(`${head(id)}/attendance`),
  },
  {
    key: 'marksheet',
    label: 'Marks',
    describes: 'Marks entered against each participant.',
    owns: (path, id) => path.startsWith(`${head(id)}/marksheet`),
  },
];

/** A path belonging to the programme but to none of the named sections. */
function unclaimed(path: string, programmeId: number): boolean {
  return base(path, programmeId) && !SECTIONS.some((s) => s.owns(path, programmeId));
}

export interface Cleared {
  /** Cached pages forgotten. */
  cached: number;
  /** Queued work thrown away — the number that matters, because it is lost. */
  queued: number;
}

/**
 * Clears the chosen sections of one programme from this phone.
 *
 * Queued work goes with the cache deliberately: an entry that is still
 * waiting is the only copy of what was recorded, so leaving it behind
 * would mean a section the coordinator was told had been cleared
 * arriving at the office an hour later.
 */
export async function clearSections(
  programmeId: number,
  keys: string[],
): Promise<Cleared> {
  const chosen = SECTIONS.filter((s) => keys.includes(s.key));
  if (chosen.length === 0) return { cached: 0, queued: 0 };

  const owns = (path: string) => chosen.some((s) => s.owns(path, programmeId));

  const cached = await forgetCachedWhere(owns);
  const queued = await discardWhere((entry: OutboxEntry) => owns(stripQuery(entry.path)));

  return { cached, queued };
}

/**
 * Clears everything this programme has on the phone.
 *
 * Called when a submission is accepted: at that point the record lives
 * on the server, sealed, and this copy can only go stale.
 */
export async function clearProgramme(programmeId: number): Promise<Cleared> {
  const mine = (path: string) => base(path, programmeId) || unclaimed(path, programmeId);

  const cached = await forgetCachedWhere(mine);
  const queued = await discardWhere((entry: OutboxEntry) => mine(stripQuery(entry.path)));

  return { cached, queued };
}

/* A queued photo carries its fix and the handset's facts in the query
   string. The section it belongs to is in the path before them. */
function stripQuery(path: string): string {
  const cut = path.indexOf('?');
  return cut === -1 ? path : path.slice(0, cut);
}
