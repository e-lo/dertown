# Mobile App — Plan 2: Detail Screens & Navigation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up tap-to-detail navigation from the Events Feed to a full Event Detail screen, including a public REST API endpoint and a route restructure that supports future push screens.

**Architecture:** The current flat `app/` structure works fine for tabs but has no room for push screens (event detail, future org/location pages). This plan restructures the app to use an Expo Router route group: `app/(tabs)/` holds the 4 tabs, and `app/_layout.tsx` becomes a root Stack. Event detail lives at `app/event/[id].tsx`, pushed on top of the tab stack when a user taps a row. The Astro web app gains a public `/api/events/[id]` endpoint so the mobile app can fetch full event data.

**Tech Stack:** Expo Router v4 (route groups, Stack + Tabs), expo-linking (open maps/websites), existing `db.events.getById` Supabase query (already has lat/lng), Astro API routes.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/pages/api/events/[id].ts` | Create | Public event-by-ID REST endpoint |
| `mobile/lib/api.ts` | Modify | Add `fetchEventById(id)` |
| `mobile/app/_layout.tsx` | Modify | Become root Stack (wraps tabs + push screens) |
| `mobile/app/(tabs)/_layout.tsx` | Create | Move current tabs layout here |
| `mobile/app/(tabs)/index.tsx` | Create | Move Events Feed here; wire `onPress` navigation |
| `mobile/app/(tabs)/map.tsx` | Create | Move placeholder |
| `mobile/app/(tabs)/starred.tsx` | Create | Move placeholder |
| `mobile/app/(tabs)/news.tsx` | Create | Move placeholder |
| `mobile/app/event/[id].tsx` | Create | Event Detail screen |
| `mobile/__tests__/lib/api.test.ts` | Modify | Add `fetchEventById` test |
| `mobile/__tests__/app/EventDetail.test.tsx` | Create | Render test for EventDetail |

**Not in scope (deferred):** Organization/Location detail screens (Plan 3+), global star state (Plan 3), maps tab (Plan 5).

---

## Task 1: Public Event Detail API — `src/pages/api/events/[id].ts`

**Files:**
- Create: `src/pages/api/events/[id].ts`

The Astro web app already has `db.events.getById(id)` which selects all event fields including `location(id, name, address, latitude, longitude)`. This task exposes it as a REST endpoint for the mobile app.

- [ ] **Step 1: Create `src/pages/api/events/[id].ts`**

```typescript
import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase.ts';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return jsonError('Missing event id', 400);

  try {
    const { data: event, error } = await db.events.getById(id);

    if (error || !event) {
      return jsonError('Event not found', 404);
    }

    return jsonResponse({ event });
  } catch (err) {
    console.error('Error fetching event:', err);
    return jsonError('Internal server error', 500);
  }
};
```

- [ ] **Step 2: Verify with curl (Astro dev server must be running on port 4321)**

Use a known event ID from your database, or just verify the 404 path:

```bash
curl -s http://localhost:4321/api/events/nonexistent-id | python3 -m json.tool
```

Expected: `{"error": "Event not found"}` (or similar — any JSON error response, not HTML, confirms the route registered correctly).

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/events/\[id\].ts
git commit -m "feat(api): add public GET /api/events/[id] endpoint"
```

---

## Task 2: `fetchEventById` in `mobile/lib/api.ts`

**Files:**
- Modify: `mobile/lib/api.ts`
- Modify: `mobile/__tests__/lib/api.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `mobile/__tests__/lib/api.test.ts` (after the existing `fetchEvents` tests):

```typescript
describe('fetchEventById', () => {
  it('returns the event for a valid id', async () => {
    const mockEvent: MobileEvent = {
      id: 'abc-123',
      title: 'Detail Event',
      start_date: '2026-06-01',
      end_date: null,
      start_time: '10:00:00',
      end_time: null,
      description: 'A full description',
      website: 'https://example.com',
      registration: false,
      cost: null,
      featured: null,
      external_image_url: null,
      parent_event_id: null,
      location_id: 'loc-1',
      organization_id: 'org-1',
      primary_tag: { name: 'arts-culture' },
      secondary_tag: null,
      location: { id: 'loc-1', name: 'Icicle Creek Center', address: '7238 Icicle Rd', latitude: 47.591, longitude: -120.68 },
      organization: { name: 'Arts Alliance' },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ event: mockEvent }),
    });

    const { fetchEventById } = await import('../../lib/api');
    const result = await fetchEventById('abc-123');

    expect(result).toEqual(mockEvent);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4321/api/events/abc-123'
    );
  });

  it('throws on HTTP error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const { fetchEventById } = await import('../../lib/api');
    await expect(fetchEventById('bad-id')).rejects.toThrow('Failed to fetch event: 404');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd mobile && npx jest __tests__/lib/api.test.ts --watchAll=false
```

Expected: `FAIL` — `fetchEventById is not a function` or similar.

- [ ] **Step 3: Add `fetchEventById` to `mobile/lib/api.ts`**

The full updated `mobile/lib/api.ts`:

```typescript
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

export async function fetchEventById(id: string): Promise<MobileEvent> {
  const url = `${BASE_URL}/api/events/${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch event: ${response.status}`);
  }
  const data = await response.json();
  return data.event as MobileEvent;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd mobile && npx jest __tests__/lib/api.test.ts --watchAll=false
