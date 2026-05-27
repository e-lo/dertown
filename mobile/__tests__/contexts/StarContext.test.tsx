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
