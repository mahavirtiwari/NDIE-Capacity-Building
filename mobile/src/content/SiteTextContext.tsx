import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { siteText as siteTextApi } from '../api/endpoints';

/**
 * Wording the department can change without a new build.
 *
 * The same registry the portal reads: the server holds one list of the strings
 * that are part of the product rather than part of a record, and anything an
 * administrator has reworded comes down with the map.
 *
 * Every call carries the wording the screen shipped with, and that is what is
 * shown until the server says otherwise. So a phone with no signal, a first run
 * before the map has ever been fetched, and a key this release does not know
 * about all read properly rather than showing a gap or a key name.
 */
type Reword = (
  key: string,
  shipped: string,
  values?: Record<string, string | number>,
) => string;

const SiteTextContext = createContext<Reword>((_key, shipped) => shipped);

export function SiteTextProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void siteTextApi
      .map()
      .then((next) => {
        if (!cancelled) setMap(next);
      })
      .catch(() => {
        /* Offline, or an older server without the endpoint. The screens read
           as they shipped, which is the whole point of passing that in. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const text = useCallback<Reword>(
    (key, shipped, values) => {
      const raw = map[key] ?? shipped;
      if (!values) return raw;
      return Object.entries(values).reduce(
        (out, [name, value]) => out.split(`{${name}}`).join(String(value)),
        raw,
      );
    },
    [map],
  );

  const value = useMemo(() => text, [text]);
  return <SiteTextContext.Provider value={value}>{children}</SiteTextContext.Provider>;
}

/** The reworded string for a key, or the one the screen shipped with. */
export function useSiteText(): Reword {
  return useContext(SiteTextContext);
}
