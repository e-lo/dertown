import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'test-event-id' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  Stack: {
    Screen: ({ options }: { options: object }) => null,
  },
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
  canOpenURL: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('../../lib/api', () => ({
  fetchEventById: jest.fn(),
  fetchRelatedEvents: jest.fn(() => Promise.resolve({ series: null, related: [] })),
}));

jest.mock('../../contexts/StarContext', () => ({
  useStars: () => ({
    starredIds: new Set<string>(),
    toggleStar: jest.fn(),
  }),
}));

jest.mock('../../contexts/BlockContext', () => ({
  useBlocked: () => ({
    blockedOrgs: [],
    blockedOrgIds: new Set<string>(),
    blockOrg: jest.fn(),
    unblockOrg: jest.fn(),
  }),
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

  it('shows event details after loading', async () => {
    (fetchEventById as jest.Mock).mockResolvedValue(mockEvent);
    const { getByText } = render(<EventDetailScreen />);
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
