// Sentry's Metro config injects debug IDs into every bundle so uploaded
// source maps match, for both EAS builds and EAS Update bundles.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const projectRoot = __dirname;
// Repo root is two levels up from mobile/
const repoRoot = path.resolve(projectRoot, '../..');

const config = getSentryExpoConfig(projectRoot);

// Allow Metro to watch and bundle shared files from src/ (e.g. src/lib/config.ts)
// so that relative imports like ../../src/lib/config resolve correctly at runtime.
config.watchFolders = [repoRoot];

module.exports = config;
