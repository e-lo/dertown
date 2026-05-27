import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadStarredIds, saveStarredIds } from '../lib/stars';

interface StarContextValue {
  starredIds: Set<string>;
  toggleStar: (id: string) => void;
}

const StarContext = createContext<StarContextValue>({
  starredIds: new Set(),
  toggleStar: () => {},
});

export function StarProvider({ children }: { children: React.ReactNode }) {
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    loadStarredIds().then(setStarredIds);
  }, []);

  const toggleStar = useCallback((id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveStarredIds(next); // fire-and-forget
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
  return useContext(StarContext);
}
