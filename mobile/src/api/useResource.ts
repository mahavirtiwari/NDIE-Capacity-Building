import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './client';

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  /** True only while a pull-to-refresh is in flight, so the list stays visible. */
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
  set: (value: T) => void;
}

/**
 * The fetch-once-then-refresh pattern every screen needs. `deps` behaves like
 * a `useEffect` dependency list: change it and the fetcher runs again.
 */
export function useResource<T>(fetcher: () => Promise<T>, deps: unknown[] = []): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  /* The fetcher is usually an inline arrow, so it is deliberately not a
     dependency; the caller declares what actually changes through `deps`. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await run();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof ApiError ? caught.message : 'Something went wrong. Pull to retry.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [run, tick]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTick((current) => current + 1);
  }, []);

  return { data, loading, refreshing, error, refresh, set: setData };
}
