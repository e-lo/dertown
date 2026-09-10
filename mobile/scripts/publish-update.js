#!/usr/bin/env node
// Publish a JavaScript-only update to an EAS Update channel, then upload the
// bundle's source maps to Sentry so stack traces from the update are readable.
//
// Usage: npm run update:production -- "Short description of the change"
//        npm run update:preview -- "..."
const { spawnSync } = require('child_process');

const CHANNELS = ['production', 'preview'];
const [channel, message] = process.argv.slice(2);

if (!CHANNELS.includes(channel) || !message) {
  console.error(`Usage: node scripts/publish-update.js <${CHANNELS.join('|')}> "<message>"`);
  process.exit(1);
}
if (!process.env.SENTRY_AUTH_TOKEN) {
  console.error('SENTRY_AUTH_TOKEN is not set. It is needed to upload source maps to Sentry.');
  console.error('Create one at sentry.io > Organization Settings > Auth Tokens, then `export SENTRY_AUTH_TOKEN=...`.');
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// --environment pulls the EAS env vars for that environment (API base URL,
// Mapbox token, Sentry DSN) so the bundle matches what a build would contain.
run('npx', ['eas', 'update', '--channel', channel, '--environment', channel, '--message', message]);
// eas update exports the bundle to dist/ by default.
run('npx', ['sentry-expo-upload-sourcemaps', 'dist']);
