const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// Repo root is two levels up from mobile/
const repoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Allow Metro to watch and bundle shared files from src/ (e.g. src/lib/config.ts)
// so that relative imports like ../../src/lib/config resolve correctly at runtime.
config.watchFolders = [repoRoot];

module.exports = config;
