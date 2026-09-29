import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '../../src/api/client';
import { auth, lookups } from '../../src/api/endpoints';
import type { Gender, LookupItem, SignupField, SignupForm, SocialCategory } from '../../src/api/types';
import { GENDER_OPTIONS, SOCIAL_CATEGORY_OPTIONS } from '../../src/api/types';
import { CheckboxGroup, Picker, RadioGroup, Switch } from '../../src/components/Picker';
import { Banner, Button, Card, Field, Subtitle, Title } from '../../src/components/ui';
import { colors, font, spacing } from '../../src/theme';
import { formatErrorFor, MAX_LENGTHS, UPPERCASE_TYPES } from '../../src/validation/formats';

/**
 * Registration.
 *
 * The boxes on this screen are not written here: they are the sign-up form the
 * sub-category uses, as set up in the portal. A question switched off is not
 * asked, one somebody added is, and the order is theirs — so what an applicant
 * fills in is what the department said it should be, without a new build.
 *
 * The built-in questions still have controls of their own, because their
 * answers go into columns on the applicant record rather than into the answer
 * bag, and two of them — category and sub-category — decide which form the
 * rest of the screen is.
 */
export default function SignUp() {
  const router = useRouter();

  const [categories, setCategories] = useState<LookupItem[]>([]);
  const [subCategories, setSubCategories] = useState<LookupItem[]>([]);
  const [form, setForm] = useState<SignupForm | null>(null);
  const [loading, setLoading] = useState(true);

  /* Every answer, built-in and custom alike, kept as text under its field key.
     One bag rather than a variable each, because the screen does not know in
     advance which questions it will be asked. */
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);

  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const categoryId = values.categoryId ?? '';
  const subCategoryId = values.subCategoryId ?? '';

  const set = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    lookups
      .categories()
      .then(setCategories)
      .catch(() => setFailure('Could not load categories. Check your connection.'));
  }, []);

  /* Sub-categories follow the chosen category. */
  useEffect(() => {
    setValues((current) => ({ ...current, subCategoryId: '' }));
    if (!categoryId) {
      setSubCategories([]);
      return;
    }
    lookups
      .subCategories(Number(categoryId))
      .then(setSubCategories)
      .catch(() => setSubCategories([]));
  }, [categoryId]);

  /* And the form follows the chosen sub-category. Before one is picked this is
     the default set, which is what every sub-category without its own uses —
     so the screen is never empty and the category boxes are always there. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    auth
      .signupForm(subCategoryId ? Number(subCategoryId) : null)
      .then((next) => {
        if (cancelled) return;
        setForm(next);
        /* Answers to questions this form does not ask are dropped rather than
           carried over, so nothing is submitted that was never shown. */
        const keys = new Set(next.fields.map((field) => field.key));
        setValues((current) =>
          Object.fromEntries(
            Object.entries(current).filter(
              ([key]) => keys.has(key) || key === 'categoryId' || key === 'subCategoryId',
            ),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setFailure('Could not load the registration form. Check your connection.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subCategoryId]);

  const fields = useMemo(
    () => (form?.fields ?? []).filter((field) => field.type !== 'file'),
    [form],
  );

  const errors = useMemo(() => {
    const found: Record<string, string> = {};
    for (const field of fields) {
      const problem = errorFor(field, values[field.key] ?? '');
      if (problem) found[field.key] = problem;
    }
    return found;
  }, [fields, values]);

  /* Shown as soon as a box has been left, rather than held back until the end:
     being told at the bottom of the form that something near the top is wrong
     is the complaint this answers. */
  const showError = (key: string) =>
    attempted || touched[key] ? (errors[key] ?? null) : null;

  const submit = async () => {
    setAttempted(true);
    if (Object.keys(errors).length > 0) return;

    const answers: Record<string, string> = {};
    for (const field of fields) {
      if (field.isBuiltIn) continue;
      const value = (values[field.key] ?? '').trim();
      if (value) answers[field.key] = value;
    }

    setBusy(true);
    setFailure(null);
    try {
      const applicant = await auth.signUp({
        fullName: (values.fullName ?? '').trim(),
        email: (values.email ?? '').trim(),
        mobile: (values.mobile ?? '').trim(),
        pan: (values.pan ?? '').trim().toUpperCase(),
        gender: (values.gender || null) as Gender,
        socialCategory: (values.socialCategory || null) as SocialCategory,
        categoryId: Number(categoryId),
        subCategoryId: Number(subCategoryId),
        answers,
      });

      router.replace({
        pathname: '/(auth)/verify',
        params: { email: applicant.email, applicantCode: applicant.applicantCode },
      });
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Title>Create your account</Title>
          <Subtitle>
            We will email a verification code, then your applicant ID and password.
          </Subtitle>
        </View>

        <Card style={styles.card}>
          {fields.map((field) => (
            <View key={field.key}>
              <SignupControl
                field={field}
                value={values[field.key] ?? ''}
                error={showError(field.key)}
                categories={categories}
                subCategories={subCategories}
                categoryChosen={!!categoryId}
                onChange={(next) => set(field.key, next)}
                onBlur={() => setTouched((current) => ({ ...current, [field.key]: true }))}
              />
            </View>
          ))}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.brand600} />
              <Text style={styles.loadingText}>Loading the form…</Text>
            </View>
          ) : null}

          {failure ? <Banner tone="danger">{failure}</Banner> : null}

          <Button label="Submit" onPress={submit} loading={busy} disabled={loading} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* --------------------------------------------------------------- one box */

function SignupControl({
  field,
  value,
  error,
  categories,
  subCategories,
  categoryChosen,
  onChange,
  onBlur,
}: {
  field: SignupField;
  value: string;
  error: string | null;
  categories: LookupItem[];
  subCategories: LookupItem[];
  categoryChosen: boolean;
  onChange: (next: string) => void;
  onBlur: () => void;
}) {
  const blurAfter = (next: string) => {
    onChange(next);
    onBlur();
  };

  /* The two that decide the rest of the form, and the two the scheme reports
     reach by: their choices come from the system, not from the form. */
  switch (field.key) {
    case 'categoryId':
      return (
        <Picker
          label={field.label}
          required={field.required}
          value={value || null}
          options={categories.map((item) => ({ value: String(item.id), label: item.name }))}
          hint={field.helpText}
          error={error}
          onChange={blurAfter}
        />
      );

    case 'subCategoryId':
      return (
        <Picker
          label={field.label}
          required={field.required}
          value={value || null}
          options={subCategories.map((item) => ({ value: String(item.id), label: item.name }))}
          disabled={!categoryChosen}
          hint={categoryChosen ? field.helpText : 'Choose a category first.'}
          error={error}
          onChange={blurAfter}
        />
      );

    case 'gender':
    case 'socialCategory': {
      const declared =
        field.key === 'gender' ? GENDER_OPTIONS : SOCIAL_CATEGORY_OPTIONS;
      const options = field.options.length > 0 ? field.options : declared;
      return (
        <Picker
          label={field.label}
          required={field.required}
          value={value || null}
          options={options.map((item) => ({ value: item.value, label: item.label }))}
          hint={field.helpText}
          error={error}
          onChange={blurAfter}
        />
      );
    }
  }

  const options = field.options.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  switch (field.type) {
    case 'select':
      return (
        <Picker
          label={field.label}
          required={field.required}
          value={value || null}
          options={options}
          hint={field.helpText}
          error={error}
          onChange={blurAfter}
        />
      );

    case 'radio':
      return (
        <RadioGroup
          label={field.label}
          required={field.required}
          value={value || null}
          options={options}
          error={error}
          onChange={blurAfter}
        />
      );

    case 'multiselect':
      return (
        <CheckboxGroup
          label={field.label}
          required={field.required}
          options={options}
          values={value ? value.split(',') : []}
          error={error}
          onChange={(next) => blurAfter(next.join(','))}
        />
      );

    case 'checkbox':
      return (
        <Switch
          label={field.helpText || field.label}
          required={field.required}
          checked={value === 'true'}
          error={error}
          onChange={(next) => blurAfter(next ? 'true' : '')}
        />
      );

    case 'textarea':
      return (
        <Field
          label={field.label}
          required={field.required}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          placeholder={field.placeholder ?? undefined}
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
          required={field.required}
          value={value}
          onChangeText={(text) => onChange(upper ? text.toUpperCase() : text)}
          onBlur={onBlur}
          placeholder={field.placeholder ?? (field.type === 'date' ? 'YYYY-MM-DD' : undefined)}
          hint={field.helpText}
          error={error}
          autoCapitalize={
            upper ? 'characters' : field.type === 'email' ? 'none' : 'sentences'
          }
          autoCorrect={false}
          keyboardType={
            numeric ? 'number-pad' : field.type === 'email' ? 'email-address' : 'default'
          }
          maxLength={MAX_LENGTHS[field.type] ?? undefined}
        />
      );
    }
  }
}

/** The same rules the API applies, so the applicant hears them first. */
function errorFor(field: SignupField, raw: string): string | null {
  const value = raw.trim();

  if (value.length === 0) {
    if (!field.required) return null;
    return field.type === 'select' || field.type === 'radio' || field.options.length > 0
      ? `Select ${field.label.toLowerCase()}.`
      : `${field.label} is required.`;
  }

  return formatErrorFor(field.type, value);
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { gap: 2 },
  card: { gap: spacing.lg },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  loadingText: { fontSize: font.sm, color: colors.ink500 },
});
