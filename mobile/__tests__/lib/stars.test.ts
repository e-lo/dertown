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
