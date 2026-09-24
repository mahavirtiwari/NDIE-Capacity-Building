import { Ionicons } from '@expo/vector-icons';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '../api/client';
import { branding as brandingApi } from '../api/endpoints';
import type { Branding } from '../api/types';
import { colors, font, radius, spacing } from '../theme';

/** Used until the API answers, and kept if it never does. */
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

interface BrandingState {
  branding: Branding;
  /** Absolute URL of the uploaded mark, or null when none has been set. */
  logoUri: string | null;
}

const BrandingContext = createContext<BrandingState>({ branding: FALLBACK, logoUri: null });

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(FALLBACK);

  /* Anonymous, so the sign-in screen is already branded. A failure is silent:
     the app still works with the fallback names. */
  useEffect(() => {
    let cancelled = false;
    brandingApi
      .get()
      .then((result) => {
        if (!cancelled) setBranding(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<BrandingState>(() => {
    const url = branding.logoUrl;
    const logoUri = !url
      ? null
      : /^https?:/.test(url)
        ? url
        : `${API_BASE_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    return { branding, logoUri };
  }, [branding]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingState {
  return useContext(BrandingContext);
}

/**
 * The lockup for the splash and sign-in screens. Falls back to an emblem and
 * the short name when no logo has been uploaded or the image fails to load.
 */
export function BrandLogo({ size = 64 }: { size?: number }) {
  const { branding, logoUri } = useBranding();
  const [failed, setFailed] = useState(false);

  if (logoUri && !failed) {
    return (
      <Image
        source={{ uri: logoUri }}
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
      <Text style={styles.shortName}>{branding.shortName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', gap: spacing.sm },
  emblem: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  shortName: {
    fontSize: font.lg,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 2,
  },
});
