# Mobile App — Plan 4: Announcements Tab + Push Notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real Announcements tab screen that displays published town announcements, and send Expo push notifications to registered devices when an admin approves an announcement.

**Architecture:** A `push_tokens` Supabase table stores Expo push tokens from mobile devices. On app launch, `_layout.tsx` calls `setupPushNotifications()` which requests permission and registers the device token via `POST /api/mobile/register-push-token`. A public `GET /api/announcements` endpoint reads from the existing `public_announcements` view. When an admin approves an announcement via `POST /api/admin/announcements/approve`, the endpoint sends push notifications fire-and-forget to all registered tokens via Expo's push API.

**Tech Stack:** `expo-notifications`, `expo-device` (new mobile deps), Expo Push Service (`https://exp.host/--/api/v2/push/send`), existing `supabaseAdmin`, existing `public_announcements` view.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260527000000_add_push_tokens.sql` | Create | push_tokens table + RLS |
| `src/types/database.ts` | Modify | Add push_tokens table type |
| `src/pages/api/announcements/index.ts` | Create | Public GET /api/announcements |
| `src/pages/api/mobile/register-push-token.ts` | Create | POST /api/mobile/register-push-token |
| `src/pages/api/admin/announcements/approve.ts` | Modify | Send push notifications after approval |
| `mobile/lib/types.ts` | Modify | Add MobileAnnouncement interface |
| `mobile/lib/api.ts` | Modify | Add fetchAnnouncements(), registerPushToken() |
| `mobile/lib/notifications.ts` | Create | setupPushNotifications() helper |
| `mobile/app/_layout.tsx` | Modify | Call setupPushNotifications() on mount |
| `mobile/app/(tabs)/news.tsx` | Modify | Real announcements screen |
| `mobile/__tests__/lib/api.test.ts` | Modify | Tests for fetchAnnouncements, registerPushToken |
| `mobile/__tests__/app/Announcements.test.tsx` | Create | Screen tests |

---

## Task 1: Supabase Migration — push_tokens Table

**Files:**
- Create: `supabase/migrations/20260527000000_add_push_tokens.sql`

No unit tests for DB migrations. Verify file contents look correct.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260527000000_add_push_tokens.sql`:

```sql
-- Create push_tokens table for Expo push notification registration
CREATE TABLE push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token text UNIQUE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz DEFAULT now() NOT NULL,
  last_seen_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS — service role bypasses it automatically
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Allow any client to upsert their token (no auth required)
CREATE POLICY "Anyone can register push token"
  ON push_tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update their push token"
  ON push_tokens FOR UPDATE
  USING (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260527000000_add_push_tokens.sql
git commit -m "chore(db): add push_tokens table for Expo push registration"
```

---

## Task 2: Add push_tokens to Database Types

**Files:**
- Modify: `src/types/database.ts`

`database.ts` is auto-generated but we need TypeScript to know about `push_tokens` for the Astro endpoints. Add the type manually; it will be overwritten next time types are regenerated from Supabase CLI, but it's the safest approach for now.

- [ ] **Step 1: Find the Tables section in `src/types/database.ts`**

Open `src/types/database.ts` and find the `public: { Tables: {` section. It starts around line 50. Find an existing table entry (e.g., `activities:`) to understand the pattern.

- [ ] **Step 2: Add push_tokens table type**

Locate the alphabetical position for `push_tokens` (after `profiles`, before `series` or similar). Add this entry inside `public.Tables`:

```typescript
      push_tokens: {
        Row: {
          id: string;
          token: string;
          platform: string;
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          token: string;
          platform: string;
          created_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          token?: string;
          platform?: string;
          created_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to push_tokens.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(types): add push_tokens table type"
```

---

## Task 3: Public Announcements API Endpoint

**Files:**
- Create: `src/pages/api/announcements/index.ts`

No unit tests for Astro endpoints (none exist in the project). The mobile API test in Task 5 covers the fetch call.

- [ ] **Step 1: Create the endpoint**

Create `src/pages/api/announcements/index.ts`:

```typescript
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase.ts';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const { data: announcements, error } = await supabase
      .from('public_announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
      return jsonError('Failed to fetch announcements');
    }

    return jsonResponse({ announcements: announcements ?? [] });
  } catch (err) {
    console.error('Error fetching announcements:', err);
    return jsonError('Internal server error', 500);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/announcements/index.ts
git commit -m "feat(api): add public GET /api/announcements endpoint"
```

---

## Task 4: Push Token Registration Endpoint + Modify Approve Endpoint

