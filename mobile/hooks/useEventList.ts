import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { AppState } from 'react-native';
import { fetchEvents } from '../lib/api';
import { getCache, setCache } from '../lib/cache';
import { filterUpcoming } from '../lib/dateUtils';
import { useBlocked } from '../contexts/BlockContext';
import type { MobileEvent } from '../lib/types';

const CACHE_KEY = 'events:all';

/**
 * Manages the main event list with two-layer caching (memory + AsyncStorage).
 *
 * Behaviour:
 *   - On mount: show cached data immediately (no spinner if cache exists),
 *     then silently refresh in the background if the cache is stale.
 *   - On app foreground: silently refresh if cache is stale.
 *   - Pull-to-refresh: always fetches fresh data and shows the refresh indicator.
 *   - Offline: cached data continues to display; errors are suppressed when
 *     there is already data to show.
 */
export function useEventList(): {
  events: MobileEvent[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
  reload: () => void;
} {
  const [events, setEvents]         = useState<MobileEvent[]>([]);
  const [loading, setLoading]       = useState(true);    // true only when we have nothing to show
  const [refreshing, setRefreshing] = useState(false);   // pull-to-refresh indicator
  const [error, setError]           = useState<string | null>(null);
  const fetchingRef                 = useRef(false);      // guard against concurrent fetches
  const { blockedOrgIds }           = useBlocked();

  // Hide content from blocked organizers instantly (Guideline 1.2) — applied
  // at render time so blocking/unblocking takes effect without a refetch.
  const visibleEvents = useMemo(
    () =>
      blockedOrgIds.size === 0
        ? events
        : events.filter((e) => !e.organization_id || !blockedOrgIds.has(e.organization_id)),
    [events, blockedOrgIds]
  );

  /** Core fetch — updates state and cache. */
  const doFetch = useCallback(async (opts: { pullToRefresh?: boolean } = {}) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (opts.pullToRefresh) setRefreshing(true);

    try {
      const data = await fetchEvents({});
      const filtered = filterUpcoming(data);
      setEvents(filtered);
      setError(null);
      await setCache(CACHE_KEY, filtered);
    } catch (err: unknown) {
      // Only surface the error when we have nothing cached to fall back on
      setEvents((prev) => {
        if (prev.length === 0) {
          setError((err as Error).message ?? 'Failed to load events');
        }
        return prev;
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, []);

  // Mount: load cache instantly, then refresh in background if stale
  useEffect(() => {
    async function init() {
      const cached = await getCache<MobileEvent[]>(CACHE_KEY);
      if (cached) {
        setEvents(cached.data);
        setLoading(false);
        if (cached.stale) doFetch(); // background refresh, no spinner
      } else {
        doFetch(); // nothing cached — show full spinner until first load
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Foreground: silently refresh if the cache has gone stale while backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        getCache<MobileEvent[]>(CACHE_KEY).then((cached) => {
          if (!cached || cached.stale) doFetch();
        });
      }
    });
    return () => sub.remove();
  }, [doFetch]);

  const refresh = useCallback(() => doFetch({ pullToRefresh: true }), [doFetch]);
  const reload  = useCallback(() => doFetch(), [doFetch]);

  return { events: visibleEvents, loading, refreshing, error, refresh, reload };
}
