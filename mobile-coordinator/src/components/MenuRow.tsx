import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

/**
 * A row in one of the tab menus.
 *
 * The status line is the point of it: the coordinator is working through a
 * checklist at a venue, often between other jobs, and needs to see at a glance
 * what is already captured without opening each screen to find out.
 */
export function MenuRow({
  icon,
  title,
  status,
  done,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  status: string;
  done?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.row, disabled && styles.off]}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={[styles.icon, done && styles.iconDone]}>
        <Ionicons
          name={done ? 'checkmark' : icon}
          size={18}
          color={done ? '#fff' : colors.brand700}
        />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.status, done && styles.statusDone]}>{status}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.ink400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink200,
    padding: spacing.lg,
  },
  off: { opacity: 0.55 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand50,
  },
  iconDone: { backgroundColor: colors.success500 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink900 },
  status: { fontSize: 12, color: colors.ink500 },
  statusDone: { color: colors.success700 },
});
