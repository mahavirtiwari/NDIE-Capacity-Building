import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, font, radius, spacing } from '../theme';

export interface PickerOption {
  value: string;
  label: string;
}

interface PickerProps {
  label: string;
  placeholder?: string;
  value: string | null;
  options: PickerOption[];
  required?: boolean;
  error?: string | null;
  hint?: string | null;
  disabled?: boolean;
  /** Shows a search box once the list is long. */
  searchable?: boolean;
  onChange: (value: string) => void;
}

/**
 * A select control. React Native has no native picker that looks the same on
 * both platforms, so this is a sheet with a searchable list — which also copes
 * with the 763-district LGD list.
 */
export function Picker({
  label,
  placeholder = 'Select',
  value,
  options,
  required,
  error,
  hint,
  disabled,
  searchable,
  onChange,
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');

  const selected = options.find((option) => option.value === value);
  const showSearch = searchable ?? options.length > 8;

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, term]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        onPress={() => {
          if (disabled) return;
          setTerm('');
          setOpen(true);
        }}
        style={[styles.control, !!error && styles.controlInvalid, disabled && styles.controlDisabled]}
      >
        <Text style={selected ? styles.value : styles.placeholder} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.ink500} />
      </Pressable>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.ink600} />
              </Pressable>
            </View>

            {showSearch ? (
              <TextInput
                value={term}
                onChangeText={setTerm}
                placeholder="Search"
                placeholderTextColor={colors.ink400}
                style={styles.search}
                autoCorrect={false}
              />
            ) : null}

            <FlatList
              data={visible}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>Nothing matches that search.</Text>}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      (pressed || isSelected) && styles.optionActive,
                    ]}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                      {item.label}
                    </Text>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={18} color={colors.brand700} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Multi-select variant used by `multiselect` fields. */
export function CheckboxGroup({
  label,
  options,
  values,
  required,
  error,
  onChange,
}: {
  label: string;
  options: PickerOption[];
  values: string[];
  required?: boolean;
  error?: string | null;
  onChange: (values: string[]) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={styles.group}>
        {options.map((option) => {
          const checked = values.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() =>
                onChange(
                  checked
                    ? values.filter((value) => value !== option.value)
                    : [...values, option.value],
                )
              }
              style={styles.check}
            >
              <View style={[styles.box, checked && styles.boxChecked]}>
                {checked ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </View>
              <Text style={styles.checkText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** Single-choice variant used by `radio` fields. */
export function RadioGroup({
  label,
  options,
  value,
  required,
  error,
  onChange,
}: {
  label: string;
  options: PickerOption[];
  value: string | null;
  required?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={styles.group}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              onPress={() => onChange(option.value)}
              style={styles.check}
            >
              <View style={[styles.radio, checked && styles.radioChecked]}>
                {checked ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={styles.checkText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** Single boolean, used by `checkbox` fields such as the declaration. */
export function Switch({
  label,
  checked,
  required,
  error,
  onChange,
}: {
  label: string;
  checked: boolean;
  required?: boolean;
  error?: string | null;
  onChange: (checked: boolean) => void;
}) {
  return (
    <View style={styles.field}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        style={styles.check}
      >
        <View style={[styles.box, checked && styles.boxChecked]}>
          {checked ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
        </View>
        <Text style={[styles.checkText, styles.checkTextWide]}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.ink700 },
  required: { color: colors.danger500 },

  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.white,
    minHeight: 46,
  },
  controlInvalid: { borderColor: colors.danger500 },
  controlDisabled: { backgroundColor: colors.ink100 },
  value: { flex: 1, fontSize: font.base, color: colors.ink900 },
  placeholder: { flex: 1, fontSize: font.base, color: colors.ink400 },

  error: { fontSize: font.xs, color: colors.danger700, fontWeight: '500' },
  hint: { fontSize: font.xs, color: colors.ink500 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '75%',
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  search: {
    margin: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: font.base,
    color: colors.ink900,
  },
  list: { paddingHorizontal: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  optionActive: { backgroundColor: colors.brand50 },
  optionText: { fontSize: font.base, color: colors.ink800, flex: 1 },
  optionTextActive: { color: colors.brand700, fontWeight: '600' },
  empty: { padding: spacing.lg, fontSize: font.sm, color: colors.ink500, textAlign: 'center' },

  group: { gap: spacing.sm },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  checkText: { fontSize: font.base, color: colors.ink800 },
  checkTextWide: { flex: 1 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioChecked: { borderColor: colors.brand600 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand600 },
});
