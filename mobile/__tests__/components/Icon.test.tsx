import React from 'react';
import { render } from '@testing-library/react-native';
import { Icon } from '../../components/Icon';

describe('Icon', () => {
  it('renders without crashing for known icon names', () => {
    const iconNames = ['calendar', 'star', 'map', 'bell', 'home', 'search'] as const;
    iconNames.forEach((name) => {
      expect(() => render(<Icon name={name} />)).not.toThrow();
    });
  });

  it('accepts size and color props', () => {
    expect(() => render(<Icon name="star" size={32} color="#ffe600" />)).not.toThrow();
  });
});
