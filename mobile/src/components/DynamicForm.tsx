import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProfileField, ProfileForm, ProfileSection } from '../api/types';
import { colors, font, radius, spacing } from '../theme';
import { MAX_LENGTHS, UPPERCASE_TYPES, formatErrorFor } from '../validation/formats';
import { Card, Chip, Field } from './ui';
import { CheckboxGroup, Picker, RadioGroup, Switch } from './Picker';

export type FormValue = string | string[] | boolean | null;
export type FormValues = Record<string, FormValue>;

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
  return '';
}

/**
 * Whether an answer is still missing. The same test the validator applies to
 * a required field, so a section cannot read as completed while the check
 * that runs on submit would fail it.
 */
function isBlank(raw: FormValue): boolean {
  if (Array.isArray(raw)) return raw.length === 0;
  if (typeof raw === 'boolean') return !raw;
  return (raw ?? '').trim() === '';
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
      const empty = Array.isArray(raw) ? raw.length === 0 : text.trim() === '' || text === 'false';

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
          const filled = !isBlank(values[key] ?? defaultFor(field));

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

  const visible = (field: ProfileField, index: number | null): boolean => {
    if (!field.visibleWhenFieldKey) return true;
    const scoped = storageKey(section, index, field.visibleWhenFieldKey);
    const raw = scoped in values ? values[scoped] : values[field.visibleWhenFieldKey];
    const trigger = asText(raw ?? null);
    const wanted = field.visibleWhenValues ?? [];
    if (wanted.length === 0) return true;
    return wanted.some((candidate) => candidate.toLowerCase() === trigger.toLowerCase());
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
            value={values[key] ?? defaultFor(field)}
            error={errors[key]}
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
                onPress={() => removeEntry(section, index)}
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
  value,
  error,
  onChange,
}: {
  field: ProfileField;
  value: FormValue;
  error?: string;
  onChange: (value: FormValue) => void;
}) {
  const options = field.options.map((option) => ({
    value: option.value,
    label: option.label,
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
        <CheckboxGroup
          label={field.label}
          required={field.validation.required}
          options={options}
          values={Array.isArray(value) ? value : []}
          error={error}
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

    case 'file':
      return (
        <FileField
          field={field}
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
          placeholder={field.placeholder ?? (field.type === 'date' ? 'YYYY-MM-DD' : undefined)}
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
 * Picks a document and records its name. The file itself is uploaded to the
 * application once it exists, which is why only the name is held here.
 */
function FileField({
  field,
  value,
  error,
  onChange,
}: {
  field: ProfileField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setBusy(true);
    try {
      const extensions = field.validation.allowedExtensions ?? [];
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: extensions.length ? extensions.map(mimeFor) : '*/*',
      });
      if (!result.canceled && result.assets[0]) onChange(result.assets[0].name);
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
          {busy ? 'Opening…' : value || 'Choose a file'}
        </Text>
      </Pressable>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : limits ? (
        <Text style={styles.hint}>{limits}</Text>
      ) : null}
    </View>
  );
}

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
  /* Tinted rather than white: on a screen that is otherwise cards on a pale
     page, the questions being asked should read as one block and not as
     more of the page. */
  section: { gap: spacing.md, backgroundColor: colors.brand50, borderColor: colors.brand100 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand100,
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
  fileText: { flex: 1, fontSize: font.sm, color: colors.ink500 },
  fileTextChosen: { color: colors.ink900, fontWeight: '500' },
  error: { fontSize: font.xs, color: colors.danger700, fontWeight: '500' },
  hint: { fontSize: font.xs, color: colors.ink500 },
});
