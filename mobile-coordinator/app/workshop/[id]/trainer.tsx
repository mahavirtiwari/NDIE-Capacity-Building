import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import {
  photos,
  trainers as trainersApi,
  type CapturedImage,
} from '../../../src/api/endpoints';
import type { TrainerField } from '../../../src/api/types';
import { Banner, Button, Card, Field, KeyboardAvoider } from '../../../src/components/ui';
import { PhotoPicker } from '../../../src/components/PhotoPicker';
import { useGeoFix } from '../../../src/location/useGeoFix';
import { isAadhaar, isEmail, isMobile } from '../../../src/validation/formats';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Register the trainers taking this workshop.
 *
 * More than one is normal — a session each — so the screen lists those
 * already registered above the form rather than replacing itself after a
 * save.
 *
 * What is asked is no longer decided here. The questions are set up in the
 * portal, under Trainer form, and this screen draws what it is sent: the
 * fields that are switched on, in the order they were put in, each marked
 * required or not as the office decided. A scheme that wants an
 * empanelment number next month gets it next month, rather than in the
 * release after somebody rebuilds this file.
 *
 * The built-in fields keep the handling they earned — a qualification is
 * picked off the ladder from the masters, experience is two numbers, a
 * photograph is taken with the camera and never chosen from the gallery.
 * Anything the office adds is drawn from its type.
 */
