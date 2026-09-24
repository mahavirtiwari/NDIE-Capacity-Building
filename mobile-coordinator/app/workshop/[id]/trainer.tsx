import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../src/api/client';
import { trainers as trainersApi } from '../../../src/api/endpoints';
import { Banner, Button, Card, Field } from '../../../src/components/ui';
import { isEmail, isMobile } from '../../../src/validation/formats';
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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const found: Record<string, string> = {};
    if (!fullName.trim()) found.fullName = 'Trainer name is required.';
    if (!mobile.trim()) found.mobile = 'Mobile is required.';
    else if (!isMobile(mobile)) found.mobile = 'Enter a 10 digit number starting with 6-9.';
    if (email.trim() && !isEmail(email)) found.email = 'Enter a valid email address.';

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
      });
      await refresh();
      setFullName('');
      setMobile('');
      setEmail('');
      setDesignation('');
      setOrganisation('');
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not add the trainer.');
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

        {registered.length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Registered ({registered.length})</Text>
            {registered.map((trainer) => (
              <View key={trainer.id} style={styles.trainer}>
                <Text style={styles.trainerName}>{trainer.fullName}</Text>
                <Text style={styles.trainerMeta}>
                  {[trainer.designation, trainer.organisation, trainer.mobile]
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
