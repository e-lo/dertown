/**
 * WCAG 2.x contrast helpers. Shared by the theme generator and the mobile app,
 * so this file must stay free of imports and `import.meta.env`, and avoid syntax
 * (like array destructuring) that Babel compiles into runtime-helper imports the
 * app's CI can't resolve from outside `mobile/`.
 */

const DARK_TEXT = '#111111';
const LIGHT_TEXT = '#ffffff';

function relativeLuminance(hex: string): number {
  const digits = hex.replace('#', '').slice(0, 6);
  const linear = [0, 2, 4].map((i) => {
    const c = parseInt(digits.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** Contrast ratio between two `#rrggbb` colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The light color or near-black, whichever reads better on `bg`. The light
 * color defaults to white; the website passes the season's off-white instead.
 */
export function readableTextOn(bg: string, light: string = LIGHT_TEXT): string {
  return contrastRatio(bg, light) >= contrastRatio(bg, DARK_TEXT) ? light : DARK_TEXT;
}
