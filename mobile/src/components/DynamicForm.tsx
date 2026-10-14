import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type {
  DurationValue,
  PhotoShot,
  ProfileField,
  ProfileForm,
  ProfileSection,
} from '../api/types';
import { colors, font, radius, spacing } from '../theme';
import { MAX_LENGTHS, UPPERCASE_TYPES, dateBoundsError, formatErrorFor } from '../validation/formats';
import { lookups, me } from '../api/endpoints';
import { cacheImage, releaseImage } from '../files/cachedImage';
import { captureFacts, locationNote } from '../files/captureFacts';
import { saveAndShare } from '../files/saveAndShare';
import { Card, Chip, Field } from './ui';
import { DateField } from './DateField';
import { MultiPicker, Picker, RadioGroup, Switch } from './Picker';

export type FormValue = string | string[] | boolean | DurationValue | null;
export type FormValues = Record<string, FormValue>;

/**
 * Which discipline's profile the form on screen belongs to.
 *
 * An account holds a profile in each category it has entered, so a picture
 * or a document is only identified by the sub-category as well as the field
 * - two forms may name a field the same thing. Carried as context rather
 * than threaded through four layers of props, because it is ambient to the
 * whole form and only the two fields that attach something need it.
 */
const SubCategoryContext = createContext<number | null>(null);

export function ProfileScope({
  subCategoryId,
  children,
}: {
  subCategoryId: number;
  children: React.ReactNode;
}) {
  return (
    <SubCategoryContext.Provider value={subCategoryId}>{children}</SubCategoryContext.Provider>
  );
}

/** The discipline, or null where the form is being filled outside one. */
function useSubCategoryIdOrNull(): number | null {
  return useContext(SubCategoryContext);
}

function useSubCategoryId(): number {
  const held = useContext(SubCategoryContext);
  /* Loud rather than silently posting to sub-category zero, which the API
     would refuse in a way nobody could trace back to here. */
  if (held === null) {
    throw new Error('A file or picture field needs <ProfileScope> around the form.');
  }
  return held;
}

/**
 * How far through one section the applicant is.
 *
 * The section list is the application now, so each row has to say where it
 * stands without being opened. Nothing here is stored: it is read off the
 * answers already held, so it follows every keystroke.
 */
export type SectionStatus = 'pending' | 'progress' | 'done';

export interface SectionProgress {
  status: SectionStatus;
  /** Answers given, counting every entry of a repeating section. */
  answered: number;
  /** Questions asked, conditional ones only while their trigger holds. */
  total: number;
  /** How many answers were found wrong the last time it was checked. */
  wrong: number;
}

export function statusLabelFor(status: SectionStatus): string {
  if (status === 'done') return 'Completed';
  return status === 'progress' ? 'In progress' : 'Pending';
}

/** Everything the caller needs back from the renderer. */
export interface DynamicFormState {
  values: FormValues;
  errors: Record<string, string>;
  setValue: (key: string, value: FormValue) => void;
  validate: () => boolean;
  /** Answers shaped the way the API expects them. */
  payload: () => Record<string, unknown>;
  /**
   * Fills the form in from a previous submission — the reverse of
   * {@link payload}. Used when an application was rejected and the
   * applicant is correcting it rather than starting again.
   */
  prefill: (responses: Record<string, unknown>) => void;

  /**
   * Checks one section on its own, leaving every other section's errors
   * where they were. The section screen runs this on the way out, so a
   * mistake is reported where it was made rather than at the very end.
   */
  validateSection: (section: ProfileSection) => boolean;

  /** Where one section stands, for the section list. */
  progressOf: (section: ProfileSection) => SectionProgress;

  /** How many times a repeating section is currently filled in. */
  entryCount: (section: ProfileSection) => number;
  addEntry: (section: ProfileSection) => void;
  removeEntry: (section: ProfileSection, index: number) => void;
}

/**
 * Separates the parts of a stored key. A unit separator, because a field key
 * is typed by an administrator and could contain anything printable.
 */
const SEP = '\u001f';

/** Where a repeating section's entries are stored. */
export function sectionKeyOf(section: ProfileSection): string {
  return section.key?.trim() || `section${section.id}`;
}

/**
 * Every answer lives in one flat map, including the ones inside a repeating
 * section — those are held under section, entry number and field, and only
 * gathered into a list when the form is submitted. One map means the field
 * renderer, the errors and the change handler all work unchanged whether a
 * field is answered once or five times.
 */
export function storageKey(
  section: ProfileSection,
  index: number | null,
  fieldKey: string,
): string {
  return index === null ? fieldKey : `${sectionKeyOf(section)}${SEP}${index}${SEP}${fieldKey}`;
}

function defaultFor(field: ProfileField): FormValue {
  if (field.type === 'multiselect') return [];
  if (field.type === 'checkbox') return false;
  /* An unanswered span is an empty one rather than a blank string: the
     control reads an object either way. */
  if (field.type === 'duration') return { from: '', to: '', months: 0 };
  return '';
}

/** Whole months between two ISO dates, counting a part month as served. */
/**
 * A span broken into years, months and days.
 *
 * Calendar arithmetic rather than a division: the months between two
 * dates depend on which months they are, and 1 September to 1 October is
 * a month whether or not that month had 30 days in it. Days are borrowed
 * from the month before, the way anybody counting on a calendar does it.
 */
export function spanParts(from: string, to: string): {
  years: number;
  months: number;
  days: number;
} {
  const none = { years: 0, months: 0, days: 0 };
  if (!from || !to) return none;

  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return none;

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();

  /* The last month only counts once the day of it has come round. */
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  /* The days are what is left after those whole months, counted from the
     date they land on rather than borrowed arithmetically - borrowing is
     wrong whenever the month landed on is shorter than the day started
     from, and 31 January to 1 March is exactly that case. A month added
     to the 31st rolls into the next one in JavaScript, so it is pulled
     back to the last day of the month it was meant to be. */
  const wanted = start.getMonth() + years * 12 + months;
  const anchor = new Date(start.getFullYear(), wanted, start.getDate());
  if (anchor.getMonth() !== ((wanted % 12) + 12) % 12) anchor.setDate(0);

  /* Counted in UTC days, so an hour lost to a clock change somewhere is
     not a day lost here. */
  const days = Math.round(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
      - Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()))
    / 86_400_000,
  );

  return { years, months, days: Math.max(0, days) };
}

