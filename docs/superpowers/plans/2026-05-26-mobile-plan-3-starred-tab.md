# Mobile App — Plan 3: Starred Tab & Persistence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace in-memory star state with AsyncStorage-persisted global context, build the real Starred Tab screen, and add a native Share button to the Event Detail screen.

**Architecture:** A `StarContext` React Context wraps the root Stack layout, providing `starredIds: Set<string>` and `toggleStar(id)` to all screens. It hydrates from AsyncStorage on mount and persists on every toggle. The Starred Tab fetches all upcoming events and filters them client-side against `starredIds`. The Share button uses React Native's built-in `Share` API — no additional packages required.

**Tech Stack:** `@react-native-async-storage/async-storage` (new dep), React Context, React Native `Share` API (built-in), existing `fetchEvents` + `EventRow` + `DayHeader`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `mobile/package.json` | Modify | Add `@react-native-async-storage/async-storage` dep + jest mock setup |
| `mobile/lib/stars.ts` | Create | `loadStarredIds()` / `saveStarredIds()` via AsyncStorage |
| `mobile/contexts/StarContext.tsx` | Create | React Context: `starredIds`, `toggleStar`, `StarProvider`, `useStars` |
| `mobile/app/_layout.tsx` | Modify | Wrap Stack with `<StarProvider>` |
| `mobile/app/(tabs)/index.tsx` | Modify | Replace local star state with `useStars()` |
| `mobile/app/event/[id].tsx` | Modify | Replace local star state with `useStars()`; add Share button |
| `mobile/app/(tabs)/starred.tsx` | Modify | Build real Starred Tab screen |
| `mobile/__tests__/lib/stars.test.ts` | Create | Unit tests for AsyncStorage helpers |
| `mobile/__tests__/contexts/StarContext.test.tsx` | Create | Unit tests for StarProvider |

---

## Task 1: Install AsyncStorage + Configure Jest Mock

**Files:**
- Modify: `mobile/package.json`

No unit tests for this task — just dependency setup. Verify by running the existing test suite after install.

- [ ] **Step 1: Install the package**

```bash
cd /path/to/worktree/mobile
npm install @react-native-async-storage/async-storage --legacy-peer-deps
```

- [ ] **Step 2: Update `mobile/package.json` jest config**

The current jest config in `package.json` looks like:
```json
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts|react-navigation|@react-navigation/.*|lucide-react-native|react-native-svg)"
  ]
}
```

Update it to add `setupFiles` for the AsyncStorage mock and add `@react-native-async-storage` to `transformIgnorePatterns`:

```json
"jest": {
  "preset": "jest-expo",
  "setupFiles": [
    "@react-native-async-storage/async-storage/jest/async-storage-mock"
  ],
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts|react-navigation|@react-navigation/.*|lucide-react-native|react-native-svg|@react-native-async-storage)"
  ]
}
```

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
cd mobile && npx jest --watchAll=false
```

Expected: 46 passed, 46 total.

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): add AsyncStorage + configure jest mock"
```

---

## Task 2: `mobile/lib/stars.ts` — AsyncStorage Helpers

**Files:**
- Create: `mobile/lib/stars.ts`
- Create: `mobile/__tests__/lib/stars.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/stars.test.ts`:

```typescript
// The AsyncStorage mock is configured via setupFiles in package.json.
// It provides in-memory storage that resets between test runs.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadStarredIds, saveStarredIds } from '../../lib/stars';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('loadStarredIds', () => {
  it('returns an empty Set when nothing is stored', async () => {
    const result = await loadStarredIds();
    expect(result.size).toBe(0);
  });

  it('returns stored IDs as a Set', async () => {
    await AsyncStorage.setItem('dertown:starred_ids', JSON.stringify(['a', 'b', 'c']));
    const result = await loadStarredIds();
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.has('c')).toBe(true);
    expect(result.size).toBe(3);
  });

  it('returns empty Set on corrupted data', async () => {
    await AsyncStorage.setItem('dertown:starred_ids', 'not-json');
    const result = await loadStarredIds();
    expect(result.size).toBe(0);
  });
});

describe('saveStarredIds', () => {
  it('persists a Set of IDs to AsyncStorage', async () => {
    const ids = new Set(['x', 'y']);
    await saveStarredIds(ids);
    const raw = await AsyncStorage.getItem('dertown:starred_ids');
    const parsed = JSON.parse(raw!);
    expect(parsed).toContain('x');
    expect(parsed).toContain('y');
    expect(parsed).toHaveLength(2);
  });

  it('persists an empty Set', async () => {
    await saveStarredIds(new Set());
    const raw = await AsyncStorage.getItem('dertown:starred_ids');
    expect(JSON.parse(raw!)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd mobile && npx jest __tests__/lib/stars.test.ts --watchAll=false
```

