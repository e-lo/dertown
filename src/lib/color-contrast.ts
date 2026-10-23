/**
 * WCAG 2.x contrast helpers. Shared by the theme generator and the mobile app,
 * so this file must stay free of imports and `import.meta.env`.
 */

const DARK_TEXT = '#111111';
const LIGHT_TEXT = '#ffffff';

function relativeLuminance(hex: string): number {
  const digits = hex.replace('#', '').slice(0, 6);
  const channels = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two `#rrggbb` colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** White or near-black, whichever reads better on `bg`. */
export function readableTextOn(bg: string): typeof DARK_TEXT | typeof LIGHT_TEXT {
  return contrastRatio(bg, LIGHT_TEXT) >= contrastRatio(bg, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}