/** "1 year 2 months 5 days", or "3 days", or "Same day". */
export function spanInWords(from: string, to: string): string {
  const { years, months, days } = spanParts(from, to);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);

  return parts.length > 0 ? parts.join(' ') : 'Same day';
}

export function monthsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  /* The day of the month decides the last one: 1 Jan to 31 Jan is a month
     served, 1 Jan to 15 Feb is one month and a part. */
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

/** "2 years 3 months", or "3 months", or "Less than a month". */
export function durationWords(months: number): string {
  if (months <= 0) return 'Less than a month';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (rest > 0) parts.push(`${rest} month${rest === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** The span held against a field, whatever else the value turns out to be. */
function spanOf(value: FormValue): DurationValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { from: '', to: '', months: 0 };
  }
  const span = value as Partial<DurationValue>;
  return { from: span.from ?? '', to: span.to ?? '', months: span.months ?? 0 };
}

/**
 * Whether an answer is still missing. The same test the validator applies to
 * a required field, so a section cannot read as completed while the check
 * that runs on submit would fail it.
 */
function isBlank(raw: FormValue): boolean {
  if (Array.isArray(raw)) return raw.length === 0;
  if (typeof raw === 'boolean') return !raw;
  /* A span is answered when both ends of it are: one date and a blank is
     half a question. */
  if (raw && typeof raw === 'object') {
    const span = raw as Partial<DurationValue>;
    return !span.from || !span.to;
  }
  return (raw ?? '').trim() === '';
}

/**
 * Whether a field has actually been answered.
 *
 * A photos field keeps its answer as a count, so "0" is a stored value
 * that means no pictures were taken -- blank by every reading that
 * matters, and the reason a section could be opened and left and still
 * report itself completed. A number field is not treated this way: nought
 * years of experience is an answer somebody gave.
 */
function isAnswered(field: ProfileField, raw: FormValue): boolean {
  if (field.type === 'photos') return Number(asText(raw ?? '')) > 0;
  return !isBlank(raw);
}

/**
 * Whether a stored key belongs to this section, so its errors can be cleared
 * without disturbing the rest of the form's.
 */
function ownsKey(section: ProfileSection, fields: ProfileField[]) {
  const prefix = `${sectionKeyOf(section)}${SEP}`;
  const own = new Set(fields.map((field) => field.key));
  return (key: string) =>
    key === sectionKeyOf(section) ||
    (section.isRepeatable ? key.startsWith(prefix) : own.has(key));
}

const asText = (value: FormValue): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(',');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  /* A span reads as the two dates it is: anything printing an answer as
     one line - a summary, a review screen - gets something legible rather
     than [object Object]. */
  if (typeof value === 'object') {
    const span = value as Partial<DurationValue>;
    return span.from && span.to ? `${span.from} to ${span.to}` : '';
  }
  return value;
};

const minOf = (section: ProfileSection) => Math.max(0, section.minEntries ?? 1);
const maxOf = (section: ProfileSection) => Math.max(1, section.maxEntries ?? 10);

/** What one entry is called, falling back to the section's own title. */
export function entryNoun(section: ProfileSection): string {
  return section.itemLabel?.trim() || section.title;
}

/**
 * Holds the answers for a Super Admin designed form and validates them with the
 * same rules the API enforces, so the applicant is corrected before they submit.
 */
export function useDynamicForm(form: ProfileForm | null): DynamicFormState {
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** How many entries each repeating section is showing, by section key. */
  const [counts, setCounts] = useState<Record<string, number>>({});

  const liveSections = useMemo(
    () => (form?.sections ?? []).filter((section) => section.isEnabled),
    [form],
  );

  const fieldsOf = useCallback(
    (section: ProfileSection) => section.fields.filter((field) => field.isEnabled),
    [],
  );

  /* A repeating section opens with the fewest entries it is allowed to have,
     and never fewer than one, so the applicant has something to type into. */
  useEffect(() => {
    setCounts((current) => {
      const next = { ...current };
      let changed = false;
      for (const section of liveSections) {
        if (!section.isRepeatable) continue;
        const key = sectionKeyOf(section);
        if (next[key] === undefined) {
          next[key] = Math.max(minOf(section), 1);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [liveSections]);

  const entryCount = useCallback(
    (section: ProfileSection) =>
      section.isRepeatable ? (counts[sectionKeyOf(section)] ?? Math.max(minOf(section), 1)) : 1,
    [counts],
  );

  const setValue = useCallback((key: string, value: FormValue) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const addEntry = useCallback((section: ProfileSection) => {
    const key = sectionKeyOf(section);
    setCounts((current) => {
      const shown = current[key] ?? Math.max(minOf(section), 1);
      if (shown >= maxOf(section)) return current;
      return { ...current, [key]: shown + 1 };
    });
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  /**
   * Removing an entry shuffles the ones after it down, so the answers move
   * with them rather than the wrong entry appearing to have been deleted.
   */
  const removeEntry = useCallback(
    (section: ProfileSection, index: number) => {
      const key = sectionKeyOf(section);
      const fields = fieldsOf(section);

      setCounts((current) => {
        const shown = current[key] ?? Math.max(minOf(section), 1);
        if (shown <= Math.max(minOf(section), 1)) return current;

        setValues((answers) => {
          const next = { ...answers };
          for (let at = index; at < shown - 1; at++) {
            for (const field of fields) {
              const here = storageKey(section, at, field.key);
              const after = storageKey(section, at + 1, field.key);
              if (after in next) next[here] = next[after];
              else delete next[here];
            }
          }
          for (const field of fields) delete next[storageKey(section, shown - 1, field.key)];
          return next;
        });

        return { ...current, [key]: shown - 1 };
      });
    },
    [fieldsOf],
  );

  /**
   * A conditional field only counts when its trigger answer matches. Inside a
   * repeating section the trigger is that entry's own answer; a trigger
   * outside the section is the same for every entry.
   */
  const isVisible = useCallback(
    (
      field: ProfileField,
      section: ProfileSection,
      index: number | null,
      source: FormValues,
    ): boolean => {
      if (!field.visibleWhenFieldKey) return true;
      const scoped = storageKey(section, index, field.visibleWhenFieldKey);
      const raw = scoped in source ? source[scoped] : source[field.visibleWhenFieldKey];
      const trigger = asText(raw ?? null);
      const wanted = field.visibleWhenValues ?? [];
      if (wanted.length === 0) return true;
      return wanted.some((candidate) => candidate.toLowerCase() === trigger.toLowerCase());
    },
    [],
  );

  const checkField = useCallback(
    (
      field: ProfileField,
      key: string,
      found: Record<string, string>,
      source: FormValues,
    ) => {
      const raw = source[key] ?? defaultFor(field);
      const text = asText(raw);
      const empty = !isAnswered(field, raw)
        || (Array.isArray(raw) ? raw.length === 0 : text.trim() === '' || text === 'false');

      if (field.validation.required && empty) {
        /* A declaration's label is a paragraph, and "<the whole paragraph>
           is required." is not a sentence anybody should be shown. */
        found[key] =
          field.type === 'checkbox'
            ? 'You need to tick this to continue.'
            : `${field.label} is required.`;
        return;
      }
      if (empty) return;

      const formatError = formatErrorFor(field.type, text);
      if (formatError) {
        found[key] = formatError;
        return;
      }

      /* A date's window, where the form sets one. Checked before the
         length rules, which say nothing useful about a date. */
      if (field.type === 'date') {
        const outside = dateBoundsError(
          text, field.validation.minDate, field.validation.maxDate);
        if (outside) {
          found[key] = outside;
          return;
        }
      }

      const { minLength, maxLength, min, max, pattern } = field.validation;
      if (minLength && text.length < minLength) {
        found[key] = `Minimum ${minLength} characters.`;
      } else if (maxLength && text.length > maxLength) {
        found[key] = `Maximum ${maxLength} characters.`;
      } else if (field.type === 'number' && (min !== null || max !== null)) {
        const numeric = Number(text);
        if (Number.isNaN(numeric)) found[key] = 'Enter a number.';
        else if (min !== null && min !== undefined && numeric < min) {
          found[key] = `Minimum value is ${min}.`;
        } else if (max !== null && max !== undefined && numeric > max) {
          found[key] = `Maximum value is ${max}.`;
        }
      } else if (pattern) {
        try {
          if (!new RegExp(pattern).test(text)) {
            found[key] = `Enter a valid ${field.label.toLowerCase()}.`;
          }
        } catch {
          /* A bad pattern on the definition must not block the applicant. */
        }
      }
    },
    [],
  );

  /**
   * Gathers one section's errors. Shared by the check that runs over the
   * whole form on submit and the one a single section runs for itself, so
   * the two can never disagree about what is wrong.
   */
  const collectSection = useCallback(
    (section: ProfileSection, found: Record<string, string>) => {
      const fields = fieldsOf(section);

      if (!section.isRepeatable) {
        for (const field of fields) {
          if (!isVisible(field, section, null, values)) continue;
          checkField(field, field.key, found, values);
        }
        return;
      }

      const shown = entryCount(section);
      if (shown < minOf(section)) {
        found[sectionKeyOf(section)] =
          minOf(section) === 1
            ? `Add at least one ${entryNoun(section).toLowerCase()}.`
            : `Add at least ${minOf(section)} of these.`;
        return;
      }

      for (let index = 0; index < shown; index++) {
        for (const field of fields) {
          if (!isVisible(field, section, index, values)) continue;
          checkField(field, storageKey(section, index, field.key), found, values);
        }
      }
    },
    [fieldsOf, entryCount, values, isVisible, checkField],
  );

  const validate = useCallback((): boolean => {
    const found: Record<string, string> = {};
    for (const section of liveSections) collectSection(section, found);

    setErrors(found);
    return Object.keys(found).length === 0;
  }, [liveSections, collectSection]);

  const validateSection = useCallback(
    (section: ProfileSection): boolean => {
      const found: Record<string, string> = {};
      collectSection(section, found);

      /* Only this section's errors are replaced. A section the applicant
         has not reached yet must not light up because they stepped out of
         this one. */
      const mine = ownsKey(section, fieldsOf(section));
      setErrors((current) => {
        const kept: Record<string, string> = {};
        for (const [key, message] of Object.entries(current)) {
          if (!mine(key)) kept[key] = message;
        }
        return { ...kept, ...found };
      });

      return Object.keys(found).length === 0;
    },
    [collectSection, fieldsOf],
  );

  /**
   * A section is done once every required question it is actually asking has
   * an answer — a conditional field that is hidden does not hold it back, and
   * neither does an optional one. A section that asks nothing but optional
   * questions is done only when they are all answered, which is the only
   * honest reading of a section with no requirements.
   */
  const progressOf = useCallback(
    (section: ProfileSection): SectionProgress => {
      const fields = fieldsOf(section);
      const entries = section.isRepeatable ? entryCount(section) : 1;

      let answered = 0;
      let total = 0;
      let required = 0;
      let requiredAnswered = 0;
      let wrong = 0;

      for (let entry = 0; entry < entries; entry++) {
        const index = section.isRepeatable ? entry : null;
        for (const field of fields) {
          if (!isVisible(field, section, index, values)) continue;

          const key = storageKey(section, index, field.key);
          const filled = isAnswered(field, values[key] ?? defaultFor(field));

          total += 1;
          if (filled) answered += 1;
          if (field.validation.required) {
            required += 1;
            if (filled) requiredAnswered += 1;
          }
          if (errors[key]) wrong += 1;
        }
      }

      if (errors[sectionKeyOf(section)]) wrong += 1;

      const complete =
        required > 0 ? requiredAnswered === required : total > 0 && answered === total;
      const status: SectionStatus =
        total === 0 || complete ? 'done' : answered > 0 ? 'progress' : 'pending';

      return { status, answered, total, wrong };
    },
    [fieldsOf, entryCount, values, errors, isVisible],
  );

  /**
   * Unpacks a stored payload back into the flat value map the fields read.
   *
   * The shapes have to agree with payload() above: a plain section stores
   * each answer under the field key, a repeating one stores an array under
   * the section key. Anything the current form no longer asks is dropped —
   * a form can be republished between the rejection and the correction, and
   * an answer to a question that has gone should not travel with it.
   */
  const prefill = useCallback(
    (responses: Record<string, unknown>) => {
      const next: FormValues = {};
      const nextCounts: Record<string, number> = {};

      for (const section of liveSections) {
        const fields = fieldsOf(section);

        if (!section.isRepeatable) {
          for (const field of fields) {
            const stored = responses[field.key];
            if (stored === undefined || stored === null) continue;
            next[field.key] = stored as FormValue;
          }
          continue;
        }

        const key = sectionKeyOf(section);
        const entries = responses[key];
        if (!Array.isArray(entries)) continue;

        nextCounts[key] = Math.max(entries.length, minOf(section), 1);

        entries.forEach((entry, index) => {
          if (!entry || typeof entry !== 'object') return;
          const row = entry as Record<string, unknown>;
          for (const field of fields) {
            const stored = row[field.key];
            if (stored === undefined || stored === null) continue;
            next[storageKey(section, index, field.key)] = stored as FormValue;
          }
        });
      }

      setValues(next);
      setErrors({});
      if (Object.keys(nextCounts).length > 0) {
        setCounts((current) => ({ ...current, ...nextCounts }));
      }
    },
    [liveSections, fieldsOf],
  );

  const payload = useCallback((): Record<string, unknown> => {
    const answerOf = (field: ProfileField, key: string): FormValue => {
      const raw = values[key] ?? defaultFor(field);
      return typeof raw === 'string' && UPPERCASE_TYPES.includes(field.type)
        ? raw.toUpperCase()
        : raw;
    };

    const result: Record<string, unknown> = {};

    for (const section of liveSections) {
      const fields = fieldsOf(section);

      if (!section.isRepeatable) {
        for (const field of fields) {
          if (!isVisible(field, section, null, values)) continue;
          result[field.key] = answerOf(field, field.key);
        }
        continue;
      }

      const entries: Record<string, FormValue>[] = [];
      for (let index = 0; index < entryCount(section); index++) {
        const entry: Record<string, FormValue> = {};
        for (const field of fields) {
          if (!isVisible(field, section, index, values)) continue;
          entry[field.key] = answerOf(field, storageKey(section, index, field.key));
        }
        entries.push(entry);
      }
      result[sectionKeyOf(section)] = entries;
    }

    return result;
  }, [liveSections, fieldsOf, entryCount, values, isVisible]);

  return {
    values,
    errors,
    setValue,
    validate,
    validateSection,
    progressOf,
    payload,
    prefill,
    entryCount,
    addEntry,
    removeEntry,
  };
}

/* ------------------------------------------------------------- renderer */

/**
 * One section of a Super Admin designed form, on its own.
 *
 * Applying used to be a single scroll through every section at once. It is
 * now a list of sections opened one at a time, so this renders the piece
 * rather than the whole — the list screen shows one of these, the sign-up
 * style all-at-once view below strings them together.
 */
export function DynamicSectionView({
  section,
  state,
  showCount = true,
}: {
  section: ProfileSection;
  state: DynamicFormState;
  /** Off where the section is the whole screen, or a one-line consent. */
  showCount?: boolean;
}) {
  const { values, errors, setValue, entryCount, addEntry, removeEntry } = state;

  /* Read here rather than beside its use further down: a section that
     does not repeat returns before that point, and a hook called after a
     return runs on some renders and not others. */
  const scope = useSubCategoryIdOrNull();

  const visible = (field: ProfileField, index: number | null): boolean => {
    if (!field.visibleWhenFieldKey) return true;
    const scoped = storageKey(section, index, field.visibleWhenFieldKey);
    const raw = scoped in values ? values[scoped] : values[field.visibleWhenFieldKey];
    const trigger = asText(raw ?? null);
    const wanted = field.visibleWhenValues ?? [];
    if (wanted.length === 0) return true;
    return wanted.some((candidate) => candidate.toLowerCase() === trigger.toLowerCase());
  };

  /**
   * The State a district field follows: the nearest one before it in
   * this section, read from this entry.
   *
   * By position rather than by a setting on the field. An address is
   * laid out State then District, and asking the designer to wire the
   * two together would be asking them to say twice what the order
   * already says.
   */
  const stateAbove = (field: ProfileField, index: number | null): number | null => {
    if (field.type !== 'district') return null;

    const live = section.fields.filter((one) => one.isEnabled);
    const mine = live.findIndex((one) => one.key === field.key);

    for (let at = mine - 1; at >= 0; at -= 1) {
      if (live[at].type !== 'state') continue;
      const held = Number(values[storageKey(section, index, live[at].key)]);
      return Number.isFinite(held) && held > 0 ? held : null;
    }
    return null;
  };

  const renderFields = (index: number | null) =>
    section.fields
      .filter((field) => field.isEnabled && visible(field, index))
      .map((field) => {
        const key = storageKey(section, index, field.key);
        return (
          <FieldRenderer
            key={key}
            field={field}
            /* Which row this is. The answers are kept under a key built
               from the section and the position; the evidence is kept on
               the server, where the field key is the same on every row,
               so the position has to travel with it. */
            entry={index ?? 0}
            value={values[key] ?? defaultFor(field)}
            error={errors[key]}
            stateAbove={stateAbove(field, index)}
            onChange={(value) => setValue(key, value)}
          />
        );
      });

  const live = section.fields.filter((field) => field.isEnabled);
  if (live.length === 0) return null;

  if (!section.isRepeatable) {
    const rendered = renderFields(null);
    if (rendered.length === 0) return null;

    return (
      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {showCount ? (
            <Chip>{rendered.length === 1 ? '1 field' : `${rendered.length} fields`}</Chip>
          ) : null}
        </View>
        {section.description ? (
          <Text style={styles.sectionDescription}>{section.description}</Text>
        ) : null}
        <View style={styles.fields}>{rendered}</View>
      </Card>
    );
  }

  const shown = entryCount(section);
  const noun = entryNoun(section);

  /**
   * Removes an entry, and what was attached to it.
   *
   * The evidence is held on the server by position, so the entry going
   * has to be dropped there and the ones above it slid down - otherwise
   * the next qualification is left showing this one's marksheet. The
   * answers move on screen without waiting for it: a press should not
   * hang on the network, and a drop that failed is corrected the next
   * time the form is opened, which re-reads what is really held.
   */
  const dropEntry = (index: number) => {
    if (scope !== null) {
      void me.dropProfileEntry(scope, sectionKeyOf(section), index).catch(() => undefined);
    }
    removeEntry(section, index);
  };
  const floor = Math.max(minOf(section), 1);
  const ceiling = maxOf(section);
  const sectionError = errors[sectionKeyOf(section)];

  return (
    <Card style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {showCount ? <Chip>{`${shown} of ${ceiling}`}</Chip> : null}
      </View>
      {section.description ? (
        <Text style={styles.sectionDescription}>{section.description}</Text>
      ) : null}

      {Array.from({ length: shown }, (_, index) => (
        <View key={index} style={styles.entry}>
          <View style={styles.entryHeader}>
            <Text style={styles.entryTitle}>{`${noun} ${index + 1}`}</Text>
            {shown > floor ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${noun.toLowerCase()} ${index + 1}`}
                hitSlop={8}
                onPress={() => dropEntry(index)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger500} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.fields}>{renderFields(index)}</View>
        </View>
      ))}

      {sectionError ? <Text style={styles.sectionError}>{sectionError}</Text> : null}

      {shown < ceiling ? (
        <Pressable
          accessibilityRole="button"
          style={styles.addEntry}
          onPress={() => addEntry(section)}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.brand600} />
          <Text style={styles.addEntryText}>{`Add more ${noun.toLowerCase()}`}</Text>
        </Pressable>
      ) : (
        <Text style={styles.sectionDescription}>
          {`You can add up to ${ceiling}.`}
        </Text>
      )}
    </Card>
  );
}

