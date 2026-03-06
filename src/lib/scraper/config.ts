import { readFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import type { SourceConfig, SourcesConfig, VenueTagRule } from './types';

const CONFIG_PATH = resolve(process.cwd(), 'scrape/sources.yaml');

/** Parsed scraper configuration. */
export interface ScraperConfig {
  sources: SourceConfig[];
  tagKeywords: Record<string, string[]>;
  venueTags: VenueTagRule[];
}

/** Load and parse the sources.yaml config file. */
export function loadConfig(): ScraperConfig {
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = yaml.load(raw) as SourcesConfig;
  if (!parsed?.sources || !Array.isArray(parsed.sources)) {
    throw new Error(`Invalid sources.yaml: expected a "sources" array`);
  }
  return {
    sources: parsed.sources,
    tagKeywords: parsed.tag_keywords || {},
    venueTags: parsed.venue_tags || [],
  };
}

/** @deprecated Use loadConfig().sources instead. */
export function loadSourcesConfig(): SourceConfig[] {
  return loadConfig().sources;
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
