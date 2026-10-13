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
import { useKeyboardHeight } from './ui';

export interface PickerOption {
  value: string;
  label: string;
  /** What it means, shown under the label where there is one. */
  description?: string | null;
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
  /* The dialog is centred in the window, and the window does not
     shrink for the keyboard any more. Centring it in what is left
     keeps the search box and the first options reachable. */
  const keyboard = useKeyboardHeight();

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

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[styles.backdrop, { paddingBottom: spacing.lg + keyboard }]}
          onPress={() => setOpen(false)}
        >
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
                placeholderTextColor={colors.ink500}
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

/**
 * A dropdown that takes more than one answer.
 *
 * The same control as Picker - closed it says what has been chosen, open
 * it is a sheet - except that choosing does not close it, because the
 * next thing somebody does is usually choose another. It replaced a flat
 * grid of checkboxes, which read as a different kind of question from the
 * dropdown beside it and took the height of the whole list whether or not
 * anybody was answering it.
 */
export function MultiPicker({
  label,
  placeholder = 'Select',
  values,
  options,
  required,
  error,
  hint,
  disabled,
  searchable,
  onChange,
}: {
  label: string;
  placeholder?: string;
  values: string[];
  options: PickerOption[];
  required?: boolean;
  error?: string | null;
  hint?: string | null;
  disabled?: boolean;
  searchable?: boolean;
  onChange: (values: string[]) => void;
}) {
  const keyboard = useKeyboardHeight();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');

  const showSearch = searchable ?? options.length > 8;
  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, term]);

  /* What the closed control says. Names while they fit, a count after
     that: three long certifications would otherwise push the chevron off
     the end of the row. */
  const chosen = options.filter((option) => values.includes(option.value));
  const summary =
    chosen.length === 0
      ? placeholder
      : chosen.length <= 2
        ? chosen.map((option) => option.label).join(', ')
        : `${chosen.length} selected`;

  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

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
        <Text style={chosen.length ? styles.value : styles.placeholder} numberOfLines={1}>
          {summary}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.ink500} />
      </Pressable>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[styles.backdrop, { paddingBottom: spacing.lg + keyboard }]}
          onPress={() => setOpen(false)}
        >
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
                placeholderTextColor={colors.ink500}
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
                const isSelected = values.includes(item.value);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => toggle(item.value)}
                    style={({ pressed }) => [
                      styles.option,
                      pressed && styles.optionActive,
                    ]}
                  >
                    <View style={[styles.box, isSelected && styles.boxChecked]}>
                      {isSelected ? (
                        <Ionicons name="checkmark" size={14} color={colors.white} />
                      ) : null}
                    </View>
                    <View style={styles.optionBody}>
                      <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                        {item.label}
                      </Text>
                      {item.description ? (
                        <Text style={styles.optionNote}>{item.description}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />

            {/* Choosing does not close the sheet, so there has to be a way
                out that is not the backdrop. */}
            <Pressable style={styles.done} onPress={() => setOpen(false)}>
              <Text style={styles.doneText}>
                Done{chosen.length ? ` (${chosen.length})` : ''}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** The flat list of tick boxes, still used where every choice should be on screen. */
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
              {/* The words, and under them what they mean. A choice that
                  needs explaining is explained where it is read, not
                  behind a tap. */}
              <View style={styles.checkBody}>
                <Text style={styles.checkText}>{option.label}</Text>
                {option.description ? (
                  <Text style={styles.checkNote}>{option.description}</Text>
                ) : null}
              </View>
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
              <View style={styles.checkBody}>
                <Text style={styles.checkText}>{option.label}</Text>
                {option.description ? (
                  <Text style={styles.checkNote}>{option.description}</Text>
                ) : null}
              </View>
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
  placeholder: { flex: 1, fontSize: font.base, color: colors.ink500 },

  error: { fontSize: font.xs, color: colors.danger700, fontWeight: '500' },
  hint: { fontSize: font.sm, color: colors.ink600, lineHeight: 17 },

  /* Centred rather than anchored to the bottom edge, like every other
     dialog in the app. A sheet that rises from the bottom puts the first
     option under the thumb and the title furthest from the eye; in the
     middle the list is read before it is reached for, and it no longer
     has to dodge the gesture bar.

     Capped both ways: the 763-district list would otherwise grow to the
     full height of the window, and the list inside scrolls. */
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
    paddingBottom: spacing.sm,
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
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: font.base,
    color: colors.ink900,
  },
  list: { paddingHorizontal: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    /* A finger-sized row. The old one was 13pt of padding around a single
       line, which on a long list meant reading and hitting the wrong one. */
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  optionActive: { backgroundColor: colors.brand50 },
  optionText: { fontSize: font.base, color: colors.ink900, flex: 1, lineHeight: 21 },
  optionTextActive: { color: colors.brand700, fontWeight: '600' },
  empty: { padding: spacing.lg, fontSize: font.sm, color: colors.ink500, textAlign: 'center' },

  group: { gap: spacing.sm },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  checkBody: { flex: 1, gap: 1 },
  /* The sheet's own rows, which carry a box and a description. */
  optionBody: { flex: 1, gap: 1 },
  optionNote: { fontSize: font.xs, color: colors.ink500, lineHeight: 16 },
  done: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneText: { fontSize: font.base, fontWeight: '700', color: colors.brand700 },
  checkText: { fontSize: font.base, color: colors.ink900, lineHeight: 21, flexShrink: 1 },
  checkNote: { fontSize: font.xs, color: colors.ink500, lineHeight: 16 },
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
