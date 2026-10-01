import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Applicant } from '../api/types';
import { colors, font, radius, spacing } from '../theme';

/**
 * Who is signed in, on the crimson panel the reference screens open with.
 *
 * The applicant ID is on it deliberately: it is what they sign in with, it is
 * not their email, and it is the thing an office will ask for on the phone.
 */
export function IdentityPanel({
  applicant,
  greeting,
  children,
}: {
  applicant: Applicant | null;
  greeting?: string;
  children?: ReactNode;
}) {
  const initials = (applicant?.fullName ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View style={styles.panel}>
      <View style={styles.panelTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || '—'}</Text>
        </View>
        <View style={styles.panelText}>
          <Text style={styles.greeting}>{greeting ?? 'Welcome'}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {applicant?.fullName ?? 'Applicant'}
          </Text>
          <Text style={styles.code}>{applicant?.applicantCode ?? ''}</Text>
        </View>
      </View>

      {/* The one discipline that used to be named here was the one chosen
          at sign-up. An account can now hold a profile in each category, so
          a single line under the name would be true of only one of them.
          They are listed, with where each stands, on the profile screen. */}

      {children}
    </View>
  );
}

/** A small label above a group, so a long screen reads as sections. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

/**
 * One of the squares under the panel: somewhere to go, and the one number
 * that says whether it needs attention.
 */
export function QuickTile({
  icon,
  label,
  value,
  tone = 'plain',
  action,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Left out where there is no number worth inventing; the tile is then
      simply a way through, and reads as one line. */
  value?: string;
  tone?: 'plain' | 'warn';
  /**
   * What the tile is for, on a button at the end of the line. Without one
   * the way through is a bare arrow, which says where but not why.
   */
  action?: string;
  onPress: () => void;
}) {
  const badge = (
    <View style={[styles.tileIcon, tone === 'warn' && styles.tileIconWarn]}>
      <Ionicons
        name={icon}
        size={16}
        color={tone === 'warn' ? colors.warning700 : colors.brand700}
      />
    </View>
  );

  /* No number to report: the icon, what it is and the way in, along one
     line. Stacked, it was three rows deep to say a single word. */
  if (value === undefined) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={action ? `${label}, ${action}` : label}
        style={({ pressed }) => [styles.tile, styles.tileRow, pressed && styles.tilePressed]}
      >
        {badge}

        <Text style={[styles.tileValue, styles.tileRowLabel]} numberOfLines={1}>
          {label}
        </Text>

        {action ? (
          <View style={styles.tileAction}>
            <Ionicons name="arrow-forward" size={13} color={colors.white} />
            <Text style={styles.tileActionText}>{action}</Text>
          </View>
        ) : (
          <Ionicons name="arrow-forward" size={13} color={colors.ink500} />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      {badge}

      <Text
        style={[styles.tileValue, tone === 'warn' && styles.tileValueWarn]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function QuickTiles({ children }: { children: ReactNode }) {
  return <View style={styles.tiles}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.brand700,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  panelTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.brand900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: font.md, fontWeight: '700', color: colors.white },
  panelText: { flex: 1 },
  greeting: { fontSize: font.xs, color: colors.onBrandMuted, letterSpacing: 0.5 },
  name: { fontSize: font.lg, fontWeight: '700', color: colors.white },
  code: { fontSize: font.xs, color: colors.white, opacity: 0.9, letterSpacing: 0.5 },

  heading: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.ink500,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  tilePressed: { backgroundColor: colors.brand50 },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tileRowLabel: { flex: 1 },
  tileAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.brand600,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  tileActionText: { fontSize: font.sm, fontWeight: '700', color: colors.white },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconWarn: { backgroundColor: colors.warning50 },
  tileValue: { fontSize: font.md, fontWeight: '700', color: colors.ink900 },
  tileValueWarn: { color: colors.warning700 },
  tileLabel: { fontSize: font.xs, color: colors.ink500 },
});
