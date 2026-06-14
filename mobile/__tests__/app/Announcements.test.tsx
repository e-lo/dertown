import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AnnouncementsScreen from '../../app/(tabs)/news';
import { fetchAnnouncements } from '../../lib/api';

jest.mock('../../lib/api', () => ({
  fetchAnnouncements: jest.fn(),
}));

// The screen reads/writes a module-level cache (lib/cache keeps an in-memory
// Map that would leak state between tests) — stub it to a cold cache.
jest.mock('../../lib/cache', () => ({
  getCache: jest.fn(() => Promise.resolve(null)),
  setCache: jest.fn(() => Promise.resolve()),
  invalidateCache: jest.fn(),
}));

// useFocusEffect calls its callback after render in tests
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => unknown) => {
    setTimeout(cb, 0);
  },
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
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
