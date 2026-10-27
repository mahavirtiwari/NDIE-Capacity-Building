import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { workshops } from '../api/endpoints';
import type { WorkshopDetail } from '../api/types';
import { indiaToday } from './today';

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
  /** True once finally submitted: every screen, submission included, is read only. */
  locked: boolean;
  /**
   * True when nothing more may be captured: submitted, or the programme's
   * dates have passed.
   *
   * The server refuses every capture outside the programme's own days -
   * the sessions, the venue, the trainers, the register - and said so only
   * when the coordinator pressed save. They would fill a form at a venue,
   * take the photograph, and be told then that the course had ended.
   *
   * Separate from locked because submission is the one write that belongs
   * after the batch: the report is written up once it is over, which is
   * the point of it. The submit screen asks locked; everything that
   * captures asks this.
   */
  readOnly: boolean;
  /** Why, for the banner at the top of each screen. Null while open. */
  readOnlyReason: string | null;
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

  const value = useMemo<WorkshopValue>(() => {
    const locked = detail?.isSubmitted ?? false;

    /* India's today, from the one helper that knows it. The rule being
       anticipated here is the server's, and the server's day is India's. */
    const today = indiaToday();

    const reason = locked
      ? 'Finally submitted — these screens are read only.'
      : detail && today < detail.startDate
        ? `This program starts on ${detail.startDate}. There is nothing to record yet.`
        : detail && today > detail.endDate
          ? `This program ended on ${detail.endDate}. Nothing more can be recorded, `
            + 'but the report can still be submitted.'
          : null;

    return {
      id,
      detail,
      loading,
      failure,
      refresh,
      locked,
      readOnly: reason !== null,
      readOnlyReason: reason,
    };
  }, [id, detail, loading, failure, refresh]);

  return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
}

export function useWorkshop(): WorkshopValue {
  const value = useContext(WorkshopContext);
  if (!value) throw new Error('useWorkshop must be used inside WorkshopProvider.');
  return value;
}
