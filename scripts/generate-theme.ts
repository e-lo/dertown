/**
 * Generates src/styles/theme.generated.css from src/lib/config.ts.
 *
 * config.ts is the single source of truth for colors/typography; the CSS itself
 * is built by scripts/theme-css.ts (seasonal palettes, Tailwind tokens and the
 * event category rules).
 *
 * Run: `npm run theme:generate` (also runs automatically via `prebuild`).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildThemeCss } from './theme-css';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/styles/theme.generated.css');

writeFileSync(OUT, buildThemeCss());
console.log(`✓ Wrote ${OUT}`);
