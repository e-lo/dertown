import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EventRow } from '../../components/EventRow';
import type { MobileEvent } from '../../lib/types';

const BASE_EVENT: MobileEvent = {
  id: '1',
  title: 'Hiking in the Mountains',
  start_date: '2026-05-26',
  end_date: null,
  start_time: '09:00:00',
  end_time: '12:00:00',
  description: null,
  website: null,
  registration: null,
  cost: null,
  featured: null,
  external_image_url: null,
  parent_event_id: null,
  location_id: null,
  organization_id: null,
  primary_tag: { name: 'nature' },
  secondary_tag: null,
  location: { id: 'loc1', name: 'Icicle Creek', address: null },
  organization: { name: 'Leavenworth Outdoor Club' },
};

describe('EventRow', () => {
  it('renders event title', () => {
    render(
      <EventRow event={BASE_EVENT} isStarred={false} onPress={jest.fn()} onStar={jest.fn()} />
    );
    expect(screen.getByText('Hiking in the Mountains')).toBeTruthy();
  });

  it('renders formatted time range', () => {
    render(
      <EventRow event={BASE_EVENT} isStarred={false} onPress={jest.fn()} onStar={jest.fn()} />
    );
    expect(screen.getByText('9:00 AM – 12:00 PM')).toBeTruthy();
  });

  it('renders location name', () => {
    render(
      <EventRow event={BASE_EVENT} isStarred={false} onPress={jest.fn()} onStar={jest.fn()} />
    );
    expect(screen.getByText('Icicle Creek')).toBeTruthy();
  });

  it('renders the day number on the left', () => {
    render(
      <EventRow event={BASE_EVENT} isStarred={false} onPress={jest.fn()} onStar={jest.fn()} />
    );
    expect(screen.getByText('26')).toBeTruthy();
  });

  it('calls onPress when the row is pressed', () => {
    const onPress = jest.fn();
    render(
      <EventRow event={BASE_EVENT} isStarred={false} onPress={onPress} onStar={jest.fn()} />
    );
    fireEvent.press(screen.getByText('Hiking in the Mountains'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onStar when star button is pressed', () => {
    const onStar = jest.fn();
    render(
      <EventRow event={BASE_EVENT} isStarred={false} onPress={jest.fn()} onStar={onStar} />
    );
    fireEvent.press(screen.getByTestId('star-button'));
    expect(onStar).toHaveBeenCalledTimes(1);
  });

  it('renders registration badge when registration is true', () => {
    const regEvent = { ...BASE_EVENT, registration: true };
    render(
      <EventRow event={regEvent} isStarred={false} onPress={jest.fn()} onStar={jest.fn()} />
    );
    expect(screen.getByText('Register')).toBeTruthy();
  });
});
