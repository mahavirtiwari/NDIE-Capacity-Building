import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { BrandLogo, useBranding } from '../branding/BrandingContext';
import { useSiteText } from '../content/SiteTextContext';
import { colors, font, radius, spacing } from '../theme';

const PANEL_WIDTH = Math.min(320, Dimensions.get('window').width * 0.86);

interface MenuLink {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  note: string;
  href: string;
}

const LINKS: MenuLink[] = [
  {
    icon: 'grid-outline',
    label: 'Dashboard',
    note: 'Programmes open to you',
    href: '/(tabs)/programs',
  },
  {
    icon: 'documents-outline',
    label: 'My applications',
    note: 'What you have applied for, and where it stands',
    href: '/(tabs)/applications',
  },
  {
    icon: 'calendar-outline',
    label: 'Batches',
    note: 'Sessions, attendance and your exam',
    href: '/(tabs)/batches',
  },
  {
    icon: 'card-outline',
    label: 'Payments',
    note: 'Fees paid, and the receipts for them',
    href: '/payments',
  },
  {
    icon: 'book-outline',
    label: 'Training material',
    note: 'Reading for the programmes you are on',
    href: '/(tabs)/materials',
  },
  {
    icon: 'person-outline',
    label: 'My profile',
    note: 'Contact details and password',
    href: '/(tabs)/profile',
  },
];

/**
 * The menu behind the hamburger.
 *
 * A panel over the screen rather than a navigation drawer: a real drawer
 * brings three native packages and a Babel plugin with it, and this app's
 * release build is the one thing that must keep working. What it costs is
 * that the panel does not follow a drag — it opens and closes.
 */
export function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { applicant, signOut } = useAuth();
  const { branding } = useBranding();
  const text = useSiteText();

  const slide = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: open ? 0 : -PANEL_WIDTH,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: open ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, slide, fade]);

  const go = (href: string) => {
    onClose();
    router.push(href as never);
  };

  const leave = async () => {
    onClose();
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const initials = (applicant?.fullName ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={styles.backdropHit} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateX: slide }] }]}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.panelInner}>
          <View style={styles.head}>
            <View style={styles.headTop}>
              <BrandLogo size={34} />
              <View style={styles.headText}>
                <Text style={styles.headTitle} numberOfLines={1}>
                  {branding.portalTitle}
                </Text>
                <Text style={styles.headOrg} numberOfLines={1}>
                  {branding.organisationName}
                </Text>
              </View>
            </View>

            <View style={styles.who}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials || '—'}</Text>
              </View>
              <View style={styles.whoText}>
                <Text style={styles.whoName} numberOfLines={1}>
                  {applicant?.fullName ?? 'Applicant'}
                </Text>
                <Text style={styles.whoCode}>{applicant?.applicantCode ?? ''}</Text>
                {applicant?.subCategoryName ? (
                  <Text style={styles.whoTrack} numberOfLines={1}>
                    {applicant.categoryName} · {applicant.subCategoryName}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            <Text style={styles.prompt}>
              {text('app.menu.prompt', 'Where do you want to go?')}
            </Text>

            {LINKS.map((link) => (
              <Pressable
                key={link.href}
                onPress={() => go(link.href)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={link.icon} size={17} color={colors.brand700} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{link.label}</Text>
                  <Text style={styles.rowNote}>{link.note}</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={colors.ink400} />
              </Pressable>
            ))}

            <View style={styles.rule} />

            <Pressable
              onPress={leave}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.rowIcon, styles.rowIconDanger]}>
                <Ionicons name="log-out-outline" size={17} color={colors.danger700} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, styles.rowLabelDanger]}>Sign out</Text>
                <Text style={styles.rowNote}>You will need your applicant ID to come back</Text>
              </View>
            </Pressable>
          </ScrollView>

          <Text style={styles.version}>
            {branding.portalTitle} v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

/** The hamburger that opens it, for a screen header. */
export function MenuButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      style={styles.hamburger}
    >
      <Ionicons name="menu" size={23} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  backdropHit: { flex: 1 },

  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_WIDTH,
    backgroundColor: colors.white,
  },
  panelInner: { flex: 1 },

  head: { backgroundColor: colors.brand700, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  headText: { flex: 1 },
  headTitle: { fontSize: font.sm, fontWeight: '700', color: colors.white },
  headOrg: { fontSize: font.xs, color: colors.onBrandMuted },

  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brand900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: font.md, fontWeight: '700', color: colors.white },
  whoText: { flex: 1 },
  whoName: { fontSize: font.md, fontWeight: '700', color: colors.white },
  whoCode: { fontSize: font.xs, color: colors.white, opacity: 0.9, letterSpacing: 0.5 },
  whoTrack: { fontSize: font.xs, color: colors.onBrandMuted, marginTop: 1 },

  list: { padding: spacing.md, gap: 2 },
  prompt: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.ink500,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowPressed: { backgroundColor: colors.brand50 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: colors.danger50 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: font.base, fontWeight: '600', color: colors.ink900 },
  rowLabelDanger: { color: colors.danger700 },
  rowNote: { fontSize: font.xs, color: colors.ink500, lineHeight: 15 },

  rule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  version: {
    fontSize: font.xs,
    color: colors.ink400,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  hamburger: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
