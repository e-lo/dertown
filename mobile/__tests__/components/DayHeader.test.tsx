import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { DayHeader } from '../../components/DayHeader';

describe('DayHeader', () => {
  it('renders the day of week, day number, and month', () => {
    render(<DayHeader dateStr="2026-05-26" />);
    // 2026-05-26 is a Tuesday
    expect(screen.getByText(/tuesday/i)).toBeTruthy();
    expect(screen.getByText('26')).toBeTruthy();
    expect(screen.getByText(/may/i)).toBeTruthy();
  });
});