Expected: FAIL — `loadStarredIds` not found.

- [ ] **Step 3: Create `mobile/lib/stars.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'dertown:starred_ids';

/** Load starred event IDs from AsyncStorage. Returns empty Set on missing/corrupted data. */
export async function loadStarredIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/** Persist the current set of starred event IDs to AsyncStorage. */
export async function saveStarredIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // Best-effort persistence — silently discard errors
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile && npx jest __tests__/lib/stars.test.ts --watchAll=false
```

Expected: `Tests: 5 passed, 5 total`.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/stars.ts mobile/__tests__/lib/stars.test.ts
git commit -m "feat(mobile): add AsyncStorage helpers for starred event IDs"
```

---

## Task 3: `mobile/contexts/StarContext.tsx` — Global Star State

**Files:**
- Create: `mobile/contexts/StarContext.tsx`
- Create: `mobile/__tests__/contexts/StarContext.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/contexts/StarContext.test.tsx`:

```typescript
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StarProvider, useStars } from '../../contexts/StarContext';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

// Test consumer component
function TestConsumer({ id }: { id: string }) {
  const { starredIds, toggleStar } = useStars();
  return (
    <>
      <Text testID="count">{starredIds.size}</Text>
      <Text testID="starred">{starredIds.has(id) ? 'yes' : 'no'}</Text>
      <TouchableOpacity testID="toggle" onPress={() => toggleStar(id)}>
        <Text>Toggle</Text>
      </TouchableOpacity>
    </>
  );
}

