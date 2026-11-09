/**
 * Pull the events for the next issue from production (read-only).
 *
 *   npm run newsletter:fetch [-- --send-date 2026-10-29] [--dir newsletters]
 *
 * Writes newsletters/<sendDate>.source.json for the skill to draft from.
 */
import {
  issueWindows,
  nextSendDate,
  sendDateKey,
  sendInstantForKey,
} from '../../src/lib/newsletter/dates';
import { selectIssueEvents } from '../../src/lib/newsletter/select-events';
import type { IssueEvent } from '../../src/lib/newsletter/types';
import {
  draftsDir,
  issuePaths,
  main,
  parseArgs,
  requireDateKey,
  writeJson,
  type IssueSource,
  type OccurrenceSnapshot,
} from './cli';
import { fetchAnnouncements, fetchEventsBetween, publicClient } from './supabase';

function summarize(label: string, events: IssueEvent[]): string {
  const lines = events.map(
    (e) =>
      `  ${e.displayDate}  ${e.featured ? '★ ' : ''}${e.title} — ${e.whenLabel}${e.imageUrl ? '' : ' (no image)'}`
  );
  return `${label}: ${events.length}\n${lines.join('\n')}`;
}

main(async () => {
  const args = parseArgs(process.argv.slice(2));
  const requested = args.options.get('send-date');
  const sendAt = requested
    ? sendInstantForKey(requireDateKey(requested))
    : nextSendDate(new Date());
  const sendDate = sendDateKey(sendAt);
  const windows = issueWindows(sendAt);

  const db = publicClient();
  const rows = await fetchEventsBetween(db, windows.thisWeek.start, windows.planAhead.end);
  const occurrences: Record<string, OccurrenceSnapshot> = Object.fromEntries(
    rows.map((r) => [
      r.id,
      { title: r.title, start_date: r.start_date, end_date: r.end_date, start_time: r.start_time },
    ])
  );

  const source: IssueSource = {
    sendDate,
    sendAtIso: sendAt.toISOString(),
    windows,
    thisWeek: selectIssueEvents(rows, windows.thisWeek),
    planAhead: selectIssueEvents(rows, windows.planAhead),
    announcements: await fetchAnnouncements(db),
    occurrences,
  };

  const paths = issuePaths(draftsDir(args), sendDate);
  writeJson(paths.source, source);

  console.log(`Issue for ${sendDate} (sends ${sendAt.toISOString()})`);
  console.log(`This week: ${windows.thisWeek.start} → ${windows.thisWeek.end}`);
  console.log(`Plan ahead: ${windows.planAhead.start} → ${windows.planAhead.end}\n`);
  console.log(summarize('This week', source.thisWeek));
  console.log(`\n${summarize('Plan ahead', source.planAhead)}`);
  console.log(`\nAnnouncements: ${source.announcements.length}`);
  console.log(`\nWrote ${paths.source}`);
});
