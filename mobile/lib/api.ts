import type { MobileEvent, MobileAnnouncement, EventSearchParams } from './types';

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

export async function fetchEventById(id: string): Promise<MobileEvent> {
  const url = `${BASE_URL}/api/events/${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch event: ${response.status}`);
  }
  const data = await response.json();
  return data.event as MobileEvent;
}

export async function fetchAnnouncements(): Promise<MobileAnnouncement[]> {
  const url = `${BASE_URL}/api/announcements`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch announcements: ${response.status}`);
  }
  const data = await response.json();
  return (data.announcements ?? []) as MobileAnnouncement[];
}

export async function registerPushToken(
  token: string,
  platform: 'ios' | 'android'
): Promise<void> {
  const url = `${BASE_URL}/api/mobile/register-push-token`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform }),
  });
  if (!response.ok) {
    throw new Error(`Failed to register push token: ${response.status}`);
  }
}