/** Every section of a form at once, for the screens that still ask that way. */
export function DynamicFormView({
  form,
  state,
}: {
  form: ProfileForm;
  state: DynamicFormState;
}) {
  return (
    <View style={styles.stack}>
      {form.sections
        .filter((section) => section.isEnabled)
        .map((section) => (
          <DynamicSectionView key={section.id} section={section} state={state} />
        ))}
    </View>
  );
}

function FieldRenderer({
  field,
  entry,
  value,
  error,
  stateAbove,
  onChange,
}: {
  field: ProfileField;
  entry: number;
  value: FormValue;
  error?: string;
  /** The LGD state answered before this field, for a district to follow. */
  stateAbove?: number | null;
  onChange: (value: FormValue) => void;
}) {
  /* The description comes with the choice. It was dropped here, which
     is why none of the controls showed one however carefully they were
     written on the form builder: the pickers had nothing to render. */
  const options = field.options.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
  }));

  switch (field.type) {
    case 'select':
      return (
        <Picker
          label={field.label}
          required={field.validation.required}
          value={typeof value === 'string' ? value : null}
          options={options}
          error={error}
          hint={field.helpText}
          onChange={onChange}
        />
      );

    case 'multiselect':
      return (
        <MultiPicker
          label={field.label}
          required={field.validation.required}
          options={options}
          values={Array.isArray(value) ? value : []}
          error={error}
          hint={field.helpText}
          onChange={onChange}
        />
      );

    case 'radio':
      return (
        <RadioGroup
          label={field.label}
          required={field.validation.required}
          options={options}
          value={typeof value === 'string' ? value : null}
          error={error}
          onChange={onChange}
        />
      );

    case 'checkbox':
      return (
        <Switch
          label={field.helpText || field.label}
          required={field.validation.required}
          checked={value === true}
          error={error}
          onChange={onChange}
        />
      );

    /* The LGD masters. A State is the national list; a District is the
       list under whichever State was answered before it in the same
       section - and, in a repeating section, the same entry. */
    case 'state':
      return (
        <PlaceField
          label={field.label}
          required={field.validation.required}
          hint={field.helpText}
          kind="state"
          value={typeof value === 'string' ? value : ''}
          stateCode={null}
          error={error}
          onChange={onChange}
        />
      );

    case 'district':
      return (
        <PlaceField
          label={field.label}
          required={field.validation.required}
          hint={field.helpText}
          kind="district"
          value={typeof value === 'string' ? value : ''}
          stateCode={stateAbove ?? null}
          error={error}
          onChange={onChange}
        />
      );

    case 'photos':
      return (
        <PhotosField
          field={field}
          entry={entry}
          value={typeof value === 'string' ? value : ''}
          error={error}
          onChange={onChange}
        />
      );

    case 'date':
      return (
        <DateField
          label={field.label}
          required={field.validation.required}
          value={typeof value === 'string' && value ? value : null}
          hint={field.helpText}
          error={error}
          minDate={field.validation.minDate}
          maxDate={field.validation.maxDate}
          onChange={onChange}
        />
      );

    case 'duration': {
      const span = spanOf(value);

      /* A to-date before the from-date is not a span. The later one moves
         to meet the earlier rather than being refused: somebody fixing
         the start of a period should not have to clear the end of it. */
      const settle = (next: DurationValue): DurationValue => {
        const fixed = { ...next };
        if (fixed.from && fixed.to && fixed.to < fixed.from) fixed.to = fixed.from;
        fixed.months = monthsBetween(fixed.from, fixed.to);
        return fixed;
      };

      return (
        <View style={styles.span}>
          <Text style={styles.spanLabel}>
            {field.label}
            {field.validation.required ? <Text style={styles.spanRequired}> *</Text> : null}
          </Text>

          <DateField
            label="From"
            value={span.from || null}
            minDate={field.validation.minDate}
            maxDate={field.validation.maxDate}
            onChange={(next) => onChange(settle({ ...span, from: next ?? '' }))}
          />
          <DateField
            label="To"
            value={span.to || null}
            minDate={span.from || field.validation.minDate}
            maxDate={field.validation.maxDate}
            error={error}
            onChange={(next) => onChange(settle({ ...span, to: next ?? '' }))}
          />

          {/* Worked out, not typed: it is a reading of the two dates above
              and changes with them. */}
          <View style={styles.spanTotal}>
            <Text style={styles.spanTotalCap}>Duration</Text>
            <Text style={styles.spanTotalWords}>
              {span.from && span.to ? spanInWords(span.from, span.to) : 'Pick both dates'}
            </Text>
          </View>

          {field.helpText ? <Text style={styles.spanHint}>{field.helpText}</Text> : null}
        </View>
      );
    }

    case 'file':
      return (
        <FileField
          field={field}
          entry={entry}
          value={typeof value === 'string' ? value : ''}
          error={error}
          onChange={onChange}
        />
      );

    case 'textarea':
      return (
        <Field
          label={field.label}
          required={field.validation.required}
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          placeholder={field.placeholder}
          hint={field.helpText}
          error={error}
          multiline
          numberOfLines={4}
          style={styles.textarea}
        />
      );

    default: {
      const upper = UPPERCASE_TYPES.includes(field.type);
      const numeric = ['number', 'mobile', 'aadhaar', 'pincode'].includes(field.type);

      return (
        <Field
          label={field.label}
          required={field.validation.required}
          value={typeof value === 'string' ? value : ''}
          onChangeText={(text) => onChange(upper ? text.toUpperCase() : text)}
          placeholder={field.placeholder}
          hint={field.helpText}
          error={error}
          autoCapitalize={upper ? 'characters' : field.type === 'email' ? 'none' : 'sentences'}
          autoCorrect={false}
          keyboardType={
            numeric ? 'number-pad' : field.type === 'email' ? 'email-address' : 'default'
          }
          maxLength={MAX_LENGTHS[field.type] ?? field.validation.maxLength ?? undefined}
        />
      );
    }
  }
}

