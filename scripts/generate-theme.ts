/**
 * Generates src/styles/theme.generated.css from src/lib/config.ts.
 *
 * config.ts is the single source of truth for colors/typography. This script
 * emits a Tailwind v4 `@theme` block (so the palette/semantic/category colors
 * and fonts become real utilities + CSS variables) plus a `:root` block for
 * the derived values that are only used via var() (notifications, gradients,
 * event text color).
 *
 * Run: `npm run theme:generate` (also runs automatically via `prebuild`).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { COLOR_PALETTE, COLORS, TYPOGRAPHY } from '../src/lib/config';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/styles/theme.generated.css');

/** camelCase / key → kebab-case CSS token name */
const kebab = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();

const paletteVars = Object.entries(COLOR_PALETTE)
  .map(([name, hex]) => `  --color-${kebab(name)}: ${hex};`)
  .join('\n');

// Back-compat aliases: many stylesheets/components reference var(--palette-*).
const paletteAliases = Object.keys(COLOR_PALETTE)
  .map((name) => `  --palette-${kebab(name)}: var(--color-${kebab(name)});`)
  .join('\n');

const SEMANTIC_KEYS = [
  'primary', 'primaryLight', 'primaryDark', 'secondary', 'surface', 'surfaceLight',
  'text', 'textSecondary', 'textDark', 'muted', 'mutedDark', 'border', 'link',
] as const;
const semanticVars = SEMANTIC_KEYS
  .map((k) => `  --color-${kebab(k)}: ${COLORS[k as keyof typeof COLORS] as string};`)
  .join('\n');

const categoryVars = Object.entries(COLORS.eventCategories)
  .map(([slug, hex]) => `  --color-category-${slug}: ${hex};`)
  .join('\n');

const fontVars = Object.entries(TYPOGRAPHY.fontFamilies)
  .map(([name, stack]) => `  --font-${kebab(name)}: ${stack};`)
  .join('\n');

const n = COLORS.notifications;
const notificationVars = [
  `  --color-error-text: ${n.error.text};`,
  `  --color-error-bg: ${n.error.bg};`,
  `  --color-success-text: ${n.success.text};`,
  `  --color-success-bg: ${n.success.bg};`,
  `  --color-warning-text: ${n.warning.text};`,
  `  --color-warning-bg: ${n.warning.bg};`,
  `  --color-info-text: ${n.info.text};`,
  `  --color-info-bg: ${n.info.bg};`,
].join('\n');

const css = `/* AUTO-GENERATED from src/lib/config.ts by scripts/generate-theme.ts.
   Do not edit by hand — run \`npm run theme:generate\` after changing config.ts. */

@theme {
  /* Base palette */
${paletteVars}

  /* Semantic colors */
${semanticVars}

  /* Event category colors */
${categoryVars}

  /* Typography */
${fontVars}
}

:root {
  /* Palette aliases for stylesheets/components that use var(--palette-*) */
${paletteAliases}

  /* Notification / alert colors (used via var(), not as utilities) */
${notificationVars}

  /* Event text color for light category backgrounds */
  --color-event-text-dark: ${COLORS.eventTextColors['arts-culture']};

  /* Gradients derived from the primary color */
  --gradient-blues-light: linear-gradient(90deg, var(--color-primary) 0%, #6366f1 100%);
  --gradient-blues-bold: linear-gradient(90deg, var(--color-primary) 0%, #818cf8 100%);
}
`;

writeFileSync(OUT, css);
console.log(`✓ Wrote ${OUT}`);
