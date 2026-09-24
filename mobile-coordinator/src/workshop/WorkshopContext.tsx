import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { workshops } from '../api/endpoints';
import type { WorkshopDetail } from '../api/types';

/**
 * The workshop currently being recorded, shared by the four tabs and the
 * capture screens behind them.
 *
 * Loaded once and refreshed after every write. Each screen re-reading it for
 * itself would show the tabs disagreeing about how many participants are
 * registered depending on which one was opened last.
 */
interface WorkshopValue {
  id: number;
  detail: WorkshopDetail | null;
  loading: boolean;
  failure: string | null;
  refresh: () => Promise<void>;
  /** True once finally submitted: every capture screen goes read only. */
  locked: boolean;
}

const WorkshopContext = createContext<WorkshopValue | null>(null);

export function WorkshopProvider({ id, children }: { id: number; children: ReactNode }) {
  const [detail, setDetail] = useState<WorkshopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setFailure(null);
    try {
      setDetail(await workshops.get(id));
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'Could not load this workshop.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const value = useMemo<WorkshopValue>(
    () => ({ id, detail, loading, failure, refresh, locked: detail?.isSubmitted ?? false }),
    [id, detail, loading, failure, refresh],
  );

  return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
}

export function useWorkshop(): WorkshopValue {
  const value = useContext(WorkshopContext);
  if (!value) throw new Error('useWorkshop must be used inside WorkshopProvider.');
  return value;
}
