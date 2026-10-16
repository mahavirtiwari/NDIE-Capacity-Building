import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
import { colors, font, radius, spacing } from '../theme';

const PANEL_WIDTH = Math.min(320, Dimensions.get('window').width * 0.86);

interface MenuLink {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href: string;
}

/**
 * Everywhere the coordinator can go that is not a programme.
 *
 * The programmes themselves are the home screen and are opened from it;
 * a second door into one of them would be a second place to be wrong
 * about which one is open.
 */
const LINKS: MenuLink[] = [
  /* Programs, Material, Profile and Notifications are along the bottom
     now. What is left here is what a tab bar has no room for and nobody
     opens daily - and listing the four again would be two ways to the
     same screen, one of which looks like somewhere else. */
  /* Reachable without the banner, so somebody in the office can say
     'open Unsent work and read me what it says' to a coordinator who
     is looking at a programme the office cannot see. */
  { icon: 'cloud-upload-outline', label: 'Unsent work', href: '/unsent' },
  { icon: 'key-outline', label: 'Change password', href: '/change-password' },
  /* Its own item, because what the scheme is is not a footnote to a
     support telephone number. The words come from the portal. */
  { icon: 'information-circle-outline', label: 'About', href: '/about' },
];

const SUPPORT_LINK: MenuLink = {
  icon: 'help-buoy-outline',
  label: 'Support',
  href: '/support',
};

/* ----------------------------------------------------------- the host */

interface MenuValue {
  open: () => void;
  close: () => void;
}

const MenuContext = createContext<MenuValue | null>(null);

/**
 * Holds the menu for the whole app.
 *
 * One panel, mounted once, rather than one per screen: two of them would
 * be two pieces of state that can disagree about whether the menu is
 * open, and the second would animate behind the first.
 */
export function MenuProvider({ children }: { children: ReactNode }) {
  const [showing, setShowing] = useState(false);

  const value = useMemo<MenuValue>(
    () => ({ open: () => setShowing(true), close: () => setShowing(false) }),
    [],
  );

  return (
    <MenuContext.Provider value={value}>
      {children}
      <SideMenu open={showing} onClose={value.close} />
    </MenuContext.Provider>
  );
}

export function useMenu(): MenuValue {
  const value = useContext(MenuContext);
  if (!value) throw new Error('useMenu must be used inside MenuProvider.');
  return value;
}

/* ---------------------------------------------------------- the panel */

/**
 * The menu behind the hamburger.
 *
 * A panel over the screen rather than a navigation drawer, for the reason
 * the applicant app gives: a real drawer brings three native packages and
 * a Babel plugin with it, and the release build is the one thing that has
 * to keep working. What it costs is that the panel does not follow a
 * drag - it opens and closes.
 */
function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { branding } = useBranding();

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

  /* Sent to the sign-in screen here as well as by the guard in the root
     layout. The guard is what catches a session that ends on its own -
     an expired token, a password changed elsewhere - and this is what
     makes pressing Sign out feel like pressing Sign out. */
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
          {/* The mark alone on white, as the applicant app has it. Who
              is signed in belongs on the home screen, which says it
              already; saying it twice made the panel open on a second
              header rather than on where you can go. */}
          <View style={styles.head}>
            <BrandLogo size={46} />
          </View>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            <Text style={styles.prompt}>Where do you want to go?</Text>

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

            <Pressable
              onPress={() => go(SUPPORT_LINK.href)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={SUPPORT_LINK.icon} size={17} color={colors.brand700} />
              </View>
              <Text style={styles.rowLabel}>{SUPPORT_LINK.label}</Text>
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
/**
 * The hamburger, for a dark header.
 *
 * It was drawn in the brand colour, which was right on the blush bar it
 * used to sit on and invisible on the crimson one it sits on now - a
 * maroon icon on a maroon field. The menu was still there and still
 * opened; there was simply nothing to see.
 */
export function MenuButton() {
  const menu = useMenu();

  return (
    <Pressable
      onPress={menu.open}
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
  who: { alignItems: 'center', gap: 1 },
  whoName: { fontSize: font.base, fontWeight: '700', color: colors.ink900 },
  whoCode: { fontSize: font.xs, color: colors.ink500, letterSpacing: 0.4 },

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
