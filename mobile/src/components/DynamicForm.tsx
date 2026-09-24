import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RegistrationField, RegistrationForm } from '../api/types';
import { colors, font, radius, spacing } from '../theme';
import { MAX_LENGTHS, UPPERCASE_TYPES, formatErrorFor } from '../validation/formats';
import { Card, Chip, Field } from './ui';
import { CheckboxGroup, Picker, RadioGroup, Switch } from './Picker';

export type FormValue = string | string[] | boolean | null;
export type FormValues = Record<string, FormValue>;

/** Everything the caller needs back from the renderer. */
export interface DynamicFormState {
  values: FormValues;
  errors: Record<string, string>;
  setValue: (key: string, value: FormValue) => void;
  validate: () => boolean;
  /** Answers shaped the way the API expects them. */
  payload: () => Record<string, unknown>;
}

function defaultFor(field: RegistrationField): FormValue {
  if (field.type === 'multiselect') return [];
  if (field.type === 'checkbox') return false;
  return '';
}

const asText = (value: FormValue): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(',');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value;
};

/**
 * Holds the answers for a Super Admin designed form and validates them with the
 * same rules the API enforces, so the applicant is corrected before they submit.
 */
export function useDynamicForm(form: RegistrationForm | null): DynamicFormState {
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const liveFields = useMemo(
    () =>
      (form?.sections ?? [])
        .filter((section) => section.isEnabled)
        .flatMap((section) => section.fields.filter((field) => field.isEnabled)),
    [form],
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

  /** A conditional field only counts when its trigger answer matches. */
  const isVisible = useCallback(
    (field: RegistrationField, source: FormValues): boolean => {
      if (!field.visibleWhenFieldKey) return true;
      const trigger = asText(source[field.visibleWhenFieldKey] ?? null);
      const wanted = field.visibleWhenValues ?? [];
      if (wanted.length === 0) return true;
      return wanted.some((candidate) => candidate.toLowerCase() === trigger.toLowerCase());
    },
    [],
  );

  const validate = useCallback((): boolean => {
    const found: Record<string, string> = {};

    for (const field of liveFields) {
      if (!isVisible(field, values)) continue;

      const raw = values[field.key] ?? defaultFor(field);
      const text = asText(raw);
      const empty = Array.isArray(raw) ? raw.length === 0 : text.trim() === '' || text === 'false';

      if (field.validation.required && empty) {
        found[field.key] = `${field.label} is required.`;
        continue;
      }
      if (empty) continue;

      const formatError = formatErrorFor(field.type, text);
      if (formatError) {
        found[field.key] = formatError;
        continue;
      }

      const { minLength, maxLength, min, max, pattern } = field.validation;
      if (minLength && text.length < minLength) {
        found[field.key] = `Minimum ${minLength} characters.`;
      } else if (maxLength && text.length > maxLength) {
        found[field.key] = `Maximum ${maxLength} characters.`;
      } else if (field.type === 'number' && (min !== null || max !== null)) {
        const numeric = Number(text);
        if (Number.isNaN(numeric)) found[field.key] = 'Enter a number.';
        else if (min !== null && min !== undefined && numeric < min) {
          found[field.key] = `Minimum value is ${min}.`;
        } else if (max !== null && max !== undefined && numeric > max) {
          found[field.key] = `Maximum value is ${max}.`;
        }
      } else if (pattern) {
        try {
          if (!new RegExp(pattern).test(text)) {
            found[field.key] = `Enter a valid ${field.label.toLowerCase()}.`;
          }
        } catch {
          /* A bad pattern on the definition must not block the applicant. */
        }
      }
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  }, [liveFields, values, isVisible]);

  const payload = useCallback((): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const field of liveFields) {
      if (!isVisible(field, values)) continue;
      const raw = values[field.key] ?? defaultFor(field);
      result[field.key] =
        typeof raw === 'string' && UPPERCASE_TYPES.includes(field.type)
          ? raw.toUpperCase()
          : raw;
    }
    return result;
  }, [liveFields, values, isVisible]);

  return { values, errors, setValue, validate, payload };
}

/* ------------------------------------------------------------- renderer */

export function DynamicFormView({
  form,
  state,
}: {
  form: RegistrationForm;
  state: DynamicFormState;
}) {
  const { values, errors, setValue } = state;

  const visible = (field: RegistrationField): boolean => {
    if (!field.visibleWhenFieldKey) return true;
    const trigger = asText(values[field.visibleWhenFieldKey] ?? null);
    const wanted = field.visibleWhenValues ?? [];
    if (wanted.length === 0) return true;
    return wanted.some((candidate) => candidate.toLowerCase() === trigger.toLowerCase());
  };

  return (
    <View style={styles.stack}>
      {form.sections
        .filter((section) => section.isEnabled)
        .map((section) => {
          const fields = section.fields.filter((field) => field.isEnabled && visible(field));
          if (fields.length === 0) return null;

          return (
            <Card key={section.id} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Chip>{`${fields.length} fields`}</Chip>
              </View>
              {section.description ? (
                <Text style={styles.sectionDescription}>{section.description}</Text>
              ) : null}

              <View style={styles.fields}>
                {fields.map((field) => (
                  <FieldRenderer
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? defaultFor(field)}
                    error={errors[field.key]}
                    onChange={(value) => setValue(field.key, value)}
                  />
                ))}
              </View>
            </Card>
          );
        })}
    </View>
  );
}

function FieldRenderer({
  field,
  value,
  error,
  onChange,
}: {
  field: RegistrationField;
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
  field: RegistrationField;
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
  section: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  sectionDescription: { fontSize: font.sm, color: colors.ink500, marginTop: -6 },
  fields: { gap: spacing.lg },
  textarea: { minHeight: 96, textAlignVertical: 'top' },

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
