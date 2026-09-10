-- Drop activities columns nothing reads or writes.
--
-- The activities table carried 64 columns; these 16 are referenced nowhere in
-- the site, mobile app, scripts or the AI activity extractor, and the admin
-- form never offered them. Their indexes (idx_activities_audience,
-- idx_activities_category, idx_activities_skill_level,
-- idx_kid_activities_season_start/end) go with the columns.
--
-- public_activities selects most of them explicitly, so it is rebuilt first.
-- CREATE OR REPLACE VIEW can't remove columns, hence DROP + CREATE.

DROP VIEW IF EXISTS "public"."public_activities";

ALTER TABLE "public"."activities"
  DROP COLUMN IF EXISTS "rrule",
  DROP COLUMN IF EXISTS "transportation_provided",
  DROP COLUMN IF EXISTS "transportation_details",
  DROP COLUMN IF EXISTS "transportation_assistance_available",
  DROP COLUMN IF EXISTS "transportation_assistance_details",
  DROP COLUMN IF EXISTS "additional_requirements",
  DROP COLUMN IF EXISTS "special_needs_accommodations",
  DROP COLUMN IF EXISTS "special_needs_details",
  DROP COLUMN IF EXISTS "waitlist_available",
  DROP COLUMN IF EXISTS "season_start_month",
  DROP COLUMN IF EXISTS "season_start_year",
  DROP COLUMN IF EXISTS "season_end_month",
  DROP COLUMN IF EXISTS "season_end_year",
  DROP COLUMN IF EXISTS "audience",
  DROP COLUMN IF EXISTS "skill_level",
  DROP COLUMN IF EXISTS "activity_category";

-- Same view as 20260526120000_add_program_format_to_activities.sql minus the
-- dropped columns.
CREATE VIEW "public"."public_activities" AS
 SELECT "ka"."id",
    "ka"."name",
    "ka"."description",
    "ka"."sponsoring_organization_id",
    "ka"."website",
    "ka"."email",
    "ka"."phone",
    "ka"."registration_opens",
    "ka"."registration_closes",
    "ka"."registration_link",
    "ka"."registration_info",
    "ka"."registration_required",
    "ka"."is_fall",
    "ka"."is_winter",
    "ka"."is_spring",
    "ka"."is_summer",
    "ka"."is_ongoing",
    "ka"."min_age",
    "ka"."max_age",
    "ka"."min_grade",
    "ka"."max_grade",
    "ka"."cost",
    "ka"."cost_assistance_available",
    "ka"."cost_assistance_details",
    "ka"."start_datetime",
    "ka"."end_datetime",
    "ka"."commitment_level",
    "ka"."location_id",
    "ka"."location_details",
    "ka"."required_gear",
    "ka"."gear_assistance_available",
    "ka"."gear_assistance_details",
    "ka"."max_capacity",
    COALESCE(NULLIF("ka"."activity_type", ''::"text"), "parent"."activity_type") AS "activity_type",
    "ka"."participation_type",
    "ka"."parent_activity_id",
    "ka"."activity_hierarchy_type",
    "ka"."program_format",
    "ka"."status",
    "ka"."featured",
    "ka"."active",
    "ka"."created_at",
    "ka"."updated_at",
    "ka"."created_by",
    "ka"."notes",
    "ka"."waitlist_status"
   FROM ("public"."activities" "ka"
     LEFT JOIN "public"."activities" "parent" ON (("ka"."parent_activity_id" = "parent"."id")))
  WHERE ("ka"."active" = true);

ALTER VIEW "public"."public_activities" OWNER TO "postgres";

GRANT ALL ON TABLE "public"."public_activities" TO "anon";
GRANT ALL ON TABLE "public"."public_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."public_activities" TO "service_role";
