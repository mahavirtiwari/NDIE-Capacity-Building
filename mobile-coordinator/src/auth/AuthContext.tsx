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
import { configureApi } from '../api/client';
import { auth } from '../api/endpoints';
import type { LoginResponse } from '../api/types';

/**
 * The signed-in coordinator.
 *
 * The token is held in memory and mirrored into the device keystore, so the app
 * survives being backgrounded at a venue without the token ever touching plain
 * AsyncStorage. A 401 from anywhere clears it and drops back to sign-in.
 */
interface Session {
  token: string;
  userCode: string;
  fullName: string;
}

interface AuthValue {
  session: Session | null;
  /** Null while the stored session is still being read at start-up. */
  restoring: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const KEY = 'cbms.coordinator.session';

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  /* Read through a ref: the API client asks for the token on every request and
     must see the current one, not the one captured when it was configured. */
  const current = useRef<Session | null>(null);
  current.current = session;

  const signOut = useCallback(async () => {
    setSession(null);
    await SecureStore.deleteItemAsync(KEY).catch(() => {});
  }, []);

  useEffect(() => {
    configureApi(
      () => current.current?.token ?? null,
      () => {
        setSession(null);
        SecureStore.deleteItemAsync(KEY).catch(() => {});
      },
      /* The outbox stamps queued work with whoever recorded it. */
      () => current.current?.userCode ?? null,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(KEY);
        if (!cancelled && stored) setSession(JSON.parse(stored) as Session);
      } catch {
        /* A keystore that cannot be read is the same as no session. */
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const result: LoginResponse = await auth.login(username.trim(), password);
    const next: Session = {
      token: result.token,
      userCode: result.user.userCode,
      fullName: result.user.fullName,
    };
    setSession(next);
    await SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ session, restoring, signIn, signOut }),
    [session, restoring, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
