import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { auth, lookups } from '../../src/api/endpoints';
import type { Gender, LookupItem, SocialCategory } from '../../src/api/types';
import { GENDER_OPTIONS, SOCIAL_CATEGORY_OPTIONS } from '../../src/api/types';
import { Picker } from '../../src/components/Picker';
import { Banner, Button, Card, Field, Subtitle, Title } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';
import { isEmail, isMobile, isPan } from '../../src/validation/formats';

/**
 * Basic registration. Everything else the scheme needs is collected later, on
 * the programme's own registration form.
 */
export default function SignUp() {
  const router = useRouter();

  const [categories, setCategories] = useState<LookupItem[]>([]);
  const [subCategories, setSubCategories] = useState<LookupItem[]>([]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [pan, setPan] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [socialCategory, setSocialCategory] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    lookups
      .categories()
      .then(setCategories)
      .catch(() => setFailure('Could not load categories. Check your connection.'));
  }, []);

  /* Sub-categories follow the chosen category. */
  useEffect(() => {
    setSubCategoryId(null);
    if (!categoryId) {
      setSubCategories([]);
      return;
    }
    lookups
      .subCategories(Number(categoryId))
      .then(setSubCategories)
      .catch(() => setSubCategories([]));
  }, [categoryId]);

  const submit = async () => {
    const found: Record<string, string> = {};
    if (!fullName.trim()) found.fullName = 'Full name is required.';
    if (!email.trim()) found.email = 'Email is required.';
    else if (!isEmail(email)) found.email = 'Enter a valid email address.';
    if (!mobile.trim()) found.mobile = 'Mobile is required.';
    else if (!isMobile(mobile)) found.mobile = 'Enter a 10 digit number starting with 6-9.';
    if (!pan.trim()) found.pan = 'PAN is required.';
    else if (!isPan(pan)) found.pan = 'PAN must be 10 characters, e.g. ABCDE1234F.';
    if (!gender) found.gender = 'Select a gender.';
    if (!socialCategory) found.socialCategory = 'Select a social category.';
    if (!categoryId) found.categoryId = 'Select a category.';
    if (!subCategoryId) found.subCategoryId = 'Select a sub-category.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      const applicant = await auth.signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        pan: pan.trim().toUpperCase(),
        gender: gender as Gender,
        socialCategory: socialCategory as SocialCategory,
        categoryId: Number(categoryId),
        subCategoryId: Number(subCategoryId),
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
          <Field
            label="Full name"
            required
            value={fullName}
            onChangeText={setFullName}
            placeholder="As printed on your PAN"
            error={errors.fullName}
            autoCapitalize="words"
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
            hint="You can change this later without affecting how you sign in."
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
            label="PAN"
            required
            value={pan}
            onChangeText={(text) => setPan(text.toUpperCase())}
            placeholder="ABCDE1234F"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
            error={errors.pan}
          />

          <Picker
            label="Gender"
            required
            value={gender}
            options={GENDER_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
            error={errors.gender}
            onChange={setGender}
          />

          <Picker
            label="Social category"
            required
            value={socialCategory}
            options={SOCIAL_CATEGORY_OPTIONS.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            error={errors.socialCategory}
            onChange={setSocialCategory}
            hint="Used only for the scheme's reporting on reach."
          />

          <Picker
            label="Category"
            required
            value={categoryId}
            options={categories.map((item) => ({ value: String(item.id), label: item.name }))}
            error={errors.categoryId}
            onChange={setCategoryId}
          />

          <Picker
            label="Sub-category"
            required
            value={subCategoryId}
            options={subCategories.map((item) => ({ value: String(item.id), label: item.name }))}
            disabled={!categoryId}
            hint={categoryId ? undefined : 'Choose a category first.'}
            error={errors.subCategoryId}
            onChange={setSubCategoryId}
          />

          {failure ? <Banner tone="danger">{failure}</Banner> : null}

          <Button label="Register and send code" onPress={submit} loading={busy} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { gap: 2 },
  card: { gap: spacing.lg },
});