describe('StarProvider', () => {
  it('starts with empty starred set', async () => {
    const { getByTestId } = render(
      <StarProvider>
        <TestConsumer id="event-1" />
      </StarProvider>
    );
    await waitFor(() => expect(getByTestId('count').props.children).toBe(0));
    expect(getByTestId('starred').props.children).toBe('no');
  });

  it('toggleStar adds an id', async () => {
    const { getByTestId } = render(
      <StarProvider>
        <TestConsumer id="event-1" />
      </StarProvider>
    );
    await waitFor(() => expect(getByTestId('count').props.children).toBe(0));

    fireEvent.press(getByTestId('toggle'));

    await waitFor(() => expect(getByTestId('starred').props.children).toBe('yes'));
    expect(getByTestId('count').props.children).toBe(1);
  });

  it('toggleStar removes an id if already starred', async () => {
    const { getByTestId } = render(
      <StarProvider>
        <TestConsumer id="event-1" />
      </StarProvider>
    );
    await waitFor(() => expect(getByTestId('count').props.children).toBe(0));

    fireEvent.press(getByTestId('toggle')); // add
    await waitFor(() => expect(getByTestId('starred').props.children).toBe('yes'));

    fireEvent.press(getByTestId('toggle')); // remove
    await waitFor(() => expect(getByTestId('starred').props.children).toBe('no'));
  });

  it('hydrates from AsyncStorage on mount', async () => {
    await AsyncStorage.setItem('dertown:starred_ids', JSON.stringify(['event-1']));

    const { getByTestId } = render(
      <StarProvider>
        <TestConsumer id="event-1" />
      </StarProvider>
    );

    await waitFor(() => expect(getByTestId('starred').props.children).toBe('yes'));
  });

  it('persists toggle to AsyncStorage', async () => {
    const { getByTestId } = render(
      <StarProvider>
        <TestConsumer id="event-42" />
      </StarProvider>
    );
    await waitFor(() => expect(getByTestId('count').props.children).toBe(0));

    fireEvent.press(getByTestId('toggle'));
    await waitFor(() => expect(getByTestId('starred').props.children).toBe('yes'));

    const raw = await AsyncStorage.getItem('dertown:starred_ids');
    expect(JSON.parse(raw!)).toContain('event-42');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd mobile && npx jest __tests__/contexts/StarContext.test.tsx --watchAll=false
```

Expected: FAIL — cannot find `../../contexts/StarContext`.

- [ ] **Step 3: Create `mobile/contexts/StarContext.tsx`**

First create the directory:
```bash
mkdir -p mobile/contexts
```

Then create the file:

```typescript
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile && npx jest __tests__/contexts/StarContext.test.tsx --watchAll=false
```

Expected: `Tests: 5 passed, 5 total`.

- [ ] **Step 5: Run full suite**

```bash
cd mobile && npx jest --watchAll=false
```

Expected: 56 passed (46 + 5 stars + 5 context).

- [ ] **Step 6: Commit**

```bash
git add mobile/contexts/StarContext.tsx mobile/__tests__/contexts/StarContext.test.tsx
git commit -m "feat(mobile): add StarContext with AsyncStorage persistence"
```

---

## Task 4: Wire StarProvider + Update Index + Event Detail

**Files:**
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`
- Modify: `mobile/app/event/[id].tsx`

No new tests for this task — existing tests cover the context, and the screens use mocks in their tests. Run the full suite to confirm no regressions.

- [ ] **Step 1: Update `mobile/app/_layout.tsx` to wrap with StarProvider**

Current content:
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

Replace with:
```typescript
import { Stack } from 'expo-router';
import { THEME } from '../lib/theme';
import { StarProvider } from '../contexts/StarContext';

export default function RootLayout() {
  return (
    <StarProvider>
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
    </StarProvider>
  );
}
```

- [ ] **Step 2: Update `mobile/app/(tabs)/index.tsx`**

Make these three changes:

**Add `useStars` import** — add to the imports section (alongside other local imports):
```typescript
import { useStars } from '../../contexts/StarContext';
```

**Replace local star state** — remove this line inside `EventsScreen()`:
```typescript
const [starredIds, setStarredIds]             = useState<Set<string>>(new Set());
```

Replace with:
```typescript
const { starredIds, toggleStar } = useStars();
```

**Remove the local `toggleStar` function** — delete this entire function:
```typescript
function toggleStar(id: string) {
  setStarredIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
}
```

The `toggleStar` from `useStars()` replaces it with the same signature.

- [ ] **Step 3: Update `mobile/app/event/[id].tsx`**

**Add `useStars` import** — add to local imports:
```typescript
import { useStars } from '../../contexts/StarContext';
```

**Replace local star state** — inside `EventDetailScreen()`, remove:
```typescript
const [isStarred, setIsStarred] = useState(false);
```

Replace with:
```typescript
const { starredIds, toggleStar } = useStars();
const isStarred = starredIds.has(id ?? '');
```

**Update the star button** — in the `Stack.Screen` `headerRight`, replace:
```typescript
onPress={() => setIsStarred((v) => !v)}
```

With:
```typescript
onPress={() => toggleStar(id ?? '')}
```

**Add Share button to header** — update the `Stack.Screen` options to add a share button alongside the star:

Replace the existing `headerRight`:
```typescript
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
```

With:
```typescript
headerRight: () => (
  <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
    <TouchableOpacity
      onPress={() => {
        if (!event) return;
        Share.share({
          title: event.title,
          message: `${event.title} — https://dertown.com/events/${event.id}`,
          url: `https://dertown.com/events/${event.id}`,
        });
      }}
      style={{ padding: 6 }}
    >
      <Icon name="share" size={20} color={THEME.textPrimary} />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => toggleStar(id ?? '')}
      style={{ padding: 6, paddingRight: 0 }}
    >
      <Icon
        name="star"
        size={22}
        color={isStarred ? THEME.starFilled : THEME.starUnstarred}
      />
    </TouchableOpacity>
  </View>
),
```

**Add `Share` and `View` to the React Native imports** at the top of `app/event/[id].tsx`:

The current import is:
```typescript
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
```

Add `Share`:
```typescript
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  Share,
} from 'react-native';
```

- [ ] **Step 4: Run full test suite**

```bash
cd mobile && npx jest --watchAll=false
```

Expected: 56 passed. Note: the `EventDetail.test.tsx` currently mocks `expo-router` and may need updating since `useStars` is now called in the component. If tests fail because `useStars` returns undefined (context not provided), add `StarProvider` to the test wrapper:

If EventDetail tests fail, update `mobile/__tests__/app/EventDetail.test.tsx` to add:
```typescript
// Add this mock before the import:
jest.mock('../../contexts/StarContext', () => ({
  useStars: () => ({
    starredIds: new Set<string>(),
    toggleStar: jest.fn(),
  }),
}));
```

Add the mock and rerun:
```bash
cd mobile && npx jest __tests__/app/EventDetail.test.tsx --watchAll=false
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/_layout.tsx "mobile/app/(tabs)/index.tsx" mobile/app/event/\[id\].tsx mobile/__tests__/app/EventDetail.test.tsx
git commit -m "feat(mobile): wire StarContext into layout, feed, and event detail; add Share button"
```

---

## Task 5: Build the Starred Tab Screen

**Files:**
- Modify: `mobile/app/(tabs)/starred.tsx`

No new unit tests — the starred tab reuses `EventRow`, `DayHeader`, `fetchEvents`, and `useStars`, all of which are already tested. Run the full suite to confirm no regressions.

- [ ] **Step 1: Replace `mobile/app/(tabs)/starred.tsx`**

Overwrite the placeholder with the full Starred Tab screen:

```typescript
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ListRenderItem,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { THEME } from '../../lib/theme';
import { fetchEvents } from '../../lib/api';
import { filterUpcoming, groupEventsByDate } from '../../lib/dateUtils';
import { EventRow } from '../../components/EventRow';
import { DayHeader } from '../../components/DayHeader';
import { useStars } from '../../contexts/StarContext';
import type { MobileEvent } from '../../lib/types';