```

Expected: `Tests: 7 passed, 7 total` (5 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
cd mobile && git add lib/api.ts __tests__/lib/api.test.ts
git commit -m "feat(mobile): add fetchEventById to api.ts"
```

---

## Task 3: Route Restructuring — Tabs Group + Root Stack

**Files:**
- Modify: `mobile/app/_layout.tsx` (becomes root Stack)
- Create: `mobile/app/(tabs)/_layout.tsx` (current tabs content)
- Create: `mobile/app/(tabs)/index.tsx` (copy of current `app/index.tsx`)
- Create: `mobile/app/(tabs)/map.tsx` (copy of current `app/map.tsx`)
- Create: `mobile/app/(tabs)/starred.tsx` (copy of current `app/starred.tsx`)
- Create: `mobile/app/(tabs)/news.tsx` (copy of current `app/news.tsx`)

No unit tests for this task — routing is validated structurally by running the app. Run `npx jest` to confirm existing tests still pass after the refactor.

**Why route groups?** Expo Router v4 uses `(groupName)` folders to group routes without affecting the URL. `app/(tabs)/index.tsx` is still accessible at `/` (the root route). This pattern lets us add push screens (like `app/event/[id].tsx`) that appear in a Stack on top of the tab interface.

- [ ] **Step 1: Create `mobile/app/(tabs)/` directory and move tab files**

Create the directory:
```bash
mkdir -p mobile/app/\(tabs\)
```

Create `mobile/app/(tabs)/_layout.tsx` — the current tabs layout (identical content to current `mobile/app/_layout.tsx`):

```typescript
import React from 'react';
import { Tabs } from 'expo-router';
import { THEME } from '../../lib/theme';
import { Icon } from '../../components/Icon';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: THEME.tabBarBackground,
          borderTopColor: 'rgba(255,255,255,0.08)',
        },
        tabBarActiveTintColor:   THEME.tabBarActive,
        tabBarInactiveTintColor: THEME.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => <Icon name="map" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="starred"
        options={{
          title: 'Starred',
          tabBarIcon: ({ color, size }) => <Icon name="star" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarIcon: ({ color, size }) => <Icon name="bell" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

Note the import paths changed from `'../lib/theme'` to `'../../lib/theme'` (one level deeper in `(tabs)/`).

- [ ] **Step 2: Create the three placeholder screens under `(tabs)/`**

`mobile/app/(tabs)/map.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../lib/theme';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Map coming in Plan 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.feedBackground, alignItems: 'center', justifyContent: 'center' },
  text: { color: THEME.textMuted, fontSize: 16 },
});
```

`mobile/app/(tabs)/starred.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../lib/theme';

export default function StarredScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Starred events — coming in Plan 3</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.feedBackground, alignItems: 'center', justifyContent: 'center' },
  text: { color: THEME.textMuted, fontSize: 16 },
});
```

`mobile/app/(tabs)/news.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../lib/theme';

