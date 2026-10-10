import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, font, radius, spacing, toneColors, toneFor, labelFor, type Tone } from '../theme';

/* -------------------------------------------------------------- typography */

export function Title({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

/* -------------------------------------------------------------------- card */

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* ------------------------------------------------------------------ button */

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const palette = {
    primary: { bg: colors.brand600, fg: colors.white, border: colors.brand600 },
    secondary: { bg: colors.white, fg: colors.ink700, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.brand700, border: 'transparent' },
    danger: { bg: colors.danger500, fg: colors.white, border: colors.danger500 },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={palette.fg} /> : null}
          <Text style={[styles.buttonLabel, { color: palette.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------- field */

interface FieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string | null;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, required, error, hint, style, ...rest },
  ref,
) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.ink400}
        style={[styles.input, !!error && styles.inputInvalid, style]}
        {...rest}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

/* -------------------------------------------------------------- status pill */

export function StatusPill({ value, tone }: { value: string; tone?: Tone }) {
  const palette = toneColors[tone ?? toneFor(value)];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: palette.fg }]} />
      <Text style={[styles.pillText, { color: palette.fg }]}>{labelFor(value)}</Text>
    </View>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{children}</Text>
    </View>
  );
}

/* --------------------------------------------------------------- feedback */

export function Banner({
  tone = 'info',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const palette = toneColors[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <Ionicons
        name={tone === 'danger' ? 'alert-circle' : tone === 'success' ? 'checkmark-circle' : 'information-circle'}
        size={18}
        color={palette.fg}
      />
      <Text style={[styles.bannerText, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={colors.brand600} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}) {
  return (
    <View style={styles.centre}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color={colors.ink400} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
    </View>
  );
}

/** Label / value pair used across the detail screens. */
export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValue}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text style={styles.detailValueText}>{value}</Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

export const inr = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);

export const shortDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ---------------------------------------------------------- the keyboard */

/**
 * Keeps the keyboard off the screen below it. A drop-in for
 * KeyboardAvoidingView, which no longer does the job on Android.
 *
 * Android used to do this for us. Up to Android 14 the window shrank when
 * the keyboard opened — windowSoftInputMode=adjustResize — so a ScrollView
 * inside it simply had less room, and Android's own ScrollView scrolls the
 * focused child back into view whenever its size changes. Under the
 * edge-to-edge display that Android 15 requires, and that this SDK turns on
 * for every version, the window does not shrink: the keyboard is drawn over
 * an app that is still full height and nothing moves. Which is exactly what
 * it looks like — you type, and cannot see what you typed.
 *
 * KeyboardAvoidingView did not cover it. Every screen here passed
 * `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`, and with no
 * behaviour it renders a plain View and avoids nothing at all. Given
 * `padding` it does work, but from its own onLayout box, which is measured
 * against its parent rather than the screen — so under a navigation header
 * or above a tab bar it is out by the height of them, in the direction that
 * leaves the field covered.
 *
 * So this measures what is actually true: where this screen ends in window
 * coordinates, and where the keyboard starts. The overlap is held open below
 * the content, which gives back the shrinking viewport the platform used to
 * provide — and with it the scrolling-to-the-focused-field that came free
 * with it, both when the keyboard opens and when focus moves between fields
 * while it is already up.
 */
export function KeyboardAvoider({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const frame = useRef<View>(null);
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const opened = (event: KeyboardEvent) => {
      /* This wrapper keeps its full height whatever the keyboard does —
         the space comes out of the content inside it — so the same
         measurement means the same thing every time it is taken. */
      frame.current?.measureInWindow((_x, y, _width, height) => {
        setOverlap(Math.max(0, y + height - event.endCoordinates.screenY));
      });
    };
    const closed = () => setOverlap(0);

    /* iOS says the keyboard is coming and the layout can travel with it.
       Android only says so once it has arrived. */
    const early = Platform.OS === 'ios';
    const subscriptions = [
      Keyboard.addListener(early ? 'keyboardWillShow' : 'keyboardDidShow', opened),
      Keyboard.addListener(early ? 'keyboardWillHide' : 'keyboardDidHide', closed),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return (
    /* collapsable={false} or Android may drop this View from the native
       tree as a layout-only wrapper, and measuring it then answers for
       whatever took its place. */
    <View ref={frame} style={[styles.avoider, style]} collapsable={false}>
      <View style={styles.avoider}>{children}</View>
      <View style={{ height: overlap }} />
    </View>
  );
}

/**
 * How much of the window the keyboard is covering, in points.
 *
 * For the places that are not a whole screen — a dialog centred in the
 * window, which has to be centred in what is left of it instead.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const early = Platform.OS === 'ios';
    const subscriptions = [
      Keyboard.addListener(early ? 'keyboardWillShow' : 'keyboardDidShow', (event: KeyboardEvent) =>
        setHeight(event.endCoordinates.height),
      ),
      Keyboard.addListener(early ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return height;
}

const styles = StyleSheet.create({
  avoider: { flex: 1 },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.ink900 },
  subtitle: { fontSize: font.sm, color: colors.ink500, marginTop: 2 },
  muted: { fontSize: font.sm, color: colors.ink500, textAlign: 'center' },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 46,
  },
  buttonLabel: { fontSize: font.base, fontWeight: '600' },

  field: { gap: 6 },
  fieldLabel: { fontSize: font.sm, fontWeight: '600', color: colors.ink700 },
  required: { color: colors.danger500 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: font.base,
    color: colors.ink900,
    backgroundColor: colors.white,
  },
  inputInvalid: { borderColor: colors.danger500 },
  error: { fontSize: font.xs, color: colors.danger700, fontWeight: '500' },
  hint: { fontSize: font.xs, color: colors.ink500 },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: font.xs, fontWeight: '700' },

  chip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.ink100,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { fontSize: font.xs, color: colors.ink700, fontWeight: '500' },

  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  bannerText: { flex: 1, fontSize: font.sm, lineHeight: 19 },

  centre: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xxl },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: font.md, fontWeight: '600', color: colors.ink700 },

  detailRow: { flexDirection: 'row', paddingVertical: 7, gap: spacing.md },
  detailLabel: { width: 132, fontSize: font.sm, color: colors.ink500 },
  detailValue: { flex: 1 },
  detailValueText: { fontSize: font.sm, color: colors.ink900, fontWeight: '500' },
});
