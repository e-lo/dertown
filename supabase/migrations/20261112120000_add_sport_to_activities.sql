-- Adds a free-text `sport` to activities so /families/sports can filter by
-- sport (Skiing, Soccer, Basketball...). `activity_type` stays the coarse
-- category the admin dropdown and AI import understand.
--
-- Also normalizes sports-like activity_type values that were entered outside
-- the admin dropdown ("Winter Sports", "Soccer", "Gymnastics", ...) to
-- 'sports', and fills `sport` for each existing sports program.

ALTER TABLE "public"."activities" ADD COLUMN IF NOT EXISTS "sport" "text";

COMMENT ON COLUMN "public"."activities"."sport" IS
  'Specific sport (e.g. Skiing, Soccer) when activity_type = ''sports''. Children inherit from their parent in public_activities.';

-- Same view as 20260910160000_drop_unused_activity_columns.sql plus `sport`
-- (appended last so CREATE OR REPLACE can add it).
CREATE OR REPLACE VIEW "public"."public_activities" AS
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
    "ka"."waitlist_status",
    COALESCE(NULLIF("ka"."sport", ''::"text"), "parent"."sport") AS "sport"
   FROM ("public"."activities" "ka"
     LEFT JOIN "public"."activities" "parent" ON (("ka"."parent_activity_id" = "parent"."id")))
  WHERE ("ka"."active" = true);

-- Normalize sports-like categories to the admin dropdown's 'sports'.
UPDATE "public"."activities"
   SET "activity_type" = 'sports'
 WHERE lower("activity_type") IN
   ('sports', 'winter sports', 'soccer', 'gymnastics', 'climbing', 'aquatics', 'martial arts');

-- Fill sport on existing programs (no-op where an id doesn't exist, e.g. local seeds).
UPDATE "public"."activities" AS a
   SET "sport" = v.sport
  FROM (VALUES
    ('6f057202-e2b4-41ab-849a-681eb4441174'::uuid, 'Skiing'),          -- Leavenworth Junior Alpine Team
    ('35793a4d-ccab-4318-ab34-2b94767a9f23'::uuid, 'Skiing'),          -- Leavenworth Nordic Team
    ('48e54407-9627-4baa-b907-85b3dde430b4'::uuid, 'Skiing'),          -- Mission Ridge Ski Team
    ('f05d882a-569b-433d-b4ba-07693c3e22bf'::uuid, 'Skiing'),          -- Plain Valley Nordic Team
    ('013ef661-55bd-404e-9a9b-6d584583c39b'::uuid, 'Skiing'),          -- Stevens Pass Alpine Club
    ('fdc04f64-af3b-4952-b04b-1cf079e0e419'::uuid, 'Soccer'),          -- Leavenworth Soccer Club
    ('19fd2447-0223-45b9-9f5e-e19303cdc3c7'::uuid, 'Soccer'),          -- Wenatchee FA
    ('bbc0f6ee-97fe-4420-ae44-6d1ad554f6e0'::uuid, 'Basketball'),      -- Leavenworth Youth Basketball
    ('57327193-5600-4e52-968b-c71ac463a79c'::uuid, 'Baseball'),        -- Cascade Youth Baseball
    ('54bda557-52ac-4d07-9c52-42afd3cfc66b'::uuid, 'Softball'),        -- Greater Wenatchee Girls Softball
    ('5b2572b4-334c-4c5d-a60e-c77f30eb97f3'::uuid, 'Volleyball'),      -- NCW Volleyball Club
    ('3cdce534-f260-4d51-b115-00e87e5b4b30'::uuid, 'Lacrosse'),        -- Wenatchee Valley Lacrosse
    ('3b913f0e-a89d-44c4-a5a8-d585d22f84a3'::uuid, 'Hockey'),          -- Wenatchee Amateur Hockey
    ('556b9dfb-8cca-4326-8faf-687420a82030'::uuid, 'Mountain Biking'), -- Icicle Bicycle Club Mountain Biking
    ('f1deb2ed-109f-41ec-9683-4814387c33e4'::uuid, 'Swimming'),        -- Leavenworth Swim Team
    ('b38f3424-6710-4d8b-a480-142457b32813'::uuid, 'Climbing'),        -- Riverfront Rock Gym Climbing Team
    ('6c185f80-31b7-42b0-9ebf-cdd902342b7d'::uuid, 'Climbing'),        -- Riverfront Rock Gym Youth Club
    ('6c63cc69-1331-43a4-8a0d-c4e95960b9e8'::uuid, 'Gymnastics'),      -- Apple Capital Gymnastics
    ('11682225-a284-47da-9dd2-6247f84ae55d'::uuid, 'Gymnastics'),      -- S.P.O.R.T. Gymnastics
    ('649b3292-b4fb-465e-83f8-c3a59dece2c9'::uuid, 'Martial Arts'),    -- Axiom Jiu-Jitsu
    ('8ce55547-b683-4bc8-932e-755c520c2514'::uuid, 'Martial Arts')     -- Dragon Mountain Martial Arts
  ) AS v(id, sport)
 WHERE a.id = v.id;
