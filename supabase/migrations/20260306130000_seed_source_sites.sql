-- Seed the source_sites table with configured scraper sources.
-- Uses ON CONFLICT to be idempotent (safe to re-run).

INSERT INTO "public"."source_sites" ("name", "url")
VALUES
  ('Icicle Creek Center', 'https://icicle.org/find-events/'),
  ('NCW Libraries', 'https://ncwlibraries.libcal.com/calendar/leavenworth'),
  ('Ski Leavenworth', 'https://skileavenworth.com/events'),
  ('Leavenworth.org', 'https://leavenworth.org/calendar/'),
  ('Wenatchee River Institute', 'https://wenatcheeriverinstitute.org/event-calendar.html')
ON CONFLICT DO NOTHING;
