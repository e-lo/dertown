import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from './app-config';

const pfx = APP_CONFIG.storageKeyPrefix;

// ── Event IDs ────────────────────────────────────────────────────────────────

const EVENT_KEY = `${pfx}:starred_ids`;

/** Load starred event IDs from AsyncStorage. Returns empty Set on missing/corrupted data. */
export async function loadStarredIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(EVENT_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/** Persist the current set of starred event IDs to AsyncStorage. */
export async function saveStarredIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(EVENT_KEY, JSON.stringify([...ids]));
  } catch {
    // Best-effort persistence — silently discard errors
  }
}

// ── Named entities (org, series, location) ───────────────────────────────────

/** A starred entity (org, series, or location) with its display name. */
export interface StarredEntity {
  id: string;
  name: string;
}

async function loadEntities(key: string): Promise<StarredEntity[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as StarredEntity[];
  } catch {
    return [];
  }
}

async function saveEntities(key: string, entities: StarredEntity[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entities));
  } catch {
    // Best-effort
  }
}

// ── Organizations ─────────────────────────────────────────────────────────────

const ORG_KEY = `${pfx}:starred_orgs`;
export const loadStarredOrgs  = () => loadEntities(ORG_KEY);
export const saveStarredOrgs  = (e: StarredEntity[]) => saveEntities(ORG_KEY, e);

// ── Series (parent event IDs) ─────────────────────────────────────────────────

const SERIES_KEY = `${pfx}:starred_series`;
export const loadStarredSeries  = () => loadEntities(SERIES_KEY);
export const saveStarredSeries  = (e: StarredEntity[]) => saveEntities(SERIES_KEY, e);

// ── Locations ─────────────────────────────────────────────────────────────────

const LOCATION_KEY = `${pfx}:starred_locations`;
export const loadStarredLocations  = () => loadEntities(LOCATION_KEY);
export const saveStarredLocations  = (e: StarredEntity[]) => saveEntities(LOCATION_KEY, e);