**Files:**
- Create: `src/pages/api/mobile/register-push-token.ts`
- Modify: `src/pages/api/admin/announcements/approve.ts`

- [ ] **Step 1: Create the directory and endpoint**

```bash
mkdir -p src/pages/api/mobile
```

Create `src/pages/api/mobile/register-push-token.ts`:

```typescript
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase.ts';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { token, platform } = body as { token?: string; platform?: string };

    if (!token || typeof token !== 'string') {
      return jsonError('Missing or invalid token', 400);
    }
    if (platform !== 'ios' && platform !== 'android') {
      return jsonError('Invalid platform — must be ios or android', 400);
    }

    const { error } = await supabaseAdmin
      .from('push_tokens')
      .upsert(
        { token, platform, last_seen_at: new Date().toISOString() },
        { onConflict: 'token' }
      );

    if (error) {
      console.error('Error registering push token:', error);
      return jsonError('Failed to register push token');
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('Error registering push token:', err);
    return jsonError('Internal server error', 500);
  }
};
```

- [ ] **Step 2: Modify `src/pages/api/admin/announcements/approve.ts`**

Current file:
```typescript
import { supabaseAdmin } from '@/lib/supabase';
import { withSuperAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withSuperAdminAuth(async ({ request }) => {
  const { announcementId } = await request.json();

  if (!announcementId) {
    return jsonError('Announcement ID is required', 400);
  }

  // Update announcement status to published using admin client
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .update({ status: 'published' })
    .eq('id', announcementId)
    .select()
    .single();

  if (error) {
    console.error('Error approving announcement:', error);
    return jsonError('Failed to approve announcement');
  }

  return jsonResponse({ announcement: data });
});
```

Replace with:
```typescript
import { supabaseAdmin } from '@/lib/supabase';
import { withSuperAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withSuperAdminAuth(async ({ request }) => {
  const { announcementId } = await request.json();

  if (!announcementId) {
    return jsonError('Announcement ID is required', 400);
  }

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .update({ status: 'published' })
    .eq('id', announcementId)
    .select()
    .single();

  if (error) {
    console.error('Error approving announcement:', error);
    return jsonError('Failed to approve announcement');
  }

  // Fire-and-forget: send push notifications to all registered devices
  sendPushNotifications(data).catch((err) =>
    console.error('Push notification send error:', err)
  );

  return jsonResponse({ announcement: data });
});

async function sendPushNotifications(announcement: {
  title: string;
  message: string;
  id: string;
}): Promise<void> {
  const { data: tokens } = await supabaseAdmin
    .from('push_tokens')
    .select('token');

  if (!tokens || tokens.length === 0) return;

  // Expo Push API accepts up to 100 messages per request
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map(({ token }) => ({
      to: token,
      title: announcement.title,
      body: announcement.message.slice(0, 200),
      data: { type: 'announcement', id: announcement.id },
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(batch),
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/mobile/register-push-token.ts src/pages/api/admin/announcements/approve.ts
git commit -m "feat(api): add push token registration; send push on announcement approval"
```

---

## Task 5: Mobile — MobileAnnouncement Type + API Functions

**Files:**
- Modify: `mobile/lib/types.ts`
- Modify: `mobile/lib/api.ts`
- Modify: `mobile/__tests__/lib/api.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to the end of `mobile/__tests__/lib/api.test.ts` (after the existing `fetchEventById` tests):

```typescript
const MOCK_ANNOUNCEMENT = {
  id: 'ann-1',
  title: 'Road Closure on Main St',
  message: 'Main Street will be closed Saturday for the festival.',
  created_at: '2026-05-27T10:00:00Z',
  show_at: null,
  expires_at: null,
};

describe('fetchAnnouncements', () => {
  it('returns announcements array on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ announcements: [MOCK_ANNOUNCEMENT] }),
    });

    const result = await fetchAnnouncements();
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:4321/api/announcements');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ann-1');
  });

  it('returns empty array when announcements key is missing', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await fetchAnnouncements();
    expect(result).toEqual([]);
  });

  it('throws when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchAnnouncements()).rejects.toThrow('Failed to fetch announcements: 500');
  });
});

