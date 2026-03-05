import { formatEventDate, formatTime } from './event-utils';
import { getTodayLocale } from './supabase';

export type MapLocation = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

export type MapOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type MapEventItem = {
  id: string;
  title: string;
  startDate: string;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  detailUrl: string;
  primaryTag: string | null;
  secondaryTag: string | null;
  primaryTagSlug: string | null;
  secondaryTagSlug: string | null;
  organization: MapOrganization | null;
  location: MapLocation;
  displayDate: string;
  displayTime: string;
};

export type GroupedMapEvents = {
  id: string;
  name: string;
  address: string;
  eventCount: number;
  latitude: number;
  longitude: number;
  sortKey?: string;
  events: Array<{
    id: string;
    title: string;
    date: string;
    time: string;
    tag: string;
    detailUrl: string;
  }>;
};

export type EventMapFilters = {
  fromOffset: number;
  toOffset: number;
  startDate: string;
  endDate: string;
  selectedTag: string;
  selectedOrg: string;
};

type RawJoinedEvent = {
  id: string | null;
  title: string | null;
  start_date: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  primary_tag?: { id?: string | null; name?: string | null } | null;
  secondary_tag?: { id?: string | null; name?: string | null } | null;
  primary_tag_name?: string | null;
  secondary_tag_name?: string | null;
  organization?: { id?: string | null; name?: string | null } | null;
  location?: {
    id?: string | null;
    name?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function slugify(value: string | null | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function coerceOffset(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(parsed, max));
}

export function resolveEventMapFilters(searchParams: URLSearchParams): EventMapFilters {
  const baseDate = getTodayLocale();
  const fromOffset = coerceOffset(searchParams.get('from'), 0, 21);
  const rawTo = coerceOffset(searchParams.get('to'), 10, 30);
  const toOffset = Math.max(rawTo, fromOffset + 1);

  return {
    fromOffset,
    toOffset,
    startDate: addDays(baseDate, fromOffset),
    endDate: addDays(baseDate, toOffset),
    selectedTag: slugify(searchParams.get('tag')),
    selectedOrg: searchParams.get('org') || '',
  };
}

function eventSortValue(event: { startDate: string; startTime: string | null }): string {
  return `${event.startDate}T${event.startTime || '00:00:00'}`;
}

function overlapsRange(
  event: {
    startDate: string;
    endDate: string | null;
  },
  filters: EventMapFilters
): boolean {
  const eventEnd = event.endDate || event.startDate;
  return event.startDate <= filters.endDate && eventEnd >= filters.startDate;
}

export function normalizeMapEvents(rawEvents: RawJoinedEvent[]): MapEventItem[] {
  return rawEvents
    .flatMap((event) => {
      const location = event.location;
      if (!event?.id || !event?.title || !event?.start_date) return [];
      if (!location?.id || !location?.name) return [];
      if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number')
        return [];

      const { month, day, dayOfWeek } = formatEventDate(event.start_date);
      const displayDate = `${dayOfWeek}, ${month} ${day}`;
      const displayTime = event.start_time ? formatTime(event.start_time) : 'All day';
      const primaryTag = event.primary_tag?.name || event.primary_tag_name || null;
      const secondaryTag = event.secondary_tag?.name || event.secondary_tag_name || null;
      const organizationName = event.organization?.name || null;

      return [
        {
          id: event.id,
          title: event.title,
          startDate: event.start_date,
          startTime: event.start_time || null,
          endDate: event.end_date || null,
          endTime: event.end_time || null,
          detailUrl: `/events/${event.id}`,
          primaryTag,
          secondaryTag,
          primaryTagSlug: slugify(primaryTag),
          secondaryTagSlug: slugify(secondaryTag),
          organization:
            event.organization?.id && organizationName
              ? {
                  id: event.organization.id,
                  name: organizationName,
                  slug: slugify(organizationName),
                }
              : null,
          location: {
            id: location.id,
            name: location.name,
            address: location.address || null,
            latitude: location.latitude,
            longitude: location.longitude,
          },
          displayDate,
          displayTime,
        } satisfies MapEventItem,
      ];
    })
    .sort((a, b) => eventSortValue(a).localeCompare(eventSortValue(b)));
}

export function filterMapEvents(events: MapEventItem[], filters: EventMapFilters): MapEventItem[] {
  return events.filter((event) => {
    if (!overlapsRange(event, filters)) return false;

    if (filters.selectedTag) {
      const matchesTag =
        event.primaryTagSlug === filters.selectedTag ||
        event.secondaryTagSlug === filters.selectedTag;
      if (!matchesTag) return false;
    }

    if (filters.selectedOrg) {
      const matchesOrg =
        event.organization?.id === filters.selectedOrg ||
        event.organization?.slug === filters.selectedOrg;
      if (!matchesOrg) return false;
    }

    return true;
  });
}

export function groupMapEvents(events: MapEventItem[]): GroupedMapEvents[] {
  const grouped = new Map<string, GroupedMapEvents>();

  events.forEach((event) => {
    const existing = grouped.get(event.location.id);
    const eventSummary = {
      id: event.id,
      title: event.title,
      date: event.displayDate,
      time: event.displayTime,
      tag: event.primaryTag || event.secondaryTag || 'Event',
      detailUrl: event.detailUrl,
    };

    if (existing) {
      existing.eventCount += 1;
      existing.events.push(eventSummary);
      return;
    }

    grouped.set(event.location.id, {
      id: event.location.id,
      name: event.location.name,
      address: event.location.address || 'Address unavailable',
      eventCount: 1,
      latitude: event.location.latitude,
      longitude: event.location.longitude,
      sortKey: eventSortValue(event),
      events: [eventSummary],
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.sortKey && b.sortKey) {
      const sortOrder = a.sortKey.localeCompare(b.sortKey);
      if (sortOrder !== 0) return sortOrder;
    }
    return a.name.localeCompare(b.name);
  });
}

export function buildEventMapState(rawEvents: RawJoinedEvent[], searchParams: URLSearchParams) {
  const filters = resolveEventMapFilters(searchParams);
  const normalizedEvents = normalizeMapEvents(rawEvents);
  const filteredEvents = filterMapEvents(normalizedEvents, filters);
  const groups = groupMapEvents(filteredEvents);

  const tags = Array.from(
    new Set(
      normalizedEvents
        .flatMap((event) => [event.primaryTag, event.secondaryTag])
        .filter(Boolean) as string[]
    )
  )
    .map((name) => ({ name, slug: slugify(name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const organizations = Array.from(
    new Map(
      normalizedEvents
        .filter((event) => event.organization)
        .map((event) => [event.organization!.id, event.organization!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  return {
    filters,
    tags,
    organizations,
    events: filteredEvents,
    groups,
  };
}
