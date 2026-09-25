import * as SecureStore from 'expo-secure-store';
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
import { Platform } from 'react-native';
import { forgetCachedData } from '../offline/store';
import { configureApi } from '../api/client';
import { auth as authApi, me as meApi } from '../api/endpoints';
import type { Applicant } from '../api/types';

const TOKEN_KEY = 'ntms.applicant.token';
const APPLICANT_KEY = 'ntms.applicant.profile';

/** SecureStore has no web implementation; fall back to localStorage there. */
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* private mode */
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        /* private mode */
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

interface AuthState {
  loading: boolean;
  applicant: Applicant | null;
  signIn: (applicantCode: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [applicant, setApplicant] = useState<Applicant | null>(null);

  /* A ref, not state, so the API client reads the current token synchronously. */
  const tokenRef = useRef<string | null>(null);

  const signOut = useCallback(async () => {
    tokenRef.current = null;
    setApplicant(null);
    /* The cache holds this applicant's programmes, applications and profile.
       A shared phone must not show them to whoever signs in next, so it goes
       with the token rather than being left to age out. The branding and the
       downloaded logo are kept: they belong to the installation, not to a
       person, and the next sign-in screen should still be branded offline. */
    await Promise.all([
      storage.remove(TOKEN_KEY),
      storage.remove(APPLICANT_KEY),
      forgetCachedData(),
    ]);
  }, []);

  useEffect(() => {
    configureApi(
      () => tokenRef.current,
      () => {
        void signOut();
      },
    );
  }, [signOut]);

  /* Restore the previous session on cold start. */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [token, profile] = await Promise.all([
        storage.get(TOKEN_KEY),
        storage.get(APPLICANT_KEY),
      ]);

      if (cancelled) return;

      if (token && profile) {
        tokenRef.current = token;
        try {
          setApplicant(JSON.parse(profile) as Applicant);
        } catch {
          await signOut();
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [signOut]);

  const signIn = useCallback(async (applicantCode: string, password: string) => {
    const result = await authApi.login(applicantCode, password);
    tokenRef.current = result.token;
    setApplicant(result.applicant);
    await Promise.all([
      storage.set(TOKEN_KEY, result.token),
      storage.set(APPLICANT_KEY, JSON.stringify(result.applicant)),
    ]);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!tokenRef.current) return;
    const profile = await meApi.profile();
    setApplicant(profile);
    await storage.set(APPLICANT_KEY, JSON.stringify(profile));
  }, []);

  const value = useMemo<AuthState>(
    () => ({ loading, applicant, signIn, signOut, refreshProfile }),
    [loading, applicant, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
