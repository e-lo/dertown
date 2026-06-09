CREATE OR REPLACE FUNCTION "public"."get_effective_registration"("activity_uuid" "uuid") RETURNS TABLE("source_id" "uuid", "source_level" "text", "registration_opens" "date", "registration_closes" "date", "registration_link" "text", "registration_info" "text", "registration_required" boolean)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_activity RECORD;
  current_id UUID := activity_uuid;
  level INT := 0;
BEGIN
  -- Walk UP the ancestor chain (self first, then parents) and return the
  -- registration info from the NEAREST activity that has ANY registration
  -- field set.
  WHILE current_id IS NOT NULL AND level < 10 LOOP
    SELECT * INTO current_activity
    FROM activities
    WHERE id = current_id;

    IF NOT FOUND THEN
      RETURN;
    END IF;

    -- Check if this activity has any registration field set
    IF current_activity.registration_opens IS NOT NULL
       OR current_activity.registration_closes IS NOT NULL
       OR current_activity.registration_link IS NOT NULL
       OR current_activity.registration_info IS NOT NULL
       OR current_activity.registration_required = TRUE THEN
      RETURN QUERY
      SELECT
        current_activity.id AS source_id,
        CASE WHEN level = 0 THEN 'self' ELSE 'ancestor' END AS source_level,
        current_activity.registration_opens AS registration_opens,
        current_activity.registration_closes AS registration_closes,
        current_activity.registration_link AS registration_link,
        current_activity.registration_info AS registration_info,
        current_activity.registration_required AS registration_required;
      RETURN;
    END IF;

    -- Move up to the parent
    current_id := current_activity.parent_activity_id;
    level := level + 1;
  END LOOP;

  -- No registration info found in hierarchy
  RETURN;
END;
$$;


ALTER FUNCTION "public"."get_effective_registration"("activity_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_effective_registration"("activity_uuid" "uuid") IS 'Gets the effective registration info for an activity by cascading up the hierarchy (self -> parent -> grandparent, etc.), returning the nearest activity that has any registration field set.';


GRANT ALL ON FUNCTION "public"."get_effective_registration"("activity_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_effective_registration"("activity_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_effective_registration"("activity_uuid" "uuid") TO "service_role";
