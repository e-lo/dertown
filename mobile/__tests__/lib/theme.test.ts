import { SEASON_PALETTES, getSeasonForMonth } from '../../../src/lib/config';
import {
  fixHex,
  getCategoryColor,
  getCategoryTextColor,
  getCategoryTextMuted,
  THEME,
  CATEGORY_COLORS,
} from '../../lib/theme';

describe('fixHex', () => {
  it('strips trailing ff alpha from 9-char hex', () => {
    expect(fixHex('#4740cbff')).toBe('#4740cb');
  });

  it('returns 7-char hex unchanged', () => {
    expect(fixHex('#4740cb')).toBe('#4740cb');
  });

  it('handles non-ff alpha — leaves unchanged', () => {
    expect(fixHex('#4740cb80')).toBe('#4740cb80');
  });
});

describe('getCategoryColor', () => {
  it('returns the season color for a known category', () => {
    expect(getCategoryColor('Nature', 'fall')).toBe('#334963');
  });

  it('groups related categories onto one color', () => {
    expect(getCategoryColor('Give Back', 'holiday')).toBe('#c0ced7');
    expect(getCategoryColor('Seniors', 'holiday')).toBe('#c0ced7');
  });

  it('defaults to the current season', () => {
    expect(getCategoryColor('Nature')).toBe(CATEGORY_COLORS.Nature);
  });

  it('falls back to the season hero for unknown or missing categories', () => {
    expect(getCategoryColor('unknown-category', 'ski')).toBe('#3e5f78');
    expect(getCategoryColor(null, 'ski')).toBe('#3e5f78');
  });
});

describe('getCategoryTextColor', () => {
  it('returns dark text on pale cards', () => {
    expect(getCategoryTextColor('Family', 'holiday')).toBe('#111111');
  });

  it('returns white text on deep cards', () => {
    expect(getCategoryTextColor('Family', 'wildflower')).toBe('#ffffff');
    expect(getCategoryTextColor('Sports', 'fall')).toBe('#ffffff');
  });

  it('returns white for null', () => {
    expect(getCategoryTextColor(null, 'fall')).toBe('#ffffff');
  });

  it('pairs a muted color with the text color', () => {
    expect(getCategoryTextMuted('Family', 'holiday')).toBe('rgba(0,0,0,0.6)');
    expect(getCategoryTextMuted('Family', 'wildflower')).toBe('rgba(255,255,255,0.7)');
  });
});

describe('THEME', () => {
  it('uses the current season hero for the header', () => {
    const season = getSeasonForMonth(new Date().getMonth() + 1);
    expect(THEME.headerBackground).toBe(SEASON_PALETTES[season].colors.hero);
  });

  it('has no 8-digit hex colors (all values are 7-digit or non-hex)', () => {
    const hexValues = Object.values(THEME).filter(
      (v) => typeof v === 'string' && v.startsWith('#')
    );
    hexValues.forEach((hex) => {
      expect(hex).toMatch(/^#[0-9a-fA-F]{6}$|^rgba?\(/);
    });
  });
});
