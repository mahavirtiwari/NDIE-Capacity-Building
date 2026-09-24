/**
 * Mirrors the server's code generator (`CodeFactory`) so a master form can
 * show, as placeholder text, the code it will be given when the field is left
 * blank. The server remains the authority — it also settles collisions, which
 * this cannot see — so treat what comes back from a save as the real value.
 */

const MAX_SEGMENT = 8;

const clip = (value: string): string =>
  value.length <= MAX_SEGMENT ? value : value.slice(0, MAX_SEGMENT);

/**
 * Shortens a name to a few capitals: initials for a multi-word name when they
 * are long enough to read, otherwise the opening letters.
 */
export function abbreviate(name: string | null | undefined, length = 3): string {
  const words = (name ?? '')
    .split(/[\s\-/,.()&]+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
    .filter((word) => word.length > 0);

  if (words.length === 0) return 'GEN';

  if (words.length > 1) {
    const initials = words.map((word) => word[0]).join('');
    if (initials.length >= length) return clip(initials);
  }

  const joined = words.join('');
  const derived = clip(joined.length <= length ? joined : joined.slice(0, length));

  /* The code format demands at least two characters. */
  return derived.length >= 2 ? derived : derived.padEnd(2, 'X');
}

/** Joins a parent code to a derived one, e.g. `ZED-BRO`. */
export function composeCode(parentCode: string | null | undefined, abbreviation: string): string {
  const parent = clip((parentCode ?? '').trim().toUpperCase());
  return parent.length === 0 ? abbreviation : `${parent}-${abbreviation}`;
}
