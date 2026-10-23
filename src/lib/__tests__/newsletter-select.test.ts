import { selectIssueEvents } from '../newsletter/select-events';
import type { IssueEvent, NewsletterSourceEvent } from '../newsletter/types';

function check(name: string, actual: unknown, expected: unknown): boolean {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    pass
      ? `✅ PASS: ${name}\n`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}\n`
  );
  return pass;
}

const W = { start: '2026-10-30', end: '2026-11-05' };

function row(
  partial: Partial<NewsletterSourceEvent> & { id: string; start_date: string }
): NewsletterSourceEvent {
  return {
    title: `Event ${partial.id}`,
    description: null,
    end_date: null,
    start_time: '10:00:00',
    end_time: null,
    parent_event_id: null,
    featured: false,
    external_image_url: null,
    image_alt_text: null,
    primary_tag_name: null,
    cost: null,
    location_name: null,
    ...partial,
  };
}

const ids = (events: IssueEvent[]) => events.map((e) => e.id);

function runTests(): boolean {
  console.log('🧪 Testing newsletter event selection\n');
  let allTestsPassed = true;

  allTestsPassed =
    check(
      'event after the window is dropped',
      ids(selectIssueEvents([row({ id: 'a', start_date: '2026-11-06' })], W)),
      []
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'event before the window is dropped',
      ids(selectIssueEvents([row({ id: 'a', start_date: '2026-10-29' })], W)),
      []
    ) && allTestsPassed;

  const festival = selectIssueEvents(
    [row({ id: 'f', start_date: '2026-10-29', end_date: '2026-11-01' })],
    W
  )[0];
  allTestsPassed =
    check(
      'multi-day event that started before the window is listed on the first day',
      { displayDate: festival?.displayDate, whenLabel: festival?.whenLabel },
      { displayDate: '2026-10-30', whenLabel: 'Thu–Sun, Oct 29–Nov 1' }
    ) && allTestsPassed;

  const series = selectIssueEvents(
    [
      row({ id: 'p', start_date: '2026-11-03', start_time: '18:00:00' }),
      row({ id: 'c1', parent_event_id: 'p', start_date: '2026-11-05', start_time: '18:00:00' }),
    ],
    W
  );
  allTestsPassed =
    check(
      'series collapses into one entry',
      series.map((e) => ({
        id: e.id,
        displayDate: e.displayDate,
        whenLabel: e.whenLabel,
        occurrenceIds: e.occurrenceIds,
      })),
      [
        {
          id: 'p',
          displayDate: '2026-11-03',
          whenLabel: 'Tuesdays & Thursdays · 6pm',
          occurrenceIds: ['p', 'c1'],
        },
      ]
    ) && allTestsPassed;

  const orphanChildren = selectIssueEvents(
    [
      row({ id: 'c2', parent_event_id: 'gone', start_date: '2026-10-31', start_time: '09:00:00' }),
      row({ id: 'c3', parent_event_id: 'gone', start_date: '2026-11-01', start_time: '11:00:00' }),
      row({ id: 'c4', parent_event_id: 'gone', start_date: '2026-11-02', start_time: '09:00:00' }),
    ],
    W
  );
  allTestsPassed =
    check(
      'children of a parent outside the window group under the parent id; mixed times omit the time',
      orphanChildren.map((e) => ({ id: e.id, whenLabel: e.whenLabel })),
      [{ id: 'gone', whenLabel: 'Saturdays, Sundays & Mondays' }]
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'no start time shows All day',
      selectIssueEvents([row({ id: 'n', start_date: '2026-10-31', start_time: null })], W)[0]
        ?.whenLabel,
      'Sat, Oct 31 · All day'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'minutes shown only when non-zero',
      selectIssueEvents([row({ id: 'h', start_date: '2026-10-31', start_time: '19:30:00' })], W)[0]
        ?.whenLabel,
      'Sat, Oct 31 · 7:30pm'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'noon and midnight-hour formatting',
      selectIssueEvents(
        [
          row({ id: 'm', start_date: '2026-10-31', start_time: '12:00:00' }),
          row({ id: 'k', start_date: '2026-11-01', start_time: '00:15:00' }),
        ],
        W
      ).map((e) => e.whenLabel),
      ['Sat, Oct 31 · 12pm', 'Sun, Nov 1 · 12:15am']
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'sorted by date then time',
      ids(
        selectIssueEvents(
          [
            row({ id: 'b', start_date: '2026-11-02' }),
            row({ id: 'late', start_date: '2026-10-31', start_time: '20:00:00' }),
            row({ id: 'early', start_date: '2026-10-31', start_time: '08:00:00' }),
          ],
          W
        )
      ),
      ['early', 'late', 'b']
    ) && allTestsPassed;

  const mapped = selectIssueEvents(
    [
      row({
        id: 'x',
        start_date: '2026-10-31',
        featured: null,
        external_image_url: 'https://img.example/x.jpg',
        image_alt_text: 'alt',
        location_name: 'Front St Park',
        primary_tag_name: 'Arts',
        description: 'desc',
      }),
    ],
    W
  )[0];
  allTestsPassed =
    check(
      'fields are carried through and featured null is false',
      {
        featured: mapped?.featured,
        imageUrl: mapped?.imageUrl,
        imageAlt: mapped?.imageAlt,
        locationName: mapped?.locationName,
        tag: mapped?.tag,
        description: mapped?.description,
        title: mapped?.title,
      },
      {
        featured: false,
        imageUrl: 'https://img.example/x.jpg',
        imageAlt: 'alt',
        locationName: 'Front St Park',
        tag: 'Arts',
        description: 'desc',
        title: 'Event x',
      }
    ) && allTestsPassed;

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