type ListItem =
  | { type: 'header'; date: string }
  | { type: 'event'; event: MobileEvent };

export default function StarredScreen() {
  const { starredIds, toggleStar } = useStars();
  const [events, setEvents]   = useState<MobileEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

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

  const starredEvents = useMemo(
    () => events.filter((e) => starredIds.has(e.id)),
    [events, starredIds]
  );

  const listItems: ListItem[] = useMemo(() => {
    const groups = groupEventsByDate(starredEvents);
    const items: ListItem[] = [];
    for (const group of groups) {
      items.push({ type: 'header', date: group.date });
      for (const event of group.events) {
        items.push({ type: 'event', event });
      }
    }
    return items;
  }, [starredEvents]);

  const renderItem: ListRenderItem<ListItem> = ({ item }) => {
    if (item.type === 'header') return <DayHeader dateStr={item.date} />;
    return (
      <EventRow
        event={item.event}
        isStarred={true}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.event.id } })}
        onStar={() => toggleStar(item.event.id)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Starred</Text>
      </View>

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

      {!loading && !error && listItems.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No starred events</Text>
          <Text style={styles.emptySubtitle}>
            Tap ★ on any event to save it here
          </Text>
        </View>
      )}

      {!loading && !error && listItems.length > 0 && (
        <FlatList
          data={listItems}
          keyExtractor={(item) =>
            item.type === 'header' ? `hdr-${item.date}` : `ev-${item.event.id}`
          }
          renderItem={renderItem}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: THEME.feedBackground,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: THEME.tabBarBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: THEME.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  list: {
    flex: 1,
  },
});
```

- [ ] **Step 2: Run full test suite**

```bash
cd mobile && npx jest --watchAll=false
```

Expected: 56 passed (no new tests — starred screen reuses tested components).

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(tabs)/starred.tsx"
git commit -m "feat(mobile): build real Starred Tab screen with grouped event list"
```

---

## Task 6: Smoke Test

Manual verification that star state persists across screen transitions and app restarts.

- [ ] **Step 1: Start Astro dev server**

```bash
npm run dev
```

- [ ] **Step 2: Start Expo dev server**

```bash
cd mobile && npx expo start
```

- [ ] **Step 3: Open in Expo Go and verify**

Confirm:
- [ ] Tap ★ on an event in the feed → star fills (canary yellow)
- [ ] Switch to the Starred tab → the event appears
- [ ] Tap the event in Starred tab → opens Event Detail
- [ ] Star icon in Event Detail header matches feed (both filled)
- [ ] Untap ★ in Event Detail → event disappears from Starred tab
- [ ] Force-close and reopen app → starred events still appear on Starred tab
- [ ] Share button (⬆) in Event Detail header opens native share sheet with event URL
- [ ] Empty state shows "Tap ★ on any event to save it here" when no events are starred
