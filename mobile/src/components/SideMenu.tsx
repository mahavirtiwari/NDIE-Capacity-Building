import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Linking,
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
  href: string;
}

const LINKS: MenuLink[] = [
  { icon: 'grid-outline', label: 'Home', href: '/(tabs)/programs' },
  /* No 'Your profile' link. The profile scrutiny form is reached from
     the submission it became, which is listed under applications with
     everything else that was sent in; a second door into a form that is
     filled once only invited people to start it again. */
  { icon: 'documents-outline', label: 'My applications', href: '/(tabs)/applications' },
  { icon: 'calendar-outline', label: 'Programs', href: '/(tabs)/batches' },
  { icon: 'document-text-outline', label: 'Examinations', href: '/exam' },
  { icon: 'chatbox-ellipses-outline', label: 'Feedback', href: '/feedback' },
  /* One entry: what is owed, what was paid and the invoice for each are
     the same two lists, and they were two screens. */
  { icon: 'card-outline', label: 'Payments & invoices', href: '/payments' },
  { icon: 'book-outline', label: 'Training material', href: '/(tabs)/materials' },
  { icon: 'person-outline', label: 'My profile', href: '/(tabs)/profile' },
];

/* Below the rule, above the sign-out: these are about the product rather
   than about the applicant's own work, and Support leaves the app
   altogether. Support is only offered where the department has filled in
   a page under Branding — an entry with nothing behind it is worse than
   no entry. */
const ABOUT_LINK: MenuLink = { icon: 'information-circle-outline', label: 'About', href: '/about' };

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
  const { signOut } = useAuth();
  const { branding, reversedLogoUri } = useBranding();
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

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={styles.backdropHit} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateX: slide }] }]}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.panelInner}>
          {/* The mark alone, centred. Who is signed in is on the panel the
              menu opens onto, and the product's own name is on every bar.

              Crimson when a reversed mark has been uploaded under Branding,
              white when it has not: a full-colour logo on the brand crimson
              goes muddy, and the band is the part we can change. */}
          <View style={[styles.head, reversedLogoUri ? styles.headDark : null]}>
            <BrandLogo size={46} reversed={!!reversedLogoUri} />
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
                <Text style={styles.rowLabel}>{link.label}</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.ink400} />
              </Pressable>
            ))}

            <View style={styles.rule} />

            {branding.supportUrl ? (
              <Pressable
                onPress={() => {
                  onClose();
                  void Linking.openURL(branding.supportUrl!);
                }}
                accessibilityRole="link"
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="help-buoy-outline" size={17} color={colors.brand700} />
                </View>
                <Text style={styles.rowLabel}>Support</Text>
                <Ionicons name="open-outline" size={15} color={colors.ink400} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => go(ABOUT_LINK.href)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={ABOUT_LINK.icon} size={17} color={colors.brand700} />
              </View>
              <Text style={styles.rowLabel}>{ABOUT_LINK.label}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.ink400} />
            </Pressable>

            <View style={styles.rule} />

            <Pressable
              onPress={leave}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.rowIcon, styles.rowIconDanger]}>
                <Ionicons name="log-out-outline" size={17} color={colors.danger700} />
              </View>
              <Text style={[styles.rowLabel, styles.rowLabelDanger]}>Sign out</Text>
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

  head: {
    backgroundColor: colors.white,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headDark: { backgroundColor: colors.brand700, borderBottomColor: colors.brand800 },

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
  /* flex on the label itself now that it is the row's only text, so the
     chevron stays at the edge rather than following the word. */
  rowLabel: { flex: 1, fontSize: font.base, fontWeight: '600', color: colors.ink900 },
  rowLabelDanger: { color: colors.danger700 },

  rule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  version: {
    fontSize: font.xs,
    color: colors.ink400,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  hamburger: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
