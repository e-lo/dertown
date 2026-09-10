-- Drop the dormant recurrence/schedule tables.
--
-- The kid-activity calendar stores concrete ONE_OFF rows in activity_events
-- (see docs/KID_ACTIVITIES_PRD.md). The RRULE model (recurrence_patterns,
-- event_exceptions), calendar_exceptions and activity_schedule were created
-- alongside it but never populated (0 rows in production) and nothing in the
-- site, mobile app or scripts reads them.

-- activity_events: retire the RECURRING branch that pointed at recurrence_patterns.
ALTER TABLE "public"."activity_events" DROP CONSTRAINT IF EXISTS "activity_events_check";
ALTER TABLE "public"."activity_events" DROP CONSTRAINT IF EXISTS "activity_events_event_type_check";
ALTER TABLE "public"."activity_events" DROP COLUMN IF EXISTS "recurrence_pattern_id";
ALTER TABLE "public"."activity_events" DROP COLUMN IF EXISTS "ignore_exceptions";
ALTER TABLE "public"."activity_events"
  ADD CONSTRAINT "activity_events_event_type_check" CHECK ("event_type" = 'ONE_OFF'::"text"),
  ADD CONSTRAINT "activity_events_check" CHECK ("start_datetime" IS NOT NULL AND "end_datetime" IS NOT NULL);

DROP TABLE IF EXISTS "public"."event_exceptions";
DROP TABLE IF EXISTS "public"."recurrence_patterns";
DROP TABLE IF EXISTS "public"."calendar_exceptions";
DROP TABLE IF EXISTS "public"."activity_schedule";
