import { extractEventsWithAI } from '../scraper/parse-ai';
import type { ScrapedEvent } from '../scraper/types';

export async function parseEventsFromEmail(cleanBody: string): Promise<ScrapedEvent[]> {
  // HTML-escape to prevent cheerio from misinterpreting characters like < or & as markup
  const escaped = cleanBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const fakeHtml = `<html><body><pre>${escaped}</pre></body></html>`;
  return extractEventsWithAI(fakeHtml, 'email-ingest', 12000, false);
}