export default function RegisterTrainer() {
  const { id, detail, refresh, locked } = useWorkshop();
  const registered = detail?.trainers ?? [];
  const geo = useGeoFix();

  /* The form, and what this build asked before there was one.

     The fallback matters: a coordinator opens this in a hall with no
     signal, and a screen that cannot reach the server should still be
     the screen they had yesterday rather than a blank card. */
  const [form, setForm] = useState<TrainerField[]>(SHIPPED);

  const [values, setValues] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<CapturedImage | null>(null);
  const [idProof, setIdProof] = useState<CapturedImage | null>(null);

  /* The ladder from the masters, so the register does not collect
     "Post Graduate", "PG" and "Post-graduate" as three answers to one
     question. An empty list leaves the field free text rather than
     blocking the form on a lookup. */
  const [qualifications, setQualifications] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fields = await trainersApi.form();
        if (!cancelled && fields.length > 0) setForm(fields);
      } catch {
        /* Offline, or an older server. What this build shipped with
           stands, and the server has the last word on it either way. */
      }

      try {
        const list = await trainersApi.qualifications();
        if (!cancelled) setQualifications(list);
      } catch {
        /* Offline, or nothing configured. The field still accepts typing. */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const asked = useMemo(() => new Set(form.map((f) => f.key)), [form]);
  const set = (key: string, text: string) =>
    setValues((held) => ({ ...held, [key]: text }));
  const value = (key: string) => values[key] ?? '';

  const labelOf = (key: string, fallback: string) =>
    form.find((f) => f.key === key)?.label ?? fallback;

  const add = async () => {
    const found: Record<string, string> = {};

    for (const field of form) {
      const given = value(field.key).trim();

      if (field.required && !given) {
        /* The photographs are checked below: they are not text, and one
           that has not been taken is not an empty box. */
        if (field.key !== 'photo' && field.key !== 'idProof') {
          found[field.key] = `${field.label} is required.`;
          continue;
        }
      }

      if (!given) continue;

      /* The formats, where the field is one the scheme knows. */
      if (field.key === 'mobile' && !isMobile(given)) {
        found.mobile = 'Enter a 10 digit number starting with 6-9.';
      }
      if (field.key === 'email' && !isEmail(given)) {
        found.email = 'Enter a valid email address.';
      }
      if (field.key === 'aadhaar' && !isAadhaar(given)) {
        found.aadhaar = 'Enter the 12 digit number.';
      }
      if (field.type === 'email' && !field.isBuiltIn && !isEmail(given)) {
        found[field.key] = 'Enter a valid email address.';
      }
      if (field.type === 'mobile' && !field.isBuiltIn && !isMobile(given)) {
        found[field.key] = 'Enter a 10 digit number starting with 6-9.';
      }
      if (field.type === 'number' && !/^\d+$/.test(given)) {
        found[field.key] = `${field.label} is a number.`;
      }
    }

    /* Experience is one question asked as two numbers. */
    if (asked.has('experience')) {
      const years = value('experienceYears').trim();
      const months = value('experienceMonths').trim();
      const needed = form.find((f) => f.key === 'experience')?.required ?? false;

      if (needed && !years && !months) {
        found.experience = `${labelOf('experience', 'Experience')} is required.`;
      } else if (years && !/^\d{1,2}$/.test(years)) {
        found.experience = 'Years, as a number.';
      } else if (months && !/^\d{1,2}$/.test(months)) {
        found.experience = 'Months, as a number.';
      } else if (months && Number(months) > 11) {
        /* Twelve months is a year, and the field beside it is for years. */
        found.experience = 'Months must be 11 or fewer.';
      }
    }

    /* Asked for only where a level was picked: a details box under
       nothing is a question about nothing. */
    if (
      asked.has('qualificationDetails')
      && value('qualification').trim()
      && !value('qualificationDetails').trim()
    ) {
      found.qualificationDetails = 'Say what the qualification is in.';
    }

    const photoField = form.find((f) => f.key === 'photo');
    const idField = form.find((f) => f.key === 'idProof');

    if (photoField?.required && !photo) {
      found.photo = `${photoField.label} is required.`;
    }
    if (idField?.required && !idProof) {
      found.idProof = `${idField.label} is required.`;
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);

    try {
      /* Everything the office added beyond the columns, by key. */
      const answers: Record<string, string> = {};
      for (const field of form) {
        if (field.isBuiltIn) continue;
        const given = value(field.key).trim();
        if (given) answers[field.key] = given;
      }

      /* The trainer first, because the photographs hang off the row the
         server creates. */
      const saved = await trainersApi.add(id, {
        fullName: value('fullName').trim(),
        mobile: value('mobile').trim(),
        email: value('email').trim() || undefined,
        qualification: value('qualification').trim() || undefined,
        qualificationDetails: value('qualificationDetails').trim() || undefined,
        yearsExperience: value('experienceYears').trim()
          ? Number(value('experienceYears').trim())
          : undefined,
        experienceMonths: value('experienceMonths').trim()
          ? Number(value('experienceMonths').trim())
          : undefined,
        aadhaar: value('aadhaar').trim() || undefined,
        answers,
      });

      if (photo) await photos.trainer(id, saved.id, 'photo', photo, geo.fix);
      if (idProof) await photos.trainer(id, saved.id, 'idproof', idProof, geo.fix);

      await refresh();
      setValues({});
      setPhoto(null);
      setIdProof(null);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not add the trainer.');
    } finally {
      setBusy(false);
    }
  };

  /** One field, drawn as what it is. */
  const draw = (field: TrainerField) => {
    const common = {
      label: field.label,
      required: field.required,
      error: errors[field.key],
      hint: field.helpText ?? undefined,
    };

    switch (field.key) {
      case 'qualification':
        return qualifications.length > 0 ? (
          <View key={field.key} style={styles.group}>
            <Text style={styles.groupLabel}>
              {field.label}
              {field.required ? <Text style={styles.required}> *</Text> : null}
            </Text>
            <View style={styles.choices}>
              {qualifications.map((one) => (
                <Pressable
                  key={one}
                  style={[styles.choice, value('qualification') === one && styles.choiceOn]}
                  onPress={() => set('qualification', value('qualification') === one ? '' : one)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      value('qualification') === one && styles.choiceTextOn,
                    ]}
                  >
                    {one}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.qualification ? <Banner tone="danger">{errors.qualification}</Banner> : null}
          </View>
        ) : (
          <Field
            key={field.key}
            {...common}
            value={value('qualification')}
            onChangeText={(text) => set('qualification', text)}
            placeholder={field.placeholder ?? 'e.g. Post Graduate'}
          />
        );

      case 'qualificationDetails':
        /* Asked as soon as a level is picked. "Graduation" says almost
           nothing about somebody about to teach a syllabus; the subject,
           the institution and the year do. */
        if (!value('qualification').trim()) return null;
        return (
          <Field
            key={field.key}
            {...common}
            label={`${value('qualification')} — details`}
            required
            value={value('qualificationDetails')}
            onChangeText={(text) => set('qualificationDetails', text)}
            placeholder={field.placeholder ?? 'Subject, institution and year'}
          />
        );

      case 'experience':
        return (
          <View key={field.key} style={styles.group}>
            <Text style={styles.groupLabel}>
              {field.label}
              {field.required ? <Text style={styles.required}> *</Text> : null}
            </Text>
            <View style={styles.span}>
              <View style={styles.spanHalf}>
                <Field
                  label="Years"
                  value={value('experienceYears')}
                  onChangeText={(text) => set('experienceYears', text)}
                  placeholder="e.g. 12"
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={styles.spanHalf}>
                <Field
                  label="Months"
                  value={value('experienceMonths')}
                  onChangeText={(text) => set('experienceMonths', text)}
                  placeholder="0 – 11"
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
            {errors.experience ? <Banner tone="danger">{errors.experience}</Banner> : null}
          </View>
        );

      case 'photo':
      case 'idProof': {
        const held = field.key === 'photo' ? photo : idProof;
        const keep = field.key === 'photo' ? setPhoto : setIdProof;
        return (
          <View key={field.key}>
            <PhotoPicker
              label={field.label}
              required={field.required}
              hint={field.helpText ?? undefined}
              value={held}
              onPick={keep}
              onClear={() => keep(null)}
            />
            {errors[field.key] ? <Banner tone="danger">{errors[field.key]}</Banner> : null}
          </View>
        );
      }

      default:
        return (
          <Field
            key={field.key}
            {...common}
            value={value(field.key)}
            onChangeText={(text) => set(field.key, text)}
            placeholder={field.placeholder ?? undefined}
            keyboardType={
              field.type === 'mobile' || field.type === 'number' || field.type === 'aadhaar'
                ? 'number-pad'
                : field.type === 'email'
                  ? 'email-address'
                  : 'default'
            }
            autoCapitalize={
              field.type === 'email' ? 'none' : field.key === 'fullName' ? 'words' : 'sentences'
            }
            maxLength={field.type === 'aadhaar' ? 12 : field.type === 'mobile' ? 10 : undefined}
          />
        );
    }
  };

  return (
    <KeyboardAvoider style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {locked ? <Banner tone="info">Finally submitted — read only.</Banner> : null}

        {registered.length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Registered ({registered.length})</Text>
            {registered.map((trainer) => (
              <View key={trainer.id} style={styles.trainer}>
                <Text style={styles.trainerName}>{trainer.fullName}</Text>
                <Text style={styles.trainerMeta}>
                  {[
                    trainer.qualification,
                    experienceWords(trainer.yearsExperience, trainer.experienceMonths),
                    trainer.mobile,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {trainer.qualificationDetails ? (
                  <Text style={styles.trainerMeta}>{trainer.qualificationDetails}</Text>
                ) : null}
                {/* What the office added, under what it was asked. */}
                {(trainer.answers ?? []).map((answer) => (
                  <Text key={answer.key} style={styles.trainerMeta}>
                    {answer.label}: {answer.value}
                  </Text>
                ))}
              </View>
            ))}
          </Card>
        ) : null}

        {!locked ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Add a trainer</Text>

            {form.map(draw)}

            {failure ? <Banner tone="danger">{failure}</Banner> : null}

            <Button label="Add trainer" onPress={add} loading={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}

/**
 * What this build asks when it cannot reach the server.
 *
 * The form as it stood when it became configurable, which is what the
 * screen asked before. A handset with no signal registers a trainer the
 * way it did yesterday, and the server checks the real form when the
 * work drains.
 */
const SHIPPED: TrainerField[] = [
  f('fullName', 'Full name', 'text', true, "As it should appear on the record"),
  f('mobile', 'Mobile', 'mobile', true, 'Enter mobile number'),
  f('email', 'Email', 'email', false, 'Enter email address'),
  f('qualification', 'Qualification', 'select', false),
  f('qualificationDetails', 'Qualification details', 'text', false),
  f('experience', 'Experience', 'duration', false),
  f('aadhaar', 'Aadhaar', 'aadhaar', false, '12 digit number'),
  f('photo', 'Trainer photo', 'photos', true, undefined, 'The trainer, taken here.'),
  f('idProof', 'ID proof', 'photos', true, undefined,
    'Whatever identity document they produced, readable in the shot.'),
];

function f(
  key: string,
  label: string,
  type: string,
  required: boolean,
  placeholder?: string,
  helpText?: string,
): TrainerField {
  return {
    id: 0,
    key,
    label,
    placeholder,
    helpText,
    type,
    required,
    displayOrder: 0,
    isBuiltIn: true,
    isLocked: key === 'fullName' || key === 'mobile',
    status: 'Active',
    options: [],
  };
}

/** "12 yrs 6 mo", or nothing where neither was given. */
function experienceWords(years?: number | null, months?: number | null): string {
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (months) parts.push(`${months} mo`);
  return parts.join(' ');
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink900 },
  required: { color: colors.danger700 },

  trainer: { backgroundColor: colors.ink50, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  trainerName: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  trainerMeta: { fontSize: 12, color: colors.ink500 },

  group: { gap: spacing.xs },
  groupLabel: { fontSize: 14, fontWeight: '600', color: colors.ink800 },

  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  choiceOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  choiceText: { fontSize: 13, color: colors.ink700 },
  choiceTextOn: { color: colors.white, fontWeight: '600' },

  span: { flexDirection: 'row', gap: spacing.md },
  spanHalf: { flex: 1 },
});
