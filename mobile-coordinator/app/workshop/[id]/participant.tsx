import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { participants as participantsApi } from '../../../src/api/endpoints';
import { GENDERS, SOCIAL_CATEGORIES } from '../../../src/api/types';
import { Picker } from '../../../src/components/Picker';
import { Banner, Button, Card, Field } from '../../../src/components/ui';
import { isEmail, isMobile } from '../../../src/validation/formats';
import { colors, radius, spacing } from '../../../src/theme';
import { useWorkshop } from '../../../src/workshop/WorkshopContext';

/**
 * On-spot registration for people who walked in on the day.
 *
 * Every field is mandatory. The Udyam number takes "NA" for an enterprise that
 * has none — which is a real answer, and one the scheme reports on, so the
 * button next to the field fills it in rather than leaving people to guess
 * whether blank would do.
 */
export default function OnSpotRegistration() {
  const { id, detail, refresh, locked } = useWorkshop();
  const registered = detail?.participants ?? [];

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [enterpriseName, setEnterpriseName] = useState('');
  const [designation, setDesignation] = useState('');
  const [udyam, setUdyam] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [socialCategory, setSocialCategory] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const found: Record<string, string> = {};
    if (!fullName.trim()) found.fullName = 'Full name is required.';
    if (!mobile.trim()) found.mobile = 'Mobile is required.';
    else if (!isMobile(mobile)) found.mobile = 'Enter a 10 digit number starting with 6-9.';
    if (!email.trim()) found.email = 'Email is required.';
    else if (!isEmail(email)) found.email = 'Enter a valid email address.';
    if (!enterpriseName.trim()) found.enterpriseName = 'Enterprise name is required.';
    if (!udyam.trim()) found.udyam = 'Enter the Udyam number, or tap NA.';
    if (!gender) found.gender = 'Select a gender.';
    if (!socialCategory) found.socialCategory = 'Select a social category.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      await participantsApi.add(id, {
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        enterpriseName: enterpriseName.trim(),
        designation: designation.trim() || undefined,
        udyamNumber: udyam.trim(),
        gender: gender!,
        socialCategory: socialCategory!,
      });
      await refresh();

      /* Cleared for the next person in the queue. */
      setFullName('');
      setMobile('');
      setEmail('');
      setEnterpriseName('');
      setDesignation('');
      setUdyam('');
      setGender(null);
      setSocialCategory(null);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not register.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {locked ? <Banner tone="info">Finally submitted — read only.</Banner> : null}

        <Card style={styles.card}>
          <Text style={styles.heading}>Registered ({registered.length})</Text>
          {registered.length === 0 ? (
            <Text style={styles.none}>Nobody registered yet.</Text>
          ) : (
            registered.map((person) => (
              <View key={person.id} style={styles.row}>
                <Text style={styles.rowTitle}>{person.fullName}</Text>
                <Text style={styles.rowMeta}>
                  {person.enterpriseName} · {person.udyamNumber}
                </Text>
              </View>
            ))
          )}
        </Card>

        {!locked ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Register a participant</Text>

            <Field
              label="Full name"
              required
              value={fullName}
              onChangeText={setFullName}
              placeholder="As they would like it on the certificate"
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
              required
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
            />
            <Field
              label="Enterprise name"
              required
              value={enterpriseName}
              onChangeText={setEnterpriseName}
              placeholder="Name of the unit"
              error={errors.enterpriseName}
            />
            <Field
              label="Designation"
              value={designation}
              onChangeText={setDesignation}
              placeholder="e.g. Proprietor"
            />

            <View style={styles.udyamRow}>
              <View style={styles.udyamField}>
                <Field
                  label="Udyam number"
                  required
                  value={udyam}
                  onChangeText={(text) => setUdyam(text.toUpperCase())}
                  placeholder="UDYAM-XX-00-0000000"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={errors.udyam}
                  hint={errors.udyam ? undefined : 'Tap NA if the enterprise is not registered.'}
                />
              </View>
              <Button
                label="NA"
                onPress={() => setUdyam('NA')}
                variant="secondary"
                style={styles.naButton}
              />
            </View>

            <Picker
              label="Gender"
              required
              value={gender}
              options={GENDERS}
              error={errors.gender}
              onChange={setGender}
            />
            <Picker
              label="Social category"
              required
              value={socialCategory}
              options={SOCIAL_CATEGORIES}
              error={errors.socialCategory}
              onChange={setSocialCategory}
            />

            {failure ? <Banner tone="danger">{failure}</Banner> : null}

            <Button label="Register participant" onPress={add} loading={busy} />
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink900 },
  none: { fontSize: 13, color: colors.ink500 },
  row: { backgroundColor: colors.ink50, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink900 },
  rowMeta: { fontSize: 12, color: colors.ink500 },
  udyamRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  udyamField: { flex: 1 },
  naButton: { marginTop: 22, paddingHorizontal: spacing.lg },
});
