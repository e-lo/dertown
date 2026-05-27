import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from './app-config';

const KEY = `${APP_CONFIG.storageKeyPrefix}:starred_ids`;

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
