import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CategoryPills } from '../../components/CategoryPills';

const CATEGORIES = ['arts-culture', 'nature', 'family'];

describe('CategoryPills', () => {
  it('renders all category names', () => {
    render(
      <CategoryPills
        categories={CATEGORIES}
        selected={null}
        onSelect={jest.fn()}
      />
    );
    expect(screen.getByText('arts-culture')).toBeTruthy();
    expect(screen.getByText('nature')).toBeTruthy();
    expect(screen.getByText('family')).toBeTruthy();
  });

  it('calls onSelect with category name when a pill is pressed', () => {
    const onSelect = jest.fn();
    render(
      <CategoryPills
        categories={CATEGORIES}
        selected={null}
        onSelect={onSelect}
      />
    );
    fireEvent.press(screen.getByText('nature'));
    expect(onSelect).toHaveBeenCalledWith('nature');
  });

  it('calls onSelect(null) when the already-selected pill is pressed (deselect)', () => {
    const onSelect = jest.fn();
    render(
      <CategoryPills
        categories={CATEGORIES}
        selected="nature"
        onSelect={onSelect}
      />
    );
    fireEvent.press(screen.getByText('nature'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders an "All" pill at the start', () => {
    render(
      <CategoryPills
        categories={CATEGORIES}
        selected={null}
        onSelect={jest.fn()}
      />
    );
    expect(screen.getByText('All')).toBeTruthy();
  });
});
