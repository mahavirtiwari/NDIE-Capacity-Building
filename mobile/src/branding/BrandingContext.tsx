import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '../api/client';
import { branding as brandingApi } from '../api/endpoints';
import type { Branding } from '../api/types';
import { readValue, writeValue } from '../offline/store';
import { colors, font, radius, spacing } from '../theme';

/** Used before anything has been stored, and kept if the API is never reached. */
const FALLBACK: Branding = {
  organisationName: 'National Division for Industry Excellence',
  shortName: 'NDIE',
  portalTitle: 'Capacity Building Management System',
  tagline: null,
  supportEmail: null,
  hasLogo: false,
  logoUrl: null,
  logoVersion: 0,
  updatedOn: new Date().toISOString(),
};

const BRANDING_KEY = 'branding';
const LOGO_KEY = 'branding.logo';
const REVERSED_KEY = 'branding.logo.reversed';

interface StoredLogo {
  version: number;
  uri: string;
}

interface BrandingState {
  branding: Branding;
  /** Where to draw the mark from: a downloaded file, or the server. */
  logoUri: string | null;
  /** The same, for a dark ground. Null where none has been uploaded. */
  reversedLogoUri: string | null;
}

const BrandingContext = createContext<BrandingState>({
  branding: FALLBACK,
  logoUri: null,
  reversedLogoUri: null,
});

function absolute(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:/.test(url)) return url;
  return `${API_BASE_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

const absoluteLogoUrl = (branding: Branding) => absolute(branding.logoUrl);
const absoluteReversedUrl = (branding: Branding) =>
  branding.hasReversedLogo ? absolute(branding.reversedLogoUrl) : null;

/**
 * Keeps the logo on the device.
 *
 * The mark is uploaded by an administrator and served by the API, so it cannot
 * ship with the app — but the sign-in screen is exactly where somebody is most
 * likely to have no connection, and an unbranded sign-in screen looks like the
 * wrong app. Downloaded once per version and read from disk after that.
 */
async function ensureLogoFile(
  remote: string | null,
  version: number,
  name: string,
  stored: StoredLogo | null,
): Promise<StoredLogo | null> {
  if (!remote) return null;

  if (stored && stored.version === version) {
    /* A file the OS has cleared out is worse than no file: the Image would
       render nothing at all rather than falling back to the emblem. */
    try {
      if (new File(stored.uri).exists) return stored;
    } catch {
      /* Treat an unreadable path as absent and fetch it again. */
    }
  }

  try {
    const target = new File(Paths.document, `${name}-v${version}.png`);
    if (target.exists) target.delete();

    const saved = await File.downloadFileAsync(remote, target);
    return { version, uri: saved.uri };
  } catch {
    /* No connection, or no room. The remote URL is still tried at render. */
    return stored;
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(FALLBACK);
  const [logo, setLogo] = useState<StoredLogo | null>(null);
  const [reversed, setReversed] = useState<StoredLogo | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      /* What was stored last time, first, so the first frame is already
         branded rather than flashing the fallback while a request runs. */
      const [storedBranding, storedLogo, storedReversed] = await Promise.all([
        readValue<Branding>(BRANDING_KEY),
        readValue<StoredLogo>(LOGO_KEY),
        readValue<StoredLogo>(REVERSED_KEY),
      ]);

      if (cancelled) return;
      if (storedBranding) setBranding(storedBranding);
      if (storedLogo) setLogo(storedLogo);
      if (storedReversed) setReversed(storedReversed);

      /* Then refresh. A failure here is silent: the app is fully usable on
         what was stored, and the sign-in screen must not show an error
         because a logo could not be refreshed. */
      let fresh: Branding;
      try {
        fresh = await brandingApi.get();
      } catch {
        return;
      }

      if (cancelled) return;
      setBranding(fresh);
      void writeValue(BRANDING_KEY, fresh);

      const nextLogo = await ensureLogoFile(
        fresh.hasLogo ? absoluteLogoUrl(fresh) : null,
        fresh.logoVersion,
        'brand-logo',
        storedLogo,
      );
      if (cancelled) return;
      if (nextLogo) {
        setLogo(nextLogo);
        void writeValue(LOGO_KEY, nextLogo);
      }

      const nextReversed = await ensureLogoFile(
        absoluteReversedUrl(fresh),
        fresh.reversedLogoVersion ?? 0,
        'brand-logo-reversed',
        storedReversed,
      );
      if (cancelled) return;

      /* Cleared on the server means cleared here: a stale white mark would
         go on being drawn over the crimson long after it was removed. */
      setReversed(nextReversed);
      void writeValue(REVERSED_KEY, nextReversed);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<BrandingState>(
    () => ({
      branding,
      logoUri: logo?.uri ?? absoluteLogoUrl(branding),
      reversedLogoUri: reversed?.uri ?? absoluteReversedUrl(branding),
    }),
    [branding, logo, reversed],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingState {
  return useContext(BrandingContext);
}

/**
 * The lockup for the splash and sign-in screens. Falls back to an emblem and
 * the short name when no logo has been uploaded or the image fails to load.
 */
export function BrandLogo({
  size = 64,
  reversed = false,
}: {
  size?: number;
  /**
   * Ask for the mark drawn for a dark ground. Whether one exists is the
   * caller's business too — {@link useBranding} reports it — because a
   * surface that needs a white mark and has none should change its own
   * background rather than put a colour logo on crimson.
   */
  reversed?: boolean;
}) {
  const { branding, logoUri, reversedLogoUri } = useBranding();
  const uri = reversed ? (reversedLogoUri ?? logoUri) : logoUri;
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size * 3, height: size, resizeMode: 'contain' }}
        accessibilityLabel={branding.organisationName}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={styles.fallback}>
      <View style={[styles.emblem, { width: size, height: size, borderRadius: radius.lg }]}>
        <Ionicons name="school" size={size * 0.42} color={colors.white} />
      </View>
      <Text style={[styles.shortName, reversed && styles.shortNameReversed]}>
        {branding.shortName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', gap: spacing.sm },
  emblem: {
    alignItems: 'center',
    justifyContent: 'center',
    /* Solid brand on a light surface: the emblem is the dark element, the
       screen behind it is not. */
    backgroundColor: colors.brand700,
  },
  shortName: {
    color: colors.brand800,
    fontSize: font.lg,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  shortNameReversed: { color: colors.white },
});
