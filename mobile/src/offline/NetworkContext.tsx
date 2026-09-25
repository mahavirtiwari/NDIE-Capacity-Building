import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Whether the device has a usable connection.
 *
 * `isInternetReachable` is the one that matters: a phone attached to a Wi-Fi
 * access point with no route out reports `isConnected` perfectly happily, and
 * a workshop hall with captive Wi-Fi is exactly where this app is used. It is
 * null until the first probe finishes, and null is treated as connected so the
 * first seconds after launch do not flash an offline banner at somebody whose
 * connection is fine.
 */
interface NetworkState {
  online: boolean;
  /** Bumped every time the connection comes back, for anything that resyncs. */
  reconnectedAt: number | null;
}

const NetworkContext = createContext<NetworkState>({ online: true, reconnectedAt: null });

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);

  useEffect(() => {
    let last = true;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const next = Boolean(state.isConnected) && state.isInternetReachable !== false;
      if (next === last) return;

      last = next;
      setOnline(next);
      if (next) setReconnectedAt(Date.now());
    });

    return unsubscribe;
  }, []);

  const value = useMemo<NetworkState>(() => ({ online, reconnectedAt }), [online, reconnectedAt]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkState {
  return useContext(NetworkContext);
}
