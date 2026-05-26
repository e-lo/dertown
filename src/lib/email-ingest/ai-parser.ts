import { extractEventsWithAI } from '../scraper/parse-ai';
import type { ScrapedEvent } from '../scraper/types';

export async function parseEventsFromEmail(cleanBody: string): Promise<ScrapedEvent[]> {
  // Wrap in minimal HTML so htmlToCleanText() can process it (returns text unchanged)
  const fakeHtml = `<html><body>${cleanBody}</body></html>`;
  return extractEventsWithAI(fakeHtml, 'email-ingest', 12000, false);
}
