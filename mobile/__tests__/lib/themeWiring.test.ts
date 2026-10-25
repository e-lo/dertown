/**
 * The accent color changes with the season (amber, powder blue, blush,
 * balsamroot), so screens must take it and its readable text color from THEME
 * instead of hardcoding the retired canary yellow or the dark text that only
 * suited it. Assert that on the source.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = ['app', 'components', 'contexts'].flatMap((d) => sourceFiles(join(ROOT, d)));

describe('seasonal accent wiring', () => {
  it.each([
    ['the old canary hex', /#ffe600/i],
    ['a canary tint', /rgba\(\s*255\s*,\s*230\s*,\s*0/],
    ['a yellow tint', /rgba\(\s*250\s*,\s*204\s*,\s*21/],
    ['dark text tuned for canary (#111111)', /#111111/],
    ['dark text tuned for canary (#111827)', /#111827/],
    ['the old THEME.canary name', /THEME\.canary/],
  ])('no screen hardcodes %s', (_label, pattern) => {
    const offenders = files.filter((f) => pattern.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.replace(ROOT + '/', ''))).toEqual([]);
  });
});
