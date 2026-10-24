/**
 * The app imports a few files from the website (`../src/lib/...`). CI installs
 * packages only inside `mobile/`, so once compiled those files must not need
 * anything from node_modules, such as Babel runtime helpers that syntax like
 * array destructuring pulls in. Otherwise the app's tests can't load them.
 */
import { transformFileSync } from '@babel/core';
import { join } from 'node:path';

const MOBILE = join(__dirname, '..', '..');
const SHARED = ['../src/lib/config.ts', '../src/lib/color-contrast.ts'];

describe('modules shared with the website', () => {
  it.each(SHARED)('%s compiles without node_modules imports', (file) => {
    const filename = join(MOBILE, file);
    const code = transformFileSync(filename, {
      cwd: MOBILE,
      filename,
      caller: { name: 'babel-jest', supportsStaticESM: false },
    })?.code ?? '';
    expect(code.match(/require\("[^".][^"]*"\)/g) ?? []).toEqual([]);
  });
});
