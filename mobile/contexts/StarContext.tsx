import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  loadStarredIds,
  saveStarredIds,
  loadStarredOrgs,
  saveStarredOrgs,
  loadStarredSeries,
  saveStarredSeries,
  loadStarredLocations,
  saveStarredLocations,
} from '../lib/stars';
import type { StarredEntity } from '../lib/stars';

interface StarContextValue {
  // ── Events ────────────────────────────────────────────────────────────────
  starredIds: Set<string>;
  toggleStar: (id: string) => void;

  // ── Organizations ─────────────────────────────────────────────────────────
  starredOrgs: StarredEntity[];
  starredOrgIds: Set<string>;
  toggleStarOrg: (entity: StarredEntity) => void;

  // ── Series (identified by parent event ID) ────────────────────────────────
  starredSeries: StarredEntity[];
  starredSeriesIds: Set<string>;
  toggleStarSeries: (entity: StarredEntity) => void;

  // ── Locations ─────────────────────────────────────────────────────────────
  starredLocations: StarredEntity[];
  starredLocationIds: Set<string>;
  toggleStarLocation: (entity: StarredEntity) => void;
}

const StarContext = createContext<StarContextValue | undefined>(undefined);

/** Toggle an entity in/out of a StarredEntity array (immutable). */
function toggleEntity(prev: StarredEntity[], entity: StarredEntity): StarredEntity[] {
  const idx = prev.findIndex((e) => e.id === entity.id);
  if (idx !== -1) {
    return prev.filter((_, i) => i !== idx);
  }
  return [...prev, entity];
}

export function StarProvider({ children }: { children: React.ReactNode }) {
  const hydratedRef = useRef(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const [starredIds,       setStarredIds]       = useState<Set<string>>(new Set());
  const [starredOrgs,      setStarredOrgs]      = useState<StarredEntity[]>([]);
  const [starredSeries,    setStarredSeries]    = useState<StarredEntity[]>([]);
  const [starredLocations, setStarredLocations] = useState<StarredEntity[]>([]);

  // ── Hydrate from AsyncStorage ──────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      loadStarredIds(),
      loadStarredOrgs(),
      loadStarredSeries(),
      loadStarredLocations(),
    ]).then(([ids, orgs, series, locations]) => {
      setStarredIds(ids);
      setStarredOrgs(orgs);
      setStarredSeries(series);
      setStarredLocations(locations);
      hydratedRef.current = true;
    });
  }, []);

  // ── Persist on change (skip initial empty state before hydration) ──────────
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveStarredIds(starredIds);
  }, [starredIds]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveStarredOrgs(starredOrgs);
  }, [starredOrgs]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveStarredSeries(starredSeries);
  }, [starredSeries]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveStarredLocations(starredLocations);
  }, [starredLocations]);

  // ── Toggle callbacks ───────────────────────────────────────────────────────
  const toggleStar = useCallback((id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleStarOrg = useCallback((entity: StarredEntity) => {
    setStarredOrgs((prev) => toggleEntity(prev, entity));
  }, []);

  const toggleStarSeries = useCallback((entity: StarredEntity) => {
    setStarredSeries((prev) => toggleEntity(prev, entity));
  }, []);

  const toggleStarLocation = useCallback((entity: StarredEntity) => {
    setStarredLocations((prev) => toggleEntity(prev, entity));
  }, []);

  // ── ID sets for O(1) lookup ────────────────────────────────────────────────
  const starredOrgIds      = useMemo(() => new Set(starredOrgs.map((e) => e.id)),      [starredOrgs]);
  const starredSeriesIds   = useMemo(() => new Set(starredSeries.map((e) => e.id)),   [starredSeries]);
  const starredLocationIds = useMemo(() => new Set(starredLocations.map((e) => e.id)), [starredLocations]);

  const value: StarContextValue = {
    starredIds,
    toggleStar,
    starredOrgs,
    starredOrgIds,
    toggleStarOrg,
    starredSeries,
    starredSeriesIds,
    toggleStarSeries,
    starredLocations,
    starredLocationIds,
    toggleStarLocation,
  };

  return <StarContext.Provider value={value}>{children}</StarContext.Provider>;
}

/** Access the global starred state from any screen or component. */
export function useStars() {
  const ctx = useContext(StarContext);
  if (ctx === undefined) {
    throw new Error('useStars must be used within a StarProvider');
  }
  return ctx;
}
