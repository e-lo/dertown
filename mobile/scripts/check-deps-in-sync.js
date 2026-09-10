#!/usr/bin/env node
// Fails fast when node_modules no longer matches package-lock.json.
//
// Why: after a dependency bump is reverted in git (e.g. dependabot #22 pushed
// react-native to 0.86, restored to 0.81.5 for Expo SDK 54), a stale
// node_modules keeps the old versions and Jest dies with the misleading
// "React Native Jest preset has moved to a separate package". The fix is
// `npm ci`, not a jest config change — this check says so directly.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const rootEntry = lock.packages[''];
const directDeps = Object.keys({ ...rootEntry.dependencies, ...rootEntry.devDependencies });

const problems = [];
for (const name of directDeps) {
  const expected = lock.packages[`node_modules/${name}`]?.version;
  if (!expected) continue;
  const installedPkg = path.join(root, 'node_modules', name, 'package.json');
  if (!fs.existsSync(installedPkg)) {
    problems.push(`${name}: missing (lockfile has ${expected})`);
    continue;
  }
  const installed = JSON.parse(fs.readFileSync(installedPkg, 'utf8')).version;
  if (installed !== expected) {
    problems.push(`${name}: installed ${installed}, lockfile has ${expected}`);
  }
}

if (problems.length > 0) {
  console.error('node_modules is out of sync with package-lock.json:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nRun `npm ci` in mobile/ to reinstall the locked versions.');
  process.exit(1);
}