describe('registerPushToken', () => {
  it('calls /api/mobile/register-push-token with token and platform', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await registerPushToken('ExponentPushToken[xxx]', 'ios');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4321/api/mobile/register-push-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'ExponentPushToken[xxx]', platform: 'ios' }),
      })
    );
  });

  it('throws when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400 });
    await expect(registerPushToken('bad-token', 'android')).rejects.toThrow(
      'Failed to register push token: 400'
    );
  });
});
```

Also update the import at the top of `mobile/__tests__/lib/api.test.ts`:
```typescript
import { fetchEvents, fetchEventById, fetchAnnouncements, registerPushToken } from '../../lib/api';
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/elizabethsall/Documents/GitHub/dertown/.claude/worktrees/mobile-plan-4/mobile
npx jest __tests__/lib/api.test.ts --watchAll=false
```

Expected: FAIL — `fetchAnnouncements` is not exported from `../../lib/api`.

- [ ] **Step 3: Add MobileAnnouncement to `mobile/lib/types.ts`**

Add after the `EventSearchParams` interface at the end of `mobile/lib/types.ts`:

```typescript
/** Shape of an announcement returned by GET /api/announcements */
export interface MobileAnnouncement {
  id: string;
  title: string;
  message: string;
  created_at: string;
  show_at: string | null;
  expires_at: string | null;
}
```

- [ ] **Step 4: Add functions to `mobile/lib/api.ts`**

Add these two functions after `fetchEventById` in `mobile/lib/api.ts`:

```typescript
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
```

Also add `MobileAnnouncement` to the import in `mobile/lib/api.ts`:
```typescript
import type { MobileEvent, MobileAnnouncement, EventSearchParams } from './types';
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd mobile && npx jest __tests__/lib/api.test.ts --watchAll=false
```

Expected: `Tests: 12 passed, 12 total` (7 existing + 5 new).

- [ ] **Step 6: Run full suite**

```bash
cd mobile && npx jest --watchAll=false
```

Expected: 61 passed (56 + 5 new).

- [ ] **Step 7: Commit**

```bash
git add mobile/lib/types.ts mobile/lib/api.ts mobile/__tests__/lib/api.test.ts
git commit -m "feat(mobile): add MobileAnnouncement type, fetchAnnouncements, registerPushToken"
```

---

## Task 6: Mobile — Install expo-notifications + Notifications Helper

**Files:**
- Create: `mobile/lib/notifications.ts`

`expo-notifications` and `expo-device` work only on physical devices — unit testing the main flow is not practical. We skip unit tests here; the smoke test in Task 8 verifies the integration.

- [ ] **Step 1: Install packages**

```bash
cd /Users/elizabethsall/Documents/GitHub/dertown/.claude/worktrees/mobile-plan-4/mobile
npx expo install expo-notifications expo-device --legacy-peer-deps
```

Expected: packages added to `package.json` and `package-lock.json`.

- [ ] **Step 2: Verify existing tests still pass**

```bash
npx jest --watchAll=false
```

Expected: 61 passed.

- [ ] **Step 3: Create `mobile/lib/notifications.ts`**

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken } from './api';

/**
 * Request push notification permissions, get an Expo push token,
 * and register it with the Dertown backend.
 *
 * No-ops on simulators/emulators (requires a physical device).
 * Errors are logged but not re-thrown — push is best-effort.
 */
export async function setupPushNotifications(): Promise<void> {
  // Physical device required for push notifications
  if (!Device.isDevice) return;

  // Android requires an explicit notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Dertown',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  // Get the Expo push token and register it
  const { data: token } = await Notifications.getExpoPushTokenAsync();
  await registerPushToken(token, Platform.OS as 'ios' | 'android');
}
```

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/notifications.ts mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): install expo-notifications; add setupPushNotifications helper"
```

---

## Task 7: Wire Push Registration in `_layout.tsx`

**Files:**
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Update `mobile/app/_layout.tsx`**

Current content:
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

Replace with:
```typescript
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { THEME } from '../lib/theme';
import { StarProvider } from '../contexts/StarContext';
import { setupPushNotifications } from '../lib/notifications';

export default function RootLayout() {
  useEffect(() => {
    setupPushNotifications().catch((err) =>
      console.error('Push notification setup error:', err)
    );
  }, []);

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

- [ ] **Step 2: Run full test suite**

```bash
cd mobile && npx jest --watchAll=false
```

Expected: 61 passed. (No existing tests cover `_layout.tsx` directly; the `useEffect` won't be triggered in tests that mock expo-router.)

- [ ] **Step 3: Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "feat(mobile): register push notification token on app launch"
```

---

## Task 8: Build the Announcements Screen + Tests

**Files:**
- Modify: `mobile/app/(tabs)/news.tsx`
- Create: `mobile/__tests__/app/Announcements.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/app/Announcements.test.tsx`:

```typescript
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AnnouncementsScreen from '../../app/(tabs)/news';
import { fetchAnnouncements } from '../../lib/api';

jest.mock('../../lib/api', () => ({
  fetchAnnouncements: jest.fn(),
}));

// useFocusEffect calls its callback immediately in tests
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => unknown) => { cb(); },
}));