/**
 * A State or a District, from the LGD master.
 *
 * The list is fetched rather than carried on the form: the rest of the
 * system keys off this master - an agency's empanelment, a batch's
 * venue, a coordinator's districts - and a form holding its own copy
 * would drift from all of them the first time a state was renamed. The
 * answer stored is the LGD code, so it means the same thing wherever it
 * is read.
 */
export function PlaceField({
  label,
  required,
  hint,
  kind,
  value,
  stateCode,
  error,
  onChange,
}: {
  label: string;
  required?: boolean;
  hint?: string | null;
  kind: 'state' | 'district';
  value: string;
  /** Which State's districts to offer. Null for a State field. */
  stateCode: number | null;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [places, setPlaces] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (kind === 'district' && !stateCode) {
      setPlaces([]);
      return;
    }

    (async () => {
      try {
        const held = kind === 'state'
          ? await lookups.states()
          : await lookups.districts(stateCode);

        if (cancelled) return;
        setPlaces(held.map((one) => ({ value: String(one.id), label: one.name })));
      } catch {
        /* Offline, or the master could not be read. The field shows
           nothing to choose rather than an error over a form somebody is
           part way through; the cached answer is served where there is
           one, because these calls are cached. */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, stateCode]);

  /* A district picked under one State is not a district of another, and
     leaving it there would store a pairing that does not exist. */
  useEffect(() => {
    if (kind !== 'district' || !value) return;
    if (places.length > 0 && !places.some((one) => one.value === value)) onChange('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  return (
    <Picker
      label={label}
      required={required}
      value={value || null}
      options={places}
      placeholder={
        kind === 'district' && !stateCode ? 'Choose a State first' : 'Select'
      }
      error={error}
      hint={hint}
      searchable
      onChange={onChange}
    />
  );
}

/**
 * Picks a document and records its name. The file itself is uploaded to the
 * application once it exists, which is why only the name is held here.
 */
function FileField({
  field,
  entry,
  value,
  error,
  onChange,
}: {
  field: ProfileField;
  entry: number;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const subCategoryId = useSubCategoryId();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /* What the server actually holds. The answer in the form is a copy of
     the name, and a form reopened after a rejection has to show the
     document that is really attached rather than a name with nothing
     behind it. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const held = await me.profileFile(subCategoryId, field.key, entry);
        if (!cancelled && held.fileName) onChange(held.fileName);
      } catch {
        /* Offline, or nothing attached yet. What is in the form stands. */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subCategoryId, field.key, entry]);

  const pick = async () => {
    setFailure(null);

    const extensions = field.validation.allowedExtensions ?? [];
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: extensions.length ? extensions.map(mimeFor) : '*/*',
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    /* Sent as it is chosen rather than held until the form goes. The
       field used to record the name and throw the document away, which
       looked like it had worked and had not. */
    setBusy(true);
    try {
      const held = await me.setProfileFile(
        subCategoryId,
        field.key,
        {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? 'application/octet-stream',
        },
        entry,
      );
      onChange(held.fileName ?? asset.name);
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Could not attach the file.');
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await saveAndShare(
        await me.profileFileDownload(subCategoryId, field.key, entry), field.label);
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Could not open the file.');
    } finally {
      setBusy(false);
    }
  };

  const limits = [
    field.validation.allowedExtensions?.length
      ? field.validation.allowedExtensions.join(', ').toUpperCase()
      : null,
    field.validation.maxFileSizeMb ? `up to ${field.validation.maxFileSizeMb} MB` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.fileField}>
      <Text style={styles.fileLabel}>
        {field.label}
        {field.validation.required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={pick}
        style={[styles.fileBox, !!error && styles.fileBoxInvalid]}
      >
        <Ionicons
          name={value ? 'document-text-outline' : 'cloud-upload-outline'}
          size={18}
          color={value ? colors.brand700 : colors.ink500}
        />
        <Text style={[styles.fileText, !!value && styles.fileTextChosen]} numberOfLines={1}>
          {busy ? 'Working…' : value || 'Choose a file'}
        </Text>
      </Pressable>

      {value && !busy ? (
        <View style={styles.photoRow}>
          <Pressable accessibilityRole="button" style={styles.photoAction} onPress={open}>
            <Ionicons name="eye-outline" size={16} color={colors.brand600} />
            <Text style={styles.photoActionText}>Open what is attached</Text>
          </Pressable>
        </View>
      ) : null}

      {failure ? <Text style={styles.error}>{failure}</Text> : null}
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : limits ? (
        <Text style={styles.hint}>{limits}</Text>
      ) : null}
    </View>
  );
}

/**
 * Pictures taken with the camera for one field.
 *
 * The pictures go to the server as they are taken rather than being held
 * on the device until the form is sent: a phone that runs out of battery
 * half way through a form should not cost somebody the photographs of
 * their certificates, and the server is where they have to end up anyway.
 *
 * What the answer holds is the count. That is what makes "required" mean
 * something — a field asking for pictures is answered by having taken
 * some — and the pictures themselves are fetched by field key.
 *
 * Each picture stays a picture. They used to be openable only as a single
 * PDF, which meant an applicant who wanted to check one photograph
 * downloaded a document of all of them; they are listed individually and
 * tapped to open. Where a field takes more than one, "Add another" keeps
 * appearing until the limit is reached and then stops, so the number
 * allowed is visible in the buttons rather than only in the rules.
 */
function PhotosField({
  field,
  entry,
  value,
  error,
  onChange,
}: {
  field: ProfileField;
  entry: number;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const limit = Math.min(Math.max(field.validation.maxPhotos ?? 5, 1), 20);

  const subCategoryId = useSubCategoryId();
  const [count, setCount] = useState(() => Number(value) || 0);
  const [shots, setShots] = useState<PhotoShot[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /* Not a failure: the picture was taken and kept. It is the stamp on it
     that is short of a position, and this says what to do about that. */
  const [note, setNote] = useState<string | null>(null);
  /* Bumped whenever the set changes, so a thumbnail is re-fetched rather
     than served from the cache under a url that has not changed. */
  const [stamp, setStamp] = useState(() => Date.now());
  /* Where each picture landed on disk, by its position in the set. */
  const [thumbs, setThumbs] = useState<Record<number, string>>({});

  /* What the server actually holds, which is the truth — the answer in the
     form is only a copy, and a form reopened after a rejection has to show
     the pictures that are really there. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const held = await me.photoList(subCategoryId, field.key, entry);
        if (cancelled) return;
        setShots(held);
        setCount(held.length);
        setStamp(Date.now());
        /* Nothing on the server is no answer. Writing "0" here is what made
           opening a section enough to complete it. */
        onChange(held.length > 0 ? String(held.length) : '');
      } catch {
        /* Offline, or the field is new. The local count stands. */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subCategoryId, field.key, entry]);

  /**
   * Fetches each picture and keeps it where the image loader can read it.
   *
   * Re-run whenever the set changes, which `stamp` marks: a picture
   * removed and another taken lands on the same position, and the old
   * copy on disk would otherwise be the one shown.
   */
  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];

    (async () => {
      for (const shot of shots) {
        try {
          const file = await me.photoDownload(
            subCategoryId, field.key, shot.displayOrder, entry);
          if (cancelled) return;

          const uri = await cacheImage(
            `photo-${subCategoryId}-${field.key}-${entry}-${shot.displayOrder}.jpg`,
            file,
          );
          if (cancelled) {
            releaseImage(uri);
            return;
          }

          made.push(uri);
          setThumbs((held) => ({ ...held, [shot.displayOrder]: uri }));
        } catch {
          /* One thumbnail that will not come down must not take the
             others with it; the row still says what was taken and when. */
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const uri of made) releaseImage(uri);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subCategoryId, field.key, entry, stamp, shots.length]);

  const take = async () => {
    setFailure(null);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setFailure('Allow the camera to take pictures for this field.');
      return;
    }

    const shot = await ImagePicker.launchCameraAsync({ quality: 0.6, exif: false });
    if (shot.canceled || !shot.assets?.[0]) return;

    setBusy(true);
    try {
      const asset = shot.assets[0];

      /* Asked for after the picture is in hand, not before: a fix takes a
         few seconds and nobody should wait for one with the camera open.
         It gives up on its own if there is none to be had. */
      const facts = await captureFacts();

      const standing = await me.addPhoto(
        subCategoryId,
        field.key,
        { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg' },
        facts,
        entry,
      );

      setNote(locationNote(facts));

      setCount(standing.count);
      setStamp(Date.now());
      onChange(standing.count > 0 ? String(standing.count) : '');
      void refresh();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Could not add the picture.');
    } finally {
      setBusy(false);
    }
  };

  /** Re-reads the set, so the captions under the thumbnails are current. */
  const refresh = async () => {
    try {
      const held = await me.photoList(subCategoryId, field.key, entry);
      setShots(held);
      setCount(held.length);
      setStamp(Date.now());
    } catch {
      /* The count from the write stands. */
    }
  };

  const removeLast = async () => {
    if (count === 0) return;
    setBusy(true);
    setFailure(null);
    try {
      const standing = await me.removePhoto(subCategoryId, field.key, count, entry);
      setCount(standing.count);
      setStamp(Date.now());
      onChange(standing.count > 0 ? String(standing.count) : '');
      void refresh();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Could not remove the picture.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.fileField}>
      <Text style={styles.fileLabel}>
        {field.label}
        {field.validation.required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      {count === 0 ? (
        <View style={[styles.photoBox, error ? styles.fileBoxInvalid : null]}>
          <Ionicons name="camera-outline" size={20} color={colors.ink500} />
          <Text style={styles.fileText}>
            {limit === 1 ? 'No picture yet' : `No pictures yet · up to ${limit}`}
          </Text>
        </View>
      ) : (
        /* Each picture on its own row with what it was taken at, rather
           than a strip of thumbnails that could only be opened as one
           PDF between them. Somebody who has just photographed a
           certificate wants to see that that picture came out. */
        <View style={error ? styles.fileBoxInvalid : undefined}>
          {Array.from({ length: count }, (_, i) => i + 1).map((order) => {
            const shot = shots.find((held) => held.displayOrder === order);
            return (
              <View key={`${order}-${stamp}`} style={styles.shotRow}>
                {thumbs[order] ? (
                  <Image
                    source={{ uri: thumbs[order] }}
                    style={styles.photoThumb}
                    accessibilityLabel={`${field.label}, picture ${order} of ${count}`}
                  />
                ) : (
                  /* While the bytes are on their way. An Image with no
                     source draws an empty box that looks like a picture
                     that failed, which is what this used to be. */
                  <View style={[styles.photoThumb, styles.photoThumbWaiting]}>
                    <Ionicons name="image-outline" size={18} color={colors.ink400} />
                  </View>
                )}
                <View style={styles.shotFacts}>
                  <Text style={styles.shotTitle}>{`Picture ${order} of ${limit}`}</Text>
                  {shot ? (
                    <>
                      <Text style={styles.shotDetail}>{whenTaken(shot.capturedOn)}</Text>
                      <Text style={styles.shotDetail}>
                        {shot.latitude != null && shot.longitude != null
                          ? `${shot.latitude.toFixed(6)}, ${shot.longitude.toFixed(6)}`
                          : 'Location not recorded'}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.shotDetail}>Sent</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.photoRow}>
        {/* Gone once the limit is reached, so the number allowed is plain
            from the buttons and not only from the error if you exceed it. */}
        {count < limit ? (
          <Pressable
            accessibilityRole="button"
            style={styles.photoAction}
            disabled={busy}
            onPress={take}
          >
            <Ionicons name="camera" size={16} color={colors.brand600} />
            <Text style={styles.photoActionText}>
              {busy ? 'Working…' : count === 0 ? 'Take a picture' : 'Add another'}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.photoCount}>
            {limit === 1 ? 'One picture, taken.' : `All ${limit} pictures taken.`}
          </Text>
        )}

        {count > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove the last picture"
            style={styles.photoAction}
            disabled={busy}
            onPress={removeLast}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger500} />
            <Text style={[styles.photoActionText, styles.photoRemoveText]}>Remove last</Text>
          </Pressable>
        ) : null}
      </View>

      {failure ? <Text style={styles.error}>{failure}</Text> : null}
      {/* Not red: the picture was taken and kept. This is the stamp on it
          going up without a position, and what to do if that matters. */}
      {note ? <Text style={styles.notice}>{note}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {field.helpText ? <Text style={styles.hint}>{field.helpText}</Text> : null}
    </View>
  );
}

/**
 * The time a picture was taken, as a line under its thumbnail.
 *
 * The server stamps the same instant into the image itself; this is the
 * copy that can be read without opening it. Local time, because the
 * applicant took it where they are standing.
 */
const whenTaken = (iso: string): string => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'Taken';

  return at.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const mimeFor = (extension: string): string => {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[extension.toLowerCase()] ?? '*/*';
};

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  /* Two dates and what they add up to, asked as one question. */
  span: { gap: spacing.sm },
  spanLabel: { fontSize: font.sm, fontWeight: '600', color: colors.ink700 },
  spanRequired: { color: colors.danger700 },
  spanTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.ink50,
  },
  spanTotalCap: { fontSize: font.xs, color: colors.ink500, fontWeight: '600' },
  spanTotalWords: { fontSize: font.sm, fontWeight: '700', color: colors.ink900 },
  spanHint: { fontSize: font.xs, color: colors.ink500 },
  /* Tinted rather than white: on a screen that is otherwise cards on a pale
     page, the questions being asked should read as one block and not as
     more of the page. */
  section: { gap: spacing.md, backgroundColor: colors.brand50, borderColor: colors.brand100 },
  /* The rule under a heading was a 1pt tint, which on a card that is
     itself tinted read as nothing at all, so the sections ran together.
     Brand red at 2pt actually divides them. */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.brand600,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  sectionDescription: { fontSize: font.sm, color: colors.ink500, marginTop: -4 },
  fields: { gap: spacing.lg },
  textarea: { minHeight: 96, textAlignVertical: 'top' },

  entry: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  entryTitle: { flex: 1, fontSize: font.sm, fontWeight: '700', color: colors.ink700 },
  sectionError: { fontSize: font.sm, color: colors.danger500, fontWeight: '500' },
  addEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand600,
    borderRadius: radius.md,
  },
  addEntryText: { fontSize: font.sm, fontWeight: '600', color: colors.brand600 },

  fileField: { gap: 6 },
  fileLabel: { fontSize: font.sm, fontWeight: '600', color: colors.ink700 },
  required: { color: colors.danger500 },
  fileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    backgroundColor: colors.ink50,
  },
  fileBoxInvalid: { borderColor: colors.danger500 },
  photoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    backgroundColor: colors.ink50,
  },
  photoThumb: {
    width: 72,
    height: 96,
    borderRadius: radius.sm,
    backgroundColor: colors.ink100,
    resizeMode: 'cover',
  },
  photoThumbWaiting: { alignItems: 'center', justifyContent: 'center' },

  /* One picture, with what it was taken at beside it. */
  shotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  shotFacts: { flex: 1, gap: 2 },
  shotTitle: { fontSize: font.sm, fontWeight: '600', color: colors.ink700 },
  shotDetail: { fontSize: font.xs, color: colors.ink600 },
  photoCount: { fontSize: font.sm, color: colors.ink600 },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  photoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  photoActionText: { fontSize: font.sm, fontWeight: '600', color: colors.brand600 },
  photoRemoveText: { color: colors.danger500 },
  fileText: { flex: 1, fontSize: font.sm, color: colors.ink500 },
  fileTextChosen: { color: colors.ink900, fontWeight: '500' },
  error: { fontSize: font.xs, color: colors.danger700, fontWeight: '500' },
  hint: { fontSize: font.xs, color: colors.ink500 },
  /* Said, not shouted: the picture is safe, only its stamp is short
     of a position. */
  notice: { fontSize: font.xs, color: colors.warning700, lineHeight: 17 },
});
