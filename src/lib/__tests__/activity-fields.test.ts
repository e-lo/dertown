import { stripScheduleFields, SCHEDULE_ONLY_FIELDS } from '../activity-fields';

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.log(`❌ FAIL: ${label}`);
    failures++;
  }
}

console.log('🧪 Testing activity-fields.stripScheduleFields\n');

// The reported production bug: end_time (a schedule field, not an activities
// column) reaching the activities write → PostgREST 500.
const body = {
  name: 'Apple Buds',
  activity_hierarchy_type: 'CLASS_INSTANCE',
  // valid activities columns that MUST survive:
  waitlist_status: 'FULL',
  session_id: 'abc-123',
  start_datetime: '2026-07-14T09:00:00',
  end_datetime: '2026-07-14T10:00:00',
  cost: '$75',
  // schedule-only fields that MUST be stripped (not activities columns):
  start_time: '09:00',
  end_time: '10:00',
  weekdays: ['MO', 'WE'],
  freq: 'WEEKLY',
  interval: '1',
  event_type: 'RECURRING',
  until: '2026-08-30',
  event_name: 'Practice',
  event_description: 'Weekly practice',
  ignore_exceptions: false,
};

const result = stripScheduleFields(body) as Record<string, unknown>;

check("strips 'end_time' (the reported bug)", !('end_time' in result));
for (const f of SCHEDULE_ONLY_FIELDS) {
  check(`strips schedule-only field '${f}'`, !(f in result));
}

// Valid columns must be preserved — guard against silent data loss.
for (const keep of ['name', 'waitlist_status', 'session_id', 'start_datetime', 'end_datetime', 'cost', 'activity_hierarchy_type']) {
  check(`preserves activities column '${keep}'`, keep in result && result[keep] === (body as any)[keep]);
}

// Must not mutate the input.
check('does not mutate the input object', 'end_time' in body);

console.log(`\n${failures === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures} TEST(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
