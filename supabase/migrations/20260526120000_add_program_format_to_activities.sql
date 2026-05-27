-- Add program_format to activities to distinguish camps from recurring programs
-- Values: camp | league | lesson | class | session
-- NULL means not yet categorized (will surface on /families/programs as a catch-all)

ALTER TABLE "public"."activities"
  ADD COLUMN IF NOT EXISTS "program_format" TEXT
  CONSTRAINT "activities_program_format_check"
  CHECK ("program_format" IN ('camp', 'league', 'lesson', 'class', 'session'));

COMMENT ON COLUMN "public"."activities"."program_format" IS
  'Distinguishes program type: camp (time-limited, break programs) vs. league/lesson/class/session (recurring school-year programs). NULL = uncategorized.';

-- Rebuild public_activities view to include program_format
-- Must DROP and recreate (not CREATE OR REPLACE) because we're inserting a column
-- in the middle of the existing view definition, which PostgreSQL disallows via
-- CREATE OR REPLACE VIEW (error 42P16).
DROP VIEW IF EXISTS "public"."public_activities";

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
    "ka"."season_start_month",
    "ka"."season_start_year",
    "ka"."season_end_month",
    "ka"."season_end_year",
    "ka"."min_age",
    "ka"."max_age",
    "ka"."min_grade",
    "ka"."max_grade",
    "ka"."cost",
    "ka"."cost_assistance_available",
    "ka"."cost_assistance_details",
    "ka"."start_datetime",
    "ka"."end_datetime",
    "ka"."rrule",
    "ka"."commitment_level",
    "ka"."location_id",
    "ka"."location_details",
    "ka"."required_gear",
    "ka"."gear_assistance_available",
    "ka"."gear_assistance_details",
    "ka"."transportation_provided",
    "ka"."transportation_details",
    "ka"."transportation_assistance_available",
    "ka"."transportation_assistance_details",
    "ka"."additional_requirements",
    "ka"."special_needs_accommodations",
    "ka"."special_needs_details",
    "ka"."max_capacity",
    "ka"."waitlist_available",
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

-- Preserve existing grants
GRANT ALL ON TABLE "public"."public_activities" TO "anon";
GRANT ALL ON TABLE "public"."public_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."public_activities" TO "service_role";
