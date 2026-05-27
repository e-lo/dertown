import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadStarredIds, saveStarredIds } from '../lib/stars';

interface StarContextValue {
  starredIds: Set<string>;
  toggleStar: (id: string) => void;
}

const StarContext = createContext<StarContextValue | undefined>(undefined);

export function StarProvider({ children }: { children: React.ReactNode }) {
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const hydratedRef = useRef(false);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    loadStarredIds().then((ids) => {
      setStarredIds(ids);
      hydratedRef.current = true;
    });
  }, []);

  // Persist whenever starredIds changes (but skip the initial empty Set before hydration)
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveStarredIds(starredIds);
  }, [starredIds]);

  const toggleStar = useCallback((id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <StarContext.Provider value={{ starredIds, toggleStar }}>
      {children}
    </StarContext.Provider>
  );
}

/** Access the global starred state from any screen or component. */
export function useStars() {
  const ctx = useContext(StarContext);
  if (ctx === undefined) {
    throw new Error('useStars must be used within a StarProvider');
  }
  return ctx;
}