const MOCK_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    title: 'Road Closure on Main St',
    message: 'Main Street will be closed Saturday for the Autumn Leaf Festival.',
    created_at: '2026-05-27T10:00:00Z',
    show_at: null,
    expires_at: null,
  },
  {
    id: 'ann-2',
    title: 'Park Closure',
    message: 'Riverfront Park will be closed for maintenance.',
    created_at: '2026-05-26T08:00:00Z',
    show_at: null,
    expires_at: null,
  },
];

describe('AnnouncementsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows announcements on successful fetch', async () => {
    (fetchAnnouncements as jest.Mock).mockResolvedValue(MOCK_ANNOUNCEMENTS);
    const { getByText } = render(<AnnouncementsScreen />);
    await waitFor(() => expect(getByText('Road Closure on Main St')).toBeTruthy());
    expect(getByText('Main Street will be closed Saturday for the Autumn Leaf Festival.')).toBeTruthy();
    expect(getByText('Park Closure')).toBeTruthy();
  });

  it('shows empty state when no announcements', async () => {
    (fetchAnnouncements as jest.Mock).mockResolvedValue([]);
    const { getByText } = render(<AnnouncementsScreen />);
    await waitFor(() => expect(getByText('No announcements')).toBeTruthy());
    expect(getByText('Check back soon for updates from Leavenworth')).toBeTruthy();
  });

  it('shows error state on fetch failure', async () => {
    (fetchAnnouncements as jest.Mock).mockRejectedValue(new Error('Network error'));
    const { getByText } = render(<AnnouncementsScreen />);
    await waitFor(() => expect(getByText('Network error')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd mobile && npx jest __tests__/app/Announcements.test.tsx --watchAll=false
```

Expected: FAIL — `AnnouncementsScreen` is still the placeholder component.

- [ ] **Step 3: Replace `mobile/app/(tabs)/news.tsx`**

```typescript
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ListRenderItem,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { THEME } from '../../lib/theme';
import { fetchAnnouncements } from '../../lib/api';
import type { MobileAnnouncement } from '../../lib/types';

function AnnouncementCard({ item }: { item: MobileAnnouncement }) {
  const date = new Date(item.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDate}>{date}</Text>
      <Text style={styles.cardMessage}>{item.message}</Text>
    </View>
  );
}

export default function AnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<MobileAnnouncement[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  const loadAnnouncements = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAnnouncements()
      .then((data) => {
        setAnnouncements(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to load announcements');
        setLoading(false);
      });
  }, []);

  useFocusEffect(loadAnnouncements);

  const renderItem: ListRenderItem<MobileAnnouncement> = ({ item }) => (
    <AnnouncementCard item={item} />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Announcements</Text>
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

      {!loading && !error && announcements.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No announcements</Text>
          <Text style={styles.emptySubtitle}>
            Check back soon for updates from Leavenworth
          </Text>
        </View>
      )}

      {!loading && !error && announcements.length > 0 && (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
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
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  cardDate: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  cardMessage: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
  },
});
```

- [ ] **Step 4: Run new tests to confirm they pass**

```bash
cd mobile && npx jest __tests__/app/Announcements.test.tsx --watchAll=false
```

Expected: `Tests: 3 passed, 3 total`.

- [ ] **Step 5: Run full suite**

```bash
cd mobile && npx jest --watchAll=false
```

Expected: 64 passed (61 + 3 new).

- [ ] **Step 6: Commit**

```bash
git add "mobile/app/(tabs)/news.tsx" mobile/__tests__/app/Announcements.test.tsx
git commit -m "feat(mobile): build Announcements screen with loading/error/empty states"
```

---

## Task 9: Smoke Test

Manual verification on a physical device. Simulator/emulator cannot test push notifications.

- [ ] **Step 1: Start Astro dev server**

```bash
npm run dev
```

- [ ] **Step 2: Start Expo dev server**

```bash
cd mobile && npx expo start
```

- [ ] **Step 3: Open in Expo Go on a physical device**

Verify:
- [ ] App launches → push permission dialog appears (first run only)
- [ ] Grant permission → no error in Expo server logs
- [ ] Announcements tab shows loading spinner, then list (or empty state if no published announcements)
- [ ] Each announcement card shows title, date, and message
- [ ] Admin approves an announcement at `/admin/announcements` → push notification arrives on device within a few seconds
- [ ] Notification shows announcement title and first 200 chars of message
- [ ] Tapping notification opens the app (default behavior)
