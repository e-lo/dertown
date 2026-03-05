import { readFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import type { SourceConfig, SourcesConfig } from './types';

const CONFIG_PATH = resolve(process.cwd(), 'scrape/sources.yaml');

/** Load and parse the sources.yaml config file. */
export function loadSourcesConfig(): SourceConfig[] {
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = yaml.load(raw) as SourcesConfig;
  if (!parsed?.sources || !Array.isArray(parsed.sources)) {
    throw new Error(`Invalid sources.yaml: expected a "sources" array`);
  }
  return parsed.sources;
}

/** Get a single source config by ID, or throw if not found. */
export function getSourceConfig(sources: SourceConfig[], id: string): SourceConfig {
  const source = sources.find((s) => s.id === id);
  if (!source) {
    const available = sources.map((s) => s.id).join(', ');
    throw new Error(`Source "${id}" not found in sources.yaml. Available: ${available}`);
  }
  return source;
}
