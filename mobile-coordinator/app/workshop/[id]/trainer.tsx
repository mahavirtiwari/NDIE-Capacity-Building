import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { photos, trainers as trainersApi, type CapturedImage } from '../../../src/api/endpoints';
import { Banner, Button, Card, Field, KeyboardAvoider } from '../../../src/components/ui';
import { PhotoPicker } from '../../../src/components/PhotoPicker';
import { useGeoFix } from '../../../src/location/useGeoFix';
import { isAadhaar, isEmail, isMobile } from '../../../src/validation/formats';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Register the trainers taking this workshop.
 *
 * More than one is normal — a session each — so the screen lists those already
 * registered above the form rather than replacing itself after a save.
 *
 * What is asked for is what the scheme pays and certifies against: who they
 * are, how to reach them, what they studied and how long they have been doing
 * it, their Aadhaar, and two photographs — the trainer, and whatever identity
 * document they produced. Designation, engagement and organisation were asked
 * for and are not any more: none of the three decided anything, and three
 * fields nobody reads are three chances to mistype something at a venue.
 */
export default function RegisterTrainer() {
  const { id, detail, refresh, locked } = useWorkshop();
  const registered = detail?.trainers ?? [];
  const geo = useGeoFix();

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [qualification, setQualification] = useState('');
  const [qualificationDetails, setQualificationDetails] = useState('');
  const [years, setYears] = useState('');
  const [months, setMonths] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [photo, setPhoto] = useState<CapturedImage | null>(null);
  const [idProof, setIdProof] = useState<CapturedImage | null>(null);

  /* The ladder from the masters, so the register does not collect
     "Post Graduate", "PG" and "Post-graduate" as three answers to one
     question. Fetched once; an empty list leaves the field free text
     rather than blocking the form on a lookup. */
  const [qualifications, setQualifications] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const found: Record<string, string> = {};
    if (!fullName.trim()) found.fullName = 'Trainer name is required.';
    if (!mobile.trim()) found.mobile = 'Mobile is required.';
    else if (!isMobile(mobile)) found.mobile = 'Enter a 10 digit number starting with 6-9.';
    if (email.trim() && !isEmail(email)) found.email = 'Enter a valid email address.';
    if (aadhaar.trim() && !isAadhaar(aadhaar)) found.aadhaar = 'Enter the 12 digit number.';

    if (years.trim() && !/^\d{1,2}$/.test(years.trim())) found.experience = 'Years, as a number.';
    if (months.trim() && !/^\d{1,2}$/.test(months.trim())) {
      found.experience = 'Months, as a number.';
    } else if (months.trim() && Number(months.trim()) > 11) {
      /* Twelve months is a year, and the field above it is for years. */
      found.experience = 'Months must be 11 or fewer.';
    }

    /* Asked for only where a level was picked: a details box under
       nothing is a question about nothing. */
    if (qualification.trim() && !qualificationDetails.trim()) {
      found.qualificationDetails = 'Say what the qualification is in.';
    }

    if (!photo) found.photo = "The trainer's photograph is required.";
    if (!idProof) found.idProof = 'A photograph of the ID proof is required.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      /* The trainer first, because the photographs hang off the row the
         server creates. */
      const saved = await trainersApi.add(id, {
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        qualification: qualification.trim() || undefined,
        qualificationDetails: qualificationDetails.trim() || undefined,
        yearsExperience: years.trim() ? Number(years.trim()) : undefined,
        experienceMonths: months.trim() ? Number(months.trim()) : undefined,
        aadhaar: aadhaar.trim() || undefined,
      });

      if (photo) await photos.trainer(id, saved.id, 'photo', photo, geo.fix);
      if (idProof) await photos.trainer(id, saved.id, 'idproof', idProof, geo.fix);

      await refresh();
      setFullName('');
      setMobile('');
      setEmail('');
      setQualification('');
      setQualificationDetails('');
      setYears('');
      setMonths('');
      setAadhaar('');
      setPhoto(null);
      setIdProof(null);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not add the trainer.');
    } finally {
      setBusy(false);
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
              </View>
            ))}
          </Card>
        ) : null}

        {!locked ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Add a trainer</Text>

            <Field
              label="Full name"
              required
              value={fullName}
              onChangeText={setFullName}
              placeholder="Trainer's name"
              autoCapitalize="words"
              error={errors.fullName}
            />
            <Field
              label="Mobile"
              required
              value={mobile}
              onChangeText={setMobile}
              placeholder="Enter mobile number"
              keyboardType="number-pad"
              maxLength={10}
              error={errors.mobile}
            />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
            />

            {/* The ladder from the masters where it loaded, typing where
                it did not: a coordinator in a basement should not be
                stopped from registering a trainer by a lookup. */}
            {qualifications.length > 0 ? (
              <View style={styles.group}>
                <Text style={styles.groupLabel}>Qualification</Text>
                <View style={styles.choices}>
                  {qualifications.map((value) => (
                    <Pressable
                      key={value}
                      style={[styles.choice, qualification === value && styles.choiceOn]}
                      onPress={() => setQualification(qualification === value ? '' : value)}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          qualification === value && styles.choiceTextOn,
                        ]}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <Field
                label="Qualification"
                value={qualification}
                onChangeText={setQualification}
                placeholder="e.g. Post Graduate"
              />
            )}

            {/* Asked as soon as a level is picked. "Graduation" says
                almost nothing about somebody about to teach a syllabus;
                the subject, the institution and the year do. */}
            {qualification.trim() ? (
              <Field
                label={`${qualification} — details`}
                required
                value={qualificationDetails}
                onChangeText={setQualificationDetails}
                placeholder="Subject, institution and year"
                error={errors.qualificationDetails}
              />
            ) : null}

            <View style={styles.group}>
              <Text style={styles.groupLabel}>Experience</Text>
              <View style={styles.span}>
                <View style={styles.spanHalf}>
                  <Field
                    label="Years"
                    value={years}
                    onChangeText={setYears}
                    placeholder="e.g. 12"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <View style={styles.spanHalf}>
                  <Field
                    label="Months"
                    value={months}
                    onChangeText={setMonths}
                    placeholder="0 – 11"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>
              {errors.experience ? <Banner tone="danger">{errors.experience}</Banner> : null}
            </View>

            <Field
              label="Aadhaar"
              value={aadhaar}
              onChangeText={setAadhaar}
              placeholder="12 digit number"
              keyboardType="number-pad"
              maxLength={12}
              error={errors.aadhaar}
            />

            <PhotoPicker
              label="Trainer photo"
              required
              hint="The trainer, taken here."
              value={photo}
              onPick={setPhoto}
              onClear={() => setPhoto(null)}
            />
            {errors.photo ? <Banner tone="danger">{errors.photo}</Banner> : null}

            <PhotoPicker
              label="ID proof"
              required
              hint="Whatever identity document they produced, readable in the shot."
              value={idProof}
              onPick={setIdProof}
              onClear={() => setIdProof(null)}
            />
            {errors.idProof ? <Banner tone="danger">{errors.idProof}</Banner> : null}

            {failure ? <Banner tone="danger">{failure}</Banner> : null}

            <Button label="Add trainer" onPress={add} loading={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}

/** "12 yrs 6 mo", or whichever half was given. */
function experienceWords(years?: number | null, months?: number | null): string | null {
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (months) parts.push(`${months} mo`);
  return parts.length > 0 ? parts.join(' ') : null;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  card: { gap: spacing.lg },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink900 },

  trainer: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  trainerName: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  trainerMeta: { fontSize: 12, color: colors.ink500 },

  group: { gap: spacing.sm },
  groupLabel: { fontSize: 14, fontWeight: '600', color: colors.ink800 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  choiceOn: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  choiceText: { fontSize: 13, fontWeight: '600', color: colors.ink700 },
  choiceTextOn: { color: colors.white },

  /* Years and months side by side: they are one answer, and stacking
     them reads as two separate questions. */
  span: { flexDirection: 'row', gap: spacing.md },
  spanHalf: { flex: 1 },
});
