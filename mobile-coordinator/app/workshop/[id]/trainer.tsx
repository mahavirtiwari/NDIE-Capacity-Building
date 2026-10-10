import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { trainers as trainersApi } from '../../../src/api/endpoints';
import { Banner, Button, Card, Field, KeyboardAvoider } from '../../../src/components/ui';
import { isAadhaar, isEmail, isMobile } from '../../../src/validation/formats';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * Register the trainers taking this workshop.
 *
 * More than one is normal — a session each — so the screen lists those already
 * registered above the form rather than replacing itself after a save.
 */
export default function RegisterTrainer() {
  const { id, detail, refresh, locked } = useWorkshop();
  const registered = detail?.trainers ?? [];

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [engagement, setEngagement] = useState<'FullTime' | 'PartTime' | ''>('');
  const [experience, setExperience] = useState('');
  const [qualification, setQualification] = useState('');
  const [aadhaar, setAadhaar] = useState('');

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
    if (experience.trim() && !/^\d{1,2}$/.test(experience.trim())) {
      found.experience = 'Enter the number of years.';
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      await trainersApi.add(id, {
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        designation: designation.trim() || undefined,
        organisation: organisation.trim() || undefined,
        engagement: engagement || undefined,
        yearsExperience: experience.trim() ? Number(experience.trim()) : undefined,
        qualification: qualification.trim() || undefined,
        aadhaar: aadhaar.trim() || undefined,
      });
      await refresh();
      setFullName('');
      setMobile('');
      setEmail('');
      setDesignation('');
      setOrganisation('');
      setEngagement('');
      setExperience('');
      setQualification('');
      setAadhaar('');
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
                    trainer.designation,
                    trainer.organisation,
                    trainer.qualification,
                    trainer.engagement === 'FullTime'
                      ? 'Full time'
                      : trainer.engagement === 'PartTime'
                        ? 'Part time'
                        : null,
                    trainer.yearsExperience != null ? `${trainer.yearsExperience} yrs` : null,
                    trainer.mobile,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
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
            <Field
              label="Designation"
              value={designation}
              onChangeText={setDesignation}
              placeholder="e.g. Master Trainer"
            />
            {/* Two buttons rather than a dropdown: there are exactly two
                answers and a picker for two answers is a tap wasted. */}
            <View style={styles.group}>
              <Text style={styles.groupLabel}>Engagement</Text>
              <View style={styles.choices}>
                {([
                  ['FullTime', 'Full time'],
                  ['PartTime', 'Part time'],
                ] as const).map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={[styles.choice, engagement === value && styles.choiceOn]}
                    onPress={() => setEngagement(engagement === value ? '' : value)}
                  >
                    <Text
                      style={[styles.choiceText, engagement === value && styles.choiceTextOn]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Field
              label="Years of experience"
              value={experience}
              onChangeText={setExperience}
              placeholder="e.g. 12"
              keyboardType="number-pad"
              maxLength={2}
              error={errors.experience}
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

            <Field
              label="Aadhaar"
              value={aadhaar}
              onChangeText={setAadhaar}
              placeholder="12 digit number"
              keyboardType="number-pad"
              maxLength={12}
              error={errors.aadhaar}
            />

            <Field
              label="Organisation"
              value={organisation}
              onChangeText={setOrganisation}
              placeholder="e.g. QCI"
            />

            {failure ? <Banner tone="danger">{failure}</Banner> : null}

            <Button label="Add trainer" onPress={add} loading={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  /* A labelled row of choices, for the questions with a short fixed set
     of answers. Wraps rather than scrolls: a qualification ladder is
     read all at once, unlike the day tabs on the register. */
  group: { gap: 6 },
  groupLabel: { fontSize: 13, fontWeight: '600', color: colors.ink700 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  choiceOn: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  choiceText: { fontSize: 13, color: colors.ink700 },
  choiceTextOn: { color: '#fff', fontWeight: '600' },

  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink900 },
  trainer: {
    backgroundColor: colors.ink50,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  trainerName: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  trainerMeta: { fontSize: 12, color: colors.ink500 },
});
