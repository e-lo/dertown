-- Drop functions nothing calls.
--
-- get_activity_ancestors and get_effective_location still query the old
-- kid_activities table (long since renamed to activities), so they error if
-- called. The effective-location admin endpoint reimplements that walk in
-- TypeScript. The other four are leftovers from the original schema baseline
-- with no callers in the site, mobile app, or scripts.
--
-- is_admin(uuid) was defined in the baseline but never reached production and
-- has no callers. is_admin() itself is retired in the next migration once the
-- policies that use it move to has_admin_access().
DROP FUNCTION IF EXISTS "public"."get_activity_ancestors"("uuid");
DROP FUNCTION IF EXISTS "public"."get_effective_location"("uuid");
DROP FUNCTION IF EXISTS "public"."get_activity_exceptions"("uuid", "date", "date");
DROP FUNCTION IF EXISTS "public"."clone_event_to_series"("uuid", "date"[], "text"[], boolean);
DROP FUNCTION IF EXISTS "public"."recurring_weekly_events"("text", "date", integer);
DROP FUNCTION IF EXISTS "public"."recurring_monthly_events"("text", "text", integer, integer, integer);
DROP FUNCTION IF EXISTS "public"."is_admin"("uuid");
