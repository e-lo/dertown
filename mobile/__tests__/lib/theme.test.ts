import { fixHex, getCategoryColor, getCategoryTextColor, THEME, CATEGORY_COLORS } from '../../lib/theme';

describe('fixHex', () => {
  it('strips trailing ff alpha from 9-char hex', () => {
    expect(fixHex('#4740cbff')).toBe('#4740cb');
  });

  it('returns 7-char hex unchanged', () => {
    expect(fixHex('#4740cb')).toBe('#4740cb');
  });

  it('handles canary color', () => {
    expect(fixHex('#ffe600ff')).toBe('#ffe600');
  });

  it('handles non-ff alpha — leaves unchanged', () => {
    expect(fixHex('#4740cb80')).toBe('#4740cb80');
  });
});

describe('getCategoryColor', () => {
  it('returns color for known category', () => {
    expect(getCategoryColor('nature')).toBe(CATEGORY_COLORS.nature);
  });

  it('returns fallback for unknown category', () => {
    const color = getCategoryColor('unknown-category');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns fallback for null', () => {
    const color = getCategoryColor(null);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('getCategoryTextColor', () => {
  it('returns white for most categories', () => {
    expect(getCategoryTextColor('nature')).toBe('#ffffff');
    expect(getCategoryTextColor('civic')).toBe('#ffffff');
  });

  it('returns white for null', () => {
    expect(getCategoryTextColor(null)).toBe('#ffffff');
  });
});

describe('THEME', () => {
  it('has no 8-digit hex colors (all values are 7-digit or non-hex)', () => {
    const hexValues = Object.values(THEME).filter(
      (v) => typeof v === 'string' && v.startsWith('#')
    );
    hexValues.forEach((hex) => {
      expect(hex).toMatch(/^#[0-9a-fA-F]{6}$|^rgba?\(/);
    });
  });
});