export default function NewsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Announcements — coming in Plan 4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.feedBackground, alignItems: 'center', justifyContent: 'center' },
  text: { color: THEME.textMuted, fontSize: 16 },
});
```

- [ ] **Step 3: Create `mobile/app/(tabs)/index.tsx`**

This is a copy of the current `mobile/app/index.tsx` with two changes:
1. Import paths updated (one level deeper)
2. `onPress` wired to navigate (handled in Task 5 — for now copy the no-op version)

```typescript
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ListRenderItem,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { THEME } from '../../lib/theme';
import { CONSTANTS } from '../../../src/lib/config';
import { fetchEvents } from '../../lib/api';
import { filterUpcoming, groupEventsByDate, getTodayDateString } from '../../lib/dateUtils';
import { EventRow } from '../../components/EventRow';
import { DayHeader } from '../../components/DayHeader';
import { CategoryPills } from '../../components/CategoryPills';
import { DatePickerModal } from '../../components/DatePickerModal';
import { Icon } from '../../components/Icon';
import type { MobileEvent } from '../../lib/types';

type ListItem =
  | { type: 'header'; date: string }
  | { type: 'event'; event: MobileEvent };

const CATEGORIES = CONSTANTS.tagCategories as unknown as string[];

export default function EventsScreen() {
  const [events, setEvents]                     = useState<MobileEvent[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [selectedCategory, setCategory]         = useState<string | null>(null);
  const [searchQuery, setSearchQuery]           = useState('');
  const [searchExpanded, setSearchExpanded]     = useState(false);
  const [selectedDate, setSelectedDate]         = useState(getTodayDateString());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [starredIds, setStarredIds]             = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList>(null);

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

  const filteredEvents = useMemo(() => {
    let result = events;
    if (selectedCategory) {
      result = result.filter(
        (e) =>
          e.primary_tag?.name === selectedCategory ||
          e.secondary_tag?.name === selectedCategory
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.location?.name.toLowerCase().includes(q) ?? false) ||
          (e.organization?.name.toLowerCase().includes(q) ?? false) ||
          (e.primary_tag?.name.toLowerCase().includes(q) ?? false) ||
          (e.secondary_tag?.name.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [events, selectedCategory, searchQuery]);

  const listItems: ListItem[] = useMemo(() => {
    const groups = groupEventsByDate(filteredEvents);
    const items: ListItem[] = [];
    for (const group of groups) {
      items.push({ type: 'header', date: group.date });
      for (const event of group.events) {
        items.push({ type: 'event', event });
      }
    }
    return items;
  }, [filteredEvents]);

  function toggleStar(id: string) {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    const idx = listItems.findIndex(
      (item) => item.type === 'header' && item.date >= date
    );
    if (idx >= 0) {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewOffset: 0 });
    }
  }

  const headerLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  const renderItem: ListRenderItem<ListItem> = ({ item }) => {
    if (item.type === 'header') return <DayHeader dateStr={item.date} />;
    return (
      <EventRow
        event={item.event}
        isStarred={starredIds.has(item.event.id)}
        onPress={() => {/* navigation wired in Task 5 */}}
        onStar={() => toggleStar(item.event.id)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDatePickerVisible(true)} style={styles.headerBtn}>
          <Icon name="calendar" size={22} color={THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerLabel} · Leavenworth</Text>
        <TouchableOpacity
          onPress={() => setSearchExpanded((v) => !v)}
          style={styles.headerBtn}
        >
          <Icon name={searchExpanded ? 'x' : 'search'} size={22} color={THEME.textPrimary} />
        </TouchableOpacity>
      </View>

      {searchExpanded && (
        <View style={styles.searchBar}>
          <Icon name="search" size={16} color={THEME.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events, locations, orgs…"
            placeholderTextColor={THEME.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x" size={16} color={THEME.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <CategoryPills
        categories={CATEGORIES}
        selected={selectedCategory}
        onSelect={setCategory}
      />

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={THEME.canary} size="large" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadEvents} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={(item) =>
            item.type === 'header' ? `hdr-${item.date}` : `ev-${item.event.id}`
          }
          renderItem={renderItem}
          style={styles.list}
          onScrollToIndexFailed={() => {/* no-op — index may be out of range */}}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No events found</Text>
            </View>
          }
        />
      )}

      <DatePickerModal
        visible={datePickerVisible}
        selectedDate={selectedDate}
        onSelect={handleDateSelect}
        onClose={() => setDatePickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.feedBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME.tabBarBackground,
  },
  headerBtn: { padding: 6 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: THEME.textPrimary },
  list: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: { color: '#f87171', fontSize: 14, marginBottom: 12 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: THEME.canary,
  },
  retryText: { color: '#111827', fontWeight: '700' },
  emptyText: { color: THEME.textMuted, fontSize: 15 },
});
```

- [ ] **Step 4: Replace `mobile/app/_layout.tsx` with root Stack**

Overwrite `mobile/app/_layout.tsx` with:

```typescript
import { Stack } from 'expo-router';
import { THEME } from '../lib/theme';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: THEME.tabBarBackground },
        headerTintColor: THEME.textPrimary,
        headerTitleStyle: { fontSize: 16, fontWeight: '700' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="event/[id]" options={{ title: 'Event Details' }} />
    </Stack>
  );
}
```

- [ ] **Step 5: Delete the old flat app files**

```bash
rm mobile/app/index.tsx mobile/app/map.tsx mobile/app/starred.tsx mobile/app/news.tsx
```

The old `mobile/app/_layout.tsx` has already been overwritten in Step 4.

- [ ] **Step 6: Run all tests to confirm nothing broke**

```bash
cd mobile && npx jest --watchAll=false
```

Expected: `Tests: 44 passed` (42 original + 2 new from Task 2).

- [ ] **Step 7: Commit**

```bash
git add mobile/app/
git commit -m "refactor(mobile): move tabs into (tabs) group, add root Stack layout"
```

---

## Task 4: Event Detail Screen — `mobile/app/event/[id].tsx`

**Files:**
- Create: `mobile/app/event/[id].tsx`
- Create: `mobile/__tests__/app/EventDetail.test.tsx`

The detail screen:
- Fetches the event by ID on mount
- Shows a colored hero card (reusing `getCategoryColor`)
- Shows location (tappable → opens Maps), organization, description, cost
- Shows website / register buttons if present
- Has a star toggle (local state, not persisted — Plan 3 adds AsyncStorage)

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/app/EventDetail.test.tsx`:

```typescript
import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';

// Mock expo-router
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'test-event-id' }),
  Stack: {
    Screen: ({ options }: { options: object }) => null,
  },
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

// Mock api
jest.mock('../../lib/api', () => ({
  fetchEventById: jest.fn(),
}));

import { fetchEventById } from '../../lib/api';
import EventDetailScreen from '../../app/event/[id]';
import type { MobileEvent } from '../../lib/types';

const mockEvent: MobileEvent = {
  id: 'test-event-id',
  title: 'Alpine Jazz Night',
  start_date: '2026-06-15',
  end_date: null,
  start_time: '19:00:00',
  end_time: '22:00:00',
  description: 'An evening of jazz in the mountains.',
  website: 'https://example.com/jazz',
  registration: false,
  cost: '$15',
  featured: null,
  external_image_url: null,
  parent_event_id: null,
  location_id: 'loc-1',
  organization_id: 'org-1',
  primary_tag: { name: 'arts-culture' },
  secondary_tag: null,
  location: { id: 'loc-1', name: 'Icicle Creek Center', address: '7238 Icicle Rd', latitude: 47.591, longitude: -120.68 },
  organization: { name: 'Icicle Arts' },
};

describe('EventDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading indicator then renders event details', async () => {
    (fetchEventById as jest.Mock).mockResolvedValue(mockEvent);

    const { getByText, queryByText } = render(<EventDetailScreen />);

    // After fetch resolves, event data appears
    await waitFor(() => {
      expect(getByText('Alpine Jazz Night')).toBeTruthy();
    });

    expect(getByText('Icicle Creek Center')).toBeTruthy();
    expect(getByText('Icicle Arts')).toBeTruthy();
    expect(getByText('An evening of jazz in the mountains.')).toBeTruthy();
    expect(getByText('$15')).toBeTruthy();
  });

  it('shows error message when fetch fails', async () => {
    (fetchEventById as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { getByText } = render(<EventDetailScreen />);

    await waitFor(() => {
      expect(getByText('Network error')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd mobile && npx jest __tests__/app/EventDetail.test.tsx --watchAll=false
```

Expected: `FAIL` — cannot find module `../../app/event/[id]`.

- [ ] **Step 3: Create `mobile/app/event/[id].tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { THEME, getCategoryColor } from '../../lib/theme';
import { fetchEventById } from '../../lib/api';
import { formatTimeRange, formatDayHeader } from '../../lib/dateUtils';
import { Icon } from '../../components/Icon';
import type { MobileEvent } from '../../lib/types';

function openMaps(location: NonNullable<MobileEvent['location']>) {
  const { name, address, latitude, longitude } = location;
  const query = encodeURIComponent(address ?? name);
  if (latitude && longitude) {
    const url =
      Platform.OS === 'ios'
        ? `maps://0,0?q=${query}&ll=${latitude},${longitude}`
        : `geo:${latitude},${longitude}?q=${query}`;
    Linking.canOpenURL(url).then((can) => {
      Linking.openURL(can ? url : `https://maps.google.com/?q=${latitude},${longitude}`);
    });
  } else {
    Linking.openURL(`https://maps.google.com/?q=${query}`);
  }
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<MobileEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarred, setIsStarred] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchEventById(id)
      .then((data) => {
        setEvent(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to load event');
        setLoading(false);
      });
  }, [id]);

  const bgColor = getCategoryColor(event?.primary_tag?.name ?? null);

  const { dayOfWeek, dayNum, month } =
    event ? formatDayHeader(event.start_date) : { dayOfWeek: '', dayNum: '', month: '' };

  const timeStr = event
    ? formatTimeRange(event.start_time, event.end_time)
    : '';

  return (
    <>
      {/* Configure the header title to show the event name after loading */}
      <Stack.Screen
        options={{
          title: event?.title ?? 'Event Details',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setIsStarred((v) => !v)}
              style={{ paddingRight: 4 }}
            >
              <Icon
                name="star"
                size={22}
                color={isStarred ? THEME.starFilled : THEME.starUnstarred}
              />
            </TouchableOpacity>
          ),
        }}
      />

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={THEME.canary} size="large" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && event && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Hero card */}
          <View style={[styles.hero, { backgroundColor: bgColor }]}>
            <Text style={styles.heroTitle}>{event.title}</Text>
            <Text style={styles.heroDate}>
              {dayOfWeek}, {month} {dayNum}
            </Text>
            {timeStr ? <Text style={styles.heroTime}>{timeStr}</Text> : null}

            {/* Category pills */}
            <View style={styles.pills}>
              {event.primary_tag ? (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{event.primary_tag.name}</Text>
                </View>
              ) : null}
              {event.secondary_tag ? (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{event.secondary_tag.name}</Text>
                </View>
              ) : null}
              {event.registration ? (
                <View style={[styles.pill, styles.regPill]}>
                  <Text style={styles.pillText}>Register</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Details section */}
          <View style={styles.details}>
            {/* Location */}
            {event.location ? (
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => openMaps(event.location!)}
              >
                <Icon name="map" size={18} color={THEME.canary} />
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>{event.location.name}</Text>
                  {event.location.address ? (
                    <Text style={styles.detailSub}>{event.location.address}</Text>
                  ) : null}
                </View>
                <Icon name="chevron-right" size={16} color={THEME.textMuted} />
              </TouchableOpacity>
            ) : null}

            {/* Organization */}
            {event.organization ? (
              <View style={styles.detailRow}>
                <Icon name="home" size={18} color={THEME.canary} />
                <Text style={[styles.detailLabel, { flex: 1 }]}>
                  {event.organization.name}
                </Text>
              </View>
            ) : null}

            {/* Cost */}
            {event.cost ? (
              <View style={styles.detailRow}>
                <Icon name="check" size={18} color={THEME.canary} />
                <Text style={[styles.detailLabel, { flex: 1 }]}>{event.cost}</Text>
              </View>
            ) : null}

            {/* Description */}
            {event.description ? (
              <View style={styles.descriptionBlock}>
                <Text style={styles.description}>{event.description}</Text>
              </View>
            ) : null}

            {/* Action buttons */}
            <View style={styles.actions}>
              {event.website ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => Linking.openURL(event.website!)}
                >
                  <Text style={styles.actionBtnText}>Visit Website</Text>
                </TouchableOpacity>
              ) : null}

              {event.registration && event.website ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.registerBtn]}
                  onPress={() => Linking.openURL(event.website!)}
                >
                  <Text style={[styles.actionBtnText, styles.registerBtnText]}>
                    Register
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: THEME.feedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
  },
  scroll: {
    flex: 1,
    backgroundColor: THEME.feedBackground,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    padding: 20,
    paddingBottom: 24,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 6,
    lineHeight: 28,
  },
  heroDate: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  heroTime: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: 12,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  regPill: {
    backgroundColor: '#166534',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  details: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 0,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 15,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  detailSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  descriptionBlock: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  description: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 22,
  },
  actions: {
    gap: 10,
    paddingTop: 20,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  registerBtn: {
    backgroundColor: '#166534',
    borderColor: '#166534',
  },
  registerBtnText: {
    color: '#ffffff',
  },
});
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd mobile && npx jest __tests__/app/EventDetail.test.tsx --watchAll=false
```

Expected: `Tests: 2 passed, 2 total`.

- [ ] **Step 5: Run the full test suite**

```bash
cd mobile && npx jest --watchAll=false
```

Expected: `Tests: 46 passed` (44 + 2 new).

- [ ] **Step 6: Commit**

```bash
git add mobile/app/event/ mobile/__tests__/app/
git commit -m "feat(mobile): add Event Detail screen"
```

---

## Task 5: Wire Navigation in Events Feed

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

Wire the `onPress` stub in `EventRow` to navigate to the Event Detail screen. The navigation uses `expo-router`'s `useRouter` hook.

- [ ] **Step 1: Update `mobile/app/(tabs)/index.tsx`**

Add the `useRouter` import and wire `onPress`:

At the top, add to the `expo-router` import:
```typescript
import { useFocusEffect, useRouter } from 'expo-router';
```

Add inside `EventsScreen()` (after the `listRef` line):
```typescript
const router = useRouter();
```

Replace the no-op `onPress` in `renderItem`:
```typescript
const renderItem: ListRenderItem<ListItem> = ({ item }) => {
  if (item.type === 'header') return <DayHeader dateStr={item.date} />;
  return (
    <EventRow
      event={item.event}
      isStarred={starredIds.has(item.event.id)}
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.event.id } })}
      onStar={() => toggleStar(item.event.id)}
    />
  );
};
```

The full updated section of the file (show context around the change):

```typescript
// ... (all imports and state same as Task 3 Step 3, with this addition) ...
import { useFocusEffect, useRouter } from 'expo-router';

