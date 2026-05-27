import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchEvents } from '../lib/api';
import { filterUpcoming } from '../lib/dateUtils';
import type { MobileEvent } from '../lib/types';

/**
 * Fetches all upcoming events and refreshes when the screen comes into focus.
 * Returns { events, loading, error, reload }.
 */
export function useEventList(): {
  events: MobileEvent[];
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [events, setEvents] = useState<MobileEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchEvents({})
      .then((data) => {
        setEvents(filterUpcoming(data));
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to load events');
        setLoading(false);
      });
  }, []);

  useFocusEffect(loadEvents);

  return { events, loading, error, reload: loadEvents };
}
