import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import EventsScreen from '../../app/(tabs)/index';
import type { MobileEvent } from '../../lib/types';

function makeEvent(id: string, title: string): MobileEvent {
  return {
    id,
    title,
    start_date: '2026-12-05',
    end_date: null,
    start_time: '19:00:00',
    end_time: null,
    description: null,
    website: null,
    registration: null,
    cost: null,
    featured: null,
    external_image_url: null,
    parent_event_id: null,
    location_id: null,
    organization_id: null,
    primary_tag: { name: 'arts-culture' },
    secondary_tag: null,
    location: null,
    organization: null,
  };
}

const mockEvents = [makeEvent('1', 'Christmas Concert'), makeEvent('2', 'Ping Pong Tournament')];

jest.mock('../../hooks/useEventList', () => ({
  useEventList: () => ({
    events: mockEvents,
    loading: false,
    refreshing: false,
    error: null,
    refresh: jest.fn(),
    reload: jest.fn(),
  }),
}));

jest.mock('../../contexts/StarContext', () => ({
  useStars: () => ({ starredIds: new Set<string>(), toggleStar: jest.fn() }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

describe('Events search', () => {
  it('filters the list while searching', () => {
    render(<EventsScreen />);
    fireEvent.press(screen.getByLabelText('Search events'));
    fireEvent.changeText(screen.getByPlaceholderText('Search events, locations, orgs…'), 'christmas');

    expect(screen.getByText('Christmas Concert')).toBeTruthy();
    expect(screen.queryByText('Ping Pong Tournament')).toBeNull();
  });

  it('shows every event again after closing search', () => {
    render(<EventsScreen />);
    fireEvent.press(screen.getByLabelText('Search events'));
    fireEvent.changeText(screen.getByPlaceholderText('Search events, locations, orgs…'), 'christmas');
    fireEvent.press(screen.getByLabelText('Close search'));

    expect(screen.getByText('Christmas Concert')).toBeTruthy();
    expect(screen.getByText('Ping Pong Tournament')).toBeTruthy();
  });
});