// Inside EventsScreen():
  const router = useRouter();

// Replace renderItem:
  const renderItem: ListRenderItem<ListItem> = ({ item }) => {
    if (item.type === 'header') return <DayHeader dateStr={item.date} />;
    return (
      <EventRow
        event={item.event}
        isStarred={starredIds.has(item.event.id)}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.event.id } })}
        onStar={() => toggleStar(item.event.id)}
      />
    );
  };
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
cd mobile && npx jest --watchAll=false
```

Expected: `Tests: 46 passed, 46 total`.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(tabs\)/index.tsx
git commit -m "feat(mobile): wire EventRow onPress to navigate to event detail"
```

---

## Task 6: Smoke Test in Expo Go

This verifies navigation works end-to-end — unit tests can't confirm Expo Router push mechanics.

- [ ] **Step 1: Start Astro dev server**

```bash
npm run dev
```

Expected: Astro running at `http://localhost:4321`

- [ ] **Step 2: Start Expo dev server**

```bash
cd mobile && npx expo start
```

Expected: QR code in terminal, no bundler errors.

- [ ] **Step 3: Open in Expo Go and verify navigation**

Confirm:
- [ ] Events Feed tab loads (same as before)
- [ ] Tapping any event row pushes to the Event Detail screen (dark background, colored hero card)
- [ ] Event title, date, time appear in hero
- [ ] Location row appears; tapping opens Maps
- [ ] Back button returns to Events Feed
- [ ] Star icon in header toggles between dim-white and canary-yellow
- [ ] If event has a website, "Visit Website" button appears and opens browser
- [ ] If event has registration=true, "Register" button (green) appears
- [ ] If event has description, it appears below the detail rows
- [ ] Cost appears if event has it

---

## Self-Review Notes

**Spec coverage:**
- ✅ Public `/api/events/[id]` endpoint (Task 1)
- ✅ `fetchEventById` with tests (Task 2)
- ✅ Route restructure enabling push navigation (Task 3)
- ✅ Event detail screen with all fields (Task 4)
- ✅ Navigation wired from Events Feed (Task 5)
- ✅ Smoke test checklist (Task 6)

**YAGNI decisions:**
- No Organization detail screen (links to website would need org.website field — deferred to Plan 3)
- No Location detail screen (only needs Maps link — implemented in detail screen already)
- Star state is local to detail screen — AsyncStorage persistence is Plan 3
- No related events section — deferred to Plan 3

**Type consistency:**
- `MobileEvent.location` type used in `openMaps` matches `mobile/lib/types.ts` definition
- `fetchEventById` returns `Promise<MobileEvent>` — matches what the detail screen expects
- `useLocalSearchParams<{ id: string }>()` returns `id: string` — matches `fetchEventById(id: string)` signature
