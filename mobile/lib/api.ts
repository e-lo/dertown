import type { MobileEvent, MobileAnnouncement, MobileRelatedEvents, MobileOrganization, EventSearchParams } from './types';

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

export async function fetchRelatedEvents(
  id: string,
  opts: { seriesLimit?: number; relatedLimit?: number } = {}
): Promise<MobileRelatedEvents> {
  const url = new URL(`${BASE_URL}/api/events/${encodeURIComponent(id)}/related`);
  if (opts.seriesLimit  != null) url.searchParams.set('seriesLimit',  String(opts.seriesLimit));
  if (opts.relatedLimit != null) url.searchParams.set('relatedLimit', String(opts.relatedLimit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch related events: ${response.status}`);
  }
  const data = await response.json();
  return data as MobileRelatedEvents;
}

export interface MapVenueEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  tag: string;
}

export interface MapVenue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  eventCount: number;
  events: MapVenueEvent[];
}

/** Fetch events grouped by venue for the map tab (next N days). */
export async function fetchMapVenues(days = 3): Promise<MapVenue[]> {
  const url = new URL(`${BASE_URL}/api/events/map`);
  url.searchParams.set('from', '0');
  url.searchParams.set('to', String(days));
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Failed to fetch map data: ${response.status}`);
  const data = await response.json();
  return (data.groups ?? []) as MapVenue[];
}

export async function fetchOrganization(id: string): Promise<{
  organization: MobileOrganization;
  events: MobileEvent[];
}> {
  const url = `${BASE_URL}/api/mobile/organizations/${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch organization: ${response.status}`);
  }
  const data = await response.json();
  return data as { organization: MobileOrganization; events: MobileEvent[] };
}

export async function fetchFollowedEvents(
  orgIds: string[],
  seriesIds: string[]
): Promise<MobileEvent[]> {
  if (orgIds.length === 0 && seriesIds.length === 0) return [];
  const url = new URL(`${BASE_URL}/api/mobile/followed/events`);
  if (orgIds.length > 0)    url.searchParams.set('orgIds',    orgIds.join(','));
  if (seriesIds.length > 0) url.searchParams.set('seriesIds', seriesIds.join(','));
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch followed events: ${response.status}`);
  }
  const data = await response.json();
  return (data.events ?? []) as MobileEvent[];
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
