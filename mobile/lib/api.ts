import type { MobileEvent, EventSearchParams } from './types';

// Set EXPO_PUBLIC_API_BASE_URL in .env:
//   Dev:  http://localhost:4321
//   Prod: https://dertown.com
const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4321';

export async function fetchEvents(params: EventSearchParams): Promise<MobileEvent[]> {
  const url = new URL(`${BASE_URL}/api/events/search`);
  if (params.q)        url.searchParams.set('q', params.q);
  if (params.category) url.searchParams.set('category', params.category);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status}`);
  }

  const data = await response.json();
  return (data.events ?? []) as MobileEvent[];
}
