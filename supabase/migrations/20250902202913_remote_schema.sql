SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."announcement_status" AS ENUM (
    'pending',
    'published',
    'archived'
);


ALTER TYPE "public"."announcement_status" OWNER TO "postgres";


CREATE TYPE "public"."event_status" AS ENUM (
    'pending',
    'approved',
    'duplicate',
    'archived'
);


ALTER TYPE "public"."event_status" OWNER TO "postgres";


CREATE TYPE "public"."import_frequency" AS ENUM (
    'hourly',
    'daily',
    'weekly',
    'manual'
);


ALTER TYPE "public"."import_frequency" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clone_event_to_series"("p_source_event_id" "uuid", "p_dates" "date"[], "p_titles" "text"[], "p_insert" boolean DEFAULT false) RETURNS TABLE("title" "text", "start_date" "date", "start_time" time without time zone, "end_time" time without time zone, "external_image_url" "text", "image_alt_text" "text", "website" "text", "cost" "text", "parent_event_id" "uuid", "primary_tag_id" "uuid", "secondary_tag_id" "uuid", "organization_id" "uuid", "location_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_len_dates  INT := array_length(p_dates , 1);
  v_len_titles INT := array_length(p_titles, 1);
BEGIN
  IF v_len_dates IS DISTINCT FROM v_len_titles THEN
    RAISE EXCEPTION
      'p_dates (len=%) and p_titles (len=%) must be the same length',
      v_len_dates, v_len_titles;
  END IF;

  /*──────── temporary result holder ───────*/
  CREATE TEMP TABLE temp_events ON COMMIT DROP AS
    SELECT
      NULL::text        AS title,
      NULL::date        AS start_date,
      NULL::time        AS start_time,
      NULL::time        AS end_time,
      NULL::text        AS external_image_url,
      NULL::text        AS image_alt_text,
      NULL::text        AS website,
      NULL::text        AS cost,
      NULL::uuid        AS parent_event_id,
      NULL::uuid        AS primary_tag_id,
      NULL::uuid        AS secondary_tag_id,
      NULL::uuid        AS organization_id,
      NULL::uuid        AS location_id
    LIMIT 0;

  /*──────── source row & zipped date/title pairs ───────*/
  WITH src AS (
    SELECT *
    FROM events
    WHERE id = p_source_event_id
    LIMIT 1
  ),
  pairs AS (
    -- Zip arrays via ordinality
    SELECT d.new_date, t.new_title
    FROM   unnest(p_dates)  WITH ORDINALITY AS d(new_date, ord)
    JOIN   unnest(p_titles) WITH ORDINALITY AS t(new_title, ord)
    USING  (ord)
  )
  INSERT INTO temp_events (
    title, start_date, start_time, end_time, 
    external_image_url, image_alt_text, website, cost, parent_event_id,
    primary_tag_id, secondary_tag_id, organization_id, location_id
  )
  SELECT
    pairs.new_title,
    pairs.new_date,
    src.start_time,
    src.end_time,
    src.external_image_url,
    src.image_alt_text,
    src.website,
    src.cost,
    src.parent_event_id,
    src.primary_tag_id,
    src.secondary_tag_id,
    src.organization_id,
    src.location_id
  FROM src, pairs;

  /*──────── optional commit ───────*/
  IF p_insert THEN
    INSERT INTO events (
      title, start_date, start_time, end_time, 
      external_image_url, image_alt_text, website, cost, parent_event_id,
      primary_tag_id, secondary_tag_id, organization_id, location_id
    )
    SELECT
      temp_events.title,
      temp_events.start_date,
      temp_events.start_time,
      temp_events.end_time,
      temp_events.external_image_url,
      temp_events.image_alt_text,
      temp_events.website,
      temp_events.cost,
      temp_events.parent_event_id,
      temp_events.primary_tag_id,
      temp_events.secondary_tag_id,
      temp_events.organization_id,
      temp_events.location_id
  FROM temp_events;
  END IF;

  /*──────── return preview or inserted rows ───────*/
  RETURN QUERY
  SELECT * FROM temp_events
  ORDER BY start_date;
END;
$$;


ALTER FUNCTION "public"."clone_event_to_series"("p_source_event_id" "uuid", "p_dates" "date"[], "p_titles" "text"[], "p_insert" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_activity_ancestors"("activity_uuid" "uuid") RETURNS TABLE("ancestor_id" "uuid")
    LANGUAGE "sql"
    AS $$
WITH RECURSIVE ancestors AS (
    SELECT id, parent_activity_id, 1 as level
    FROM activities 
    WHERE id = activity_uuid
    
    UNION ALL
    
    SELECT ka.id, ka.parent_activity_id, a.level + 1
    FROM activities ka
    JOIN ancestors a ON ka.id = a.parent_activity_id
    WHERE a.level < 10 -- Prevent infinite loops
)
SELECT id FROM ancestors;
$$;


ALTER FUNCTION "public"."get_activity_ancestors"("activity_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_activity_exceptions"("activity_uuid" "uuid", "query_start_date" "date", "query_end_date" "date") RETURNS TABLE("exception_id" "uuid", "name" "text", "activity_id" "uuid", "start_date" "date", "end_date" "date", "start_time" time without time zone, "end_time" time without time zone, "notes" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.exception_id,
        ce.name,
        ce.activity_id,
        ce.start_date,
        ce.end_date,
        ce.start_time,
        ce.end_time,
        ce.notes
    FROM calendar_exceptions ce
    WHERE ce.activity_id IN (
        SELECT ancestor_id FROM get_activity_ancestors(activity_uuid)
    )
    AND ce.start_date <= query_end_date 
    AND ce.end_date >= query_start_date;
END;
$$;


ALTER FUNCTION "public"."get_activity_exceptions"("activity_uuid" "uuid", "query_start_date" "date", "query_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_effective_location"("activity_uuid" "uuid") RETURNS TABLE("location_id" "uuid", "location_name" "text", "location_address" "text", "location_details" "text", "source_level" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_activity RECORD;
  parent_activity RECORD;
  found_location BOOLEAN := FALSE;
BEGIN
  -- Start with the current activity
  SELECT * INTO current_activity 
  FROM activities 
  WHERE id = activity_uuid;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check if current activity has a location
  IF current_activity.location_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      l.id as location_id,
      l.name as location_name,
      l.address as location_address,
      current_activity.location_details as location_details,
      current_activity.activity_hierarchy_type as source_level
    FROM locations l
    WHERE l.id = current_activity.location_id;
    RETURN;
  END IF;
  
  -- If no location at current level, check parent
  IF current_activity.parent_activity_id IS NOT NULL THEN
    SELECT * INTO parent_activity 
    FROM activities 
    WHERE id = current_activity.parent_activity_id;
    
    IF FOUND AND parent_activity.location_id IS NOT NULL THEN
      RETURN QUERY
      SELECT 
        l.id as location_id,
        l.name as location_name,
        l.address as location_address,
        parent_activity.location_details as location_details,
        parent_activity.activity_hierarchy_type as source_level
      FROM locations l
      WHERE l.id = parent_activity.location_id;
      RETURN;
    END IF;
    
    -- If parent doesn't have location, check grandparent (recursive)
    IF parent_activity.parent_activity_id IS NOT NULL THEN
      RETURN QUERY
      SELECT * FROM get_effective_location(parent_activity.parent_activity_id);
      RETURN;
    END IF;
  END IF;
  
  -- No location found in hierarchy
  RETURN;
END;
$$;


ALTER FUNCTION "public"."get_effective_location"("activity_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_effective_location"("activity_uuid" "uuid") IS 'Gets the effective location for an activity by cascading up the hierarchy (self -> parent -> grandparent, etc.)';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- For now, allow all authenticated users admin access
    -- In production, you would check for specific admin roles
    RETURN auth.role() = 'authenticated';
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_monthly_events"("p_event_title" "text", "p_day_of_week" "text", "p_week_of_month" integer, "p_months_ahead" integer DEFAULT 6, "p_start_month" integer DEFAULT (EXTRACT(month FROM CURRENT_DATE))::integer) RETURNS TABLE("title" "text", "date" "date")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_dow          INT;   -- 0-6  (Sun-Sat)
  v_first_month  DATE;  -- 1 Jan-01 of requested month, this year
BEGIN
  /* ── validation ───────────────────────────────────────────── */
  IF p_week_of_month NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'week_of_month must be 1-4, got %', p_week_of_month;
  END IF;
  IF p_start_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'start_month must be 1-12, got %', p_start_month;
  END IF;
  IF p_months_ahead NOT BETWEEN 1 AND 13 THEN
    RAISE EXCEPTION 'months_ahead must be 1-13, got %', p_months_ahead;
  END IF;

  v_dow := CASE lower(p_day_of_week)
             WHEN 'sunday'    THEN 0 WHEN 'monday'    THEN 1
             WHEN 'tuesday'   THEN 2 WHEN 'wednesday' THEN 3
             WHEN 'thursday'  THEN 4 WHEN 'friday'    THEN 5
             WHEN 'saturday'  THEN 6 ELSE -1
           END;
  IF v_dow = -1 THEN
    RAISE EXCEPTION 'Invalid day_of_week: %', p_day_of_week;
  END IF;

  /* first day of that month in the current year */
  v_first_month :=
      date_trunc('year', CURRENT_DATE)::date
    + make_interval(months => p_start_month - 1);

  /* ── main query ───────────────────────────────────────────── */
  RETURN QUERY
  WITH params AS (
    SELECT p_event_title           AS event_title,
           v_dow                   AS day_of_week,
           p_week_of_month         AS week_of_month,
           v_first_month           AS start_month,
           p_months_ahead          AS months_ahead
  ),
  month_series AS (
    SELECT ((start_month + make_interval(months => g.i))::date) AS month_start
    FROM params, generate_series(0, months_ahead - 1) AS g(i)
  ),
  event_dates AS (
    SELECT (
             month_start
             + ((week_of_month - 1) * 7)
             + ((day_of_week + 7 - extract(dow FROM month_start)::int) % 7)
           )::date AS event_date
    FROM month_series
    CROSS JOIN params
  )
  SELECT
    params.event_title AS title,
    event_dates.event_date AS date
  FROM params, event_dates
  ORDER BY event_date;
END;
$$;


ALTER FUNCTION "public"."recurring_monthly_events"("p_event_title" "text", "p_day_of_week" "text", "p_week_of_month" integer, "p_months_ahead" integer, "p_start_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sponsoring_organization_id" "uuid",
    "website" "text",
    "email" "text",
    "phone" "text",
    "registration_opens" "date",
    "registration_closes" "date",
    "registration_link" "text",
    "registration_required" boolean DEFAULT false,
    "min_age" integer,
    "max_age" integer,
    "min_grade" "text",
    "max_grade" "text",
    "cost" "text",
    "cost_assistance_available" boolean DEFAULT false,
    "cost_assistance_details" "text",
    "start_datetime" timestamp with time zone,
    "end_datetime" timestamp with time zone,
    "rrule" "text",
    "commitment_level" "text",
    "location_id" "uuid",
    "location_details" "text",
    "required_gear" "text",
    "gear_assistance_available" boolean DEFAULT false,
    "gear_assistance_details" "text",
    "transportation_provided" boolean DEFAULT false,
    "transportation_details" "text",
    "transportation_assistance_available" boolean DEFAULT false,
    "transportation_assistance_details" "text",
    "additional_requirements" "text",
    "special_needs_accommodations" boolean DEFAULT false,
    "special_needs_details" "text",
    "max_capacity" integer,
    "waitlist_available" boolean DEFAULT false,
    "activity_type" "text",
    "participation_type" "text",
    "parent_activity_id" "uuid",
    "status" "public"."event_status" DEFAULT 'pending'::"public"."event_status",
    "featured" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "notes" "text",
    "registration_info" "text",
    "is_fall" boolean DEFAULT false,
    "is_winter" boolean DEFAULT false,
    "is_spring" boolean DEFAULT false,
    "is_summer" boolean DEFAULT false,
    "is_ongoing" boolean DEFAULT false,
    "season_start_month" integer,
    "season_start_year" integer,
    "season_end_month" integer,
    "season_end_year" integer,
    "activity_hierarchy_type" "text",
    "waitlist_status" "text",
    "audience" "text" DEFAULT 'all_ages'::"text",
    "skill_level" "text" DEFAULT 'all_levels'::"text",
    "activity_category" "text" DEFAULT 'other'::"text",
    "session_id" "uuid",
    CONSTRAINT "activities_activity_category_check" CHECK (("activity_category" = ANY (ARRAY['sports'::"text", 'arts'::"text", 'education'::"text", 'recreation'::"text", 'community'::"text", 'fitness'::"text", 'outdoor'::"text", 'indoor'::"text", 'other'::"text"]))),
    CONSTRAINT "activities_audience_check" CHECK (("audience" = ANY (ARRAY['kids'::"text", 'adults'::"text", 'all_ages'::"text"]))),
    CONSTRAINT "activities_skill_level_check" CHECK (("skill_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text", 'all_levels'::"text"]))),
    CONSTRAINT "kid_activities_activity_hierarchy_type_check" CHECK (("activity_hierarchy_type" = ANY (ARRAY['PROGRAM'::"text", 'SESSION'::"text", 'CLASS_TYPE'::"text", 'CLASS_INSTANCE'::"text"]))),
    CONSTRAINT "kid_activities_season_end_month_check" CHECK ((("season_end_month" >= 1) AND ("season_end_month" <= 12))),
    CONSTRAINT "kid_activities_season_start_month_check" CHECK ((("season_start_month" >= 1) AND ("season_start_month" <= 12))),
    CONSTRAINT "kid_activities_waitlist_status_check" CHECK ((("waitlist_status" = ANY (ARRAY['null'::"text", 'full'::"text", 'waitlist'::"text"])) OR ("waitlist_status" IS NULL))),
    CONSTRAINT "valid_age_range" CHECK ((("min_age" IS NULL) OR ("max_age" IS NULL) OR ("min_age" <= "max_age"))),
    CONSTRAINT "valid_datetime_range" CHECK ((("start_datetime" IS NULL) OR ("end_datetime" IS NULL) OR ("start_datetime" <= "end_datetime"))),
    CONSTRAINT "valid_season_dates" CHECK (((("season_start_month" IS NULL) AND ("season_start_year" IS NULL) AND ("season_end_month" IS NULL) AND ("season_end_year" IS NULL)) OR (("season_start_month" IS NOT NULL) AND ("season_start_year" IS NOT NULL) AND ("season_end_month" IS NOT NULL) AND ("season_end_year" IS NOT NULL) AND (("season_start_year" < "season_end_year") OR (("season_start_year" = "season_end_year") AND ("season_start_month" <= "season_end_month"))))))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


COMMENT ON TABLE "public"."activities" IS 'Activities table - renamed from kid_activities to support all ages';



COMMENT ON COLUMN "public"."activities"."audience" IS 'Target audience: kids, adults, or all_ages';



COMMENT ON COLUMN "public"."activities"."skill_level" IS 'Required skill level: beginner, intermediate, advanced, or all_levels';



COMMENT ON COLUMN "public"."activities"."activity_category" IS 'Activity category for better organization';



COMMENT ON COLUMN "public"."activities"."session_id" IS 'Optional session association for class instances. Allows class instances to be associated with specific sessions even when their parent is a class type.';



CREATE TABLE IF NOT EXISTS "public"."activity_events" (
    "event_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "activity_id" "uuid",
    "event_type" "text",
    "name" "text" NOT NULL,
    "description" "text",
    "recurrence_pattern_id" "uuid",
    "start_datetime" timestamp with time zone,
    "end_datetime" timestamp with time zone,
    "waitlist_status" "text",
    "ignore_exceptions" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "activity_events_check" CHECK (((("event_type" = 'RECURRING'::"text") AND ("recurrence_pattern_id" IS NOT NULL) AND ("start_datetime" IS NULL) AND ("end_datetime" IS NULL)) OR (("event_type" = 'ONE_OFF'::"text") AND ("recurrence_pattern_id" IS NULL) AND ("start_datetime" IS NOT NULL) AND ("end_datetime" IS NOT NULL)))),
    CONSTRAINT "activity_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['RECURRING'::"text", 'ONE_OFF'::"text"]))),
    CONSTRAINT "activity_events_waitlist_status_check" CHECK (("waitlist_status" = ANY (ARRAY[NULL::"text", 'FULL_WAITLIST_AVAILABLE'::"text", 'FULL'::"text"])))
);


ALTER TABLE "public"."activity_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_schedule" (
    "schedule_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "activity_id" "uuid",
    "name" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "max_capacity" integer,
    "waitlist_available" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "link" "text",
    "email" "text",
    "organization_id" "uuid",
    "author" "text",
    "status" "public"."announcement_status" DEFAULT 'pending'::"public"."announcement_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "show_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "comments" "text",
    CONSTRAINT "announcements_author_length" CHECK (("length"("author") <= 255)),
    CONSTRAINT "announcements_comments_length" CHECK (("length"("comments") <= 2000)),
    CONSTRAINT "announcements_email_format" CHECK ((("email" IS NULL) OR ("email" ~* '^[^@]+@[^@]+\.[^@]+$'::"text"))),
    CONSTRAINT "announcements_expires_after_show" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "show_at"))),
    CONSTRAINT "announcements_message_length" CHECK ((("length"("message") > 0) AND ("length"("message") <= 2000))),
    CONSTRAINT "announcements_title_length" CHECK ((("length"("title") > 0) AND ("length"("title") <= 255)))
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


COMMENT ON COLUMN "public"."announcements"."comments" IS 'Internal admin comments - not published';



CREATE TABLE IF NOT EXISTS "public"."announcements_staged" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "link" "text",
    "email" "text",
    "organization" "text",
    "author" "text",
    "show_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "location_added" "text",
    "organization_added" "text",
    "comments" "text",
    CONSTRAINT "announcements_staged_comments_length" CHECK (("length"("comments") <= 2000))
);


ALTER TABLE "public"."announcements_staged" OWNER TO "postgres";


COMMENT ON COLUMN "public"."announcements_staged"."location_added" IS 'Name of new location to be reviewed by admin';



COMMENT ON COLUMN "public"."announcements_staged"."organization_added" IS 'Name of new organization to be reviewed by admin';



COMMENT ON COLUMN "public"."announcements_staged"."comments" IS 'Internal comments for admin review - not published';



CREATE TABLE IF NOT EXISTS "public"."calendar_exceptions" (
    "exception_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "activity_id" "uuid",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "calendar_exception_activity_id_not_null" CHECK (("activity_id" IS NOT NULL))
);


ALTER TABLE "public"."calendar_exceptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_exceptions" (
    "exception_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid",
    "name" "text" NOT NULL,
    "start_datetime" timestamp with time zone NOT NULL,
    "end_datetime" timestamp with time zone NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_exceptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "location_id" "uuid",
    "organization_id" "uuid",
    "email" "text",
    "website" "text",
    "registration_link" "text",
    "primary_tag_id" "uuid",
    "secondary_tag_id" "uuid",
    "image_id" "uuid",
    "external_image_url" "text",
    "featured" boolean DEFAULT false,
    "parent_event_id" "uuid",
    "exclude_from_calendar" boolean DEFAULT false,
    "registration" boolean DEFAULT false,
    "cost" "text",
    "status" "public"."event_status" DEFAULT 'pending'::"public"."event_status",
    "source_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "details_outdated_checked_at" timestamp with time zone,
    "comments" "text",
    "image_alt_text" "text",
    CONSTRAINT "events_comments_length" CHECK (("length"("comments") <= 2000)),
    CONSTRAINT "events_cost_length" CHECK (("length"("cost") <= 100)),
    CONSTRAINT "events_description_length" CHECK (("length"("description") <= 2000)),
    CONSTRAINT "events_email_format" CHECK ((("email" IS NULL) OR ("email" ~* '^[^@]+@[^@]+\.[^@]+$'::"text"))),
    CONSTRAINT "events_end_date_after_start" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "events_image_alt_text_length" CHECK ((("image_alt_text" IS NULL) OR ("length"("image_alt_text") <= 255))),
    CONSTRAINT "events_time_consistency" CHECK (((("start_time" IS NULL) AND ("end_time" IS NULL)) OR (("start_time" IS NOT NULL) AND ("end_time" IS NULL)) OR (("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL) AND ("end_time" > "start_time")))),
    CONSTRAINT "events_title_length" CHECK ((("length"("title") > 0) AND ("length"("title") <= 255)))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."comments" IS 'Internal admin comments - not published';



COMMENT ON COLUMN "public"."events"."image_alt_text" IS 'Alt text for event image for accessibility (screen readers)';



CREATE TABLE IF NOT EXISTS "public"."events_staged" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "location_id" "uuid",
    "organization_id" "uuid",
    "email" "text",
    "website" "text",
    "registration_link" "text",
    "primary_tag_id" "uuid",
    "secondary_tag_id" "uuid",
    "image_id" "uuid",
    "external_image_url" "text",
    "featured" boolean DEFAULT false,
    "parent_event_id" "uuid",
    "exclude_from_calendar" boolean DEFAULT false,
    "registration" boolean DEFAULT false,
    "cost" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "source_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "details_outdated_checked_at" timestamp with time zone,
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "location_added" "text",
    "organization_added" "text",
    "comments" "text",
    "image_alt_text" "text",
    CONSTRAINT "events_staged_comments_length" CHECK (("length"("comments") <= 2000)),
    CONSTRAINT "events_staged_cost_length" CHECK (("length"("cost") <= 100)),
    CONSTRAINT "events_staged_description_length" CHECK (("length"("description") <= 2000)),
    CONSTRAINT "events_staged_email_format" CHECK ((("email" IS NULL) OR ("email" ~* '^[^@]+@[^@]+\.[^@]+$'::"text"))),
    CONSTRAINT "events_staged_end_date_after_start" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "events_staged_image_alt_text_length" CHECK ((("image_alt_text" IS NULL) OR ("length"("image_alt_text") <= 255))),
    CONSTRAINT "events_staged_start_date_future" CHECK (("start_date" >= CURRENT_DATE)),
    CONSTRAINT "events_staged_time_consistency" CHECK (((("start_time" IS NULL) AND ("end_time" IS NULL)) OR (("start_time" IS NOT NULL) AND ("end_time" IS NULL)) OR (("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL) AND ("end_time" > "start_time")))),
    CONSTRAINT "events_staged_title_length" CHECK ((("length"("title") > 0) AND ("length"("title") <= 255)))
);


ALTER TABLE "public"."events_staged" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events_staged"."location_added" IS 'Name of new location to be reviewed by admin';



COMMENT ON COLUMN "public"."events_staged"."organization_added" IS 'Name of new organization to be reviewed by admin';



COMMENT ON COLUMN "public"."events_staged"."comments" IS 'Internal comments for admin review - not published';



COMMENT ON COLUMN "public"."events_staged"."image_alt_text" IS 'Alt text for event image for accessibility (screen readers)';



CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "website" "text",
    "phone" "text",
    "latitude" double precision,
    "longitude" double precision,
    "parent_location_id" "uuid",
    "status" "public"."event_status" DEFAULT 'pending'::"public"."event_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "locations_address_length" CHECK (("length"("address") <= 500)),
    CONSTRAINT "locations_latitude_range" CHECK ((("latitude" IS NULL) OR (("latitude" >= ('-90'::integer)::double precision) AND ("latitude" <= (90)::double precision)))),
    CONSTRAINT "locations_longitude_range" CHECK ((("longitude" IS NULL) OR (("longitude" >= ('-180'::integer)::double precision) AND ("longitude" <= (180)::double precision)))),
    CONSTRAINT "locations_name_length" CHECK ((("length"("name") > 0) AND ("length"("name") <= 255))),
    CONSTRAINT "locations_phone_length" CHECK (("length"("phone") <= 20))
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "website" "text",
    "phone" "text",
    "email" "text",
    "location_id" "uuid",
    "parent_organization_id" "uuid",
    "status" "public"."event_status" DEFAULT 'pending'::"public"."event_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organizations_description_length" CHECK (("length"("description") <= 2000)),
    CONSTRAINT "organizations_email_format" CHECK ((("email" IS NULL) OR ("email" ~* '^[^@]+@[^@]+\.[^@]+$'::"text"))),
    CONSTRAINT "organizations_name_length" CHECK ((("length"("name") > 0) AND ("length"("name") <= 255))),
    CONSTRAINT "organizations_phone_length" CHECK (("length"("phone") <= 20))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


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


CREATE OR REPLACE VIEW "public"."public_announcements" AS
 SELECT "id",
    "title",
    "message",
    "show_at",
    "expires_at",
    "status",
    "created_at"
   FROM "public"."announcements"
  WHERE (("status" = 'published'::"public"."announcement_status") AND ("show_at" <= "now"()) AND (("expires_at" IS NULL) OR ("expires_at" > "now"())) AND (("show_at" >= ("now"() - '14 days'::interval)) OR (("expires_at" IS NOT NULL) AND ("expires_at" >= ("now"() - '14 days'::interval)))));


ALTER VIEW "public"."public_announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "calendar_id" "text",
    "share_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tags_calendar_id_length" CHECK (("length"("calendar_id") <= 255)),
    CONSTRAINT "tags_name_length" CHECK ((("length"("name") > 0) AND ("length"("name") <= 255))),
    CONSTRAINT "tags_share_id_length" CHECK (("length"("share_id") <= 255))
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_events" AS
 SELECT "e"."id",
    "e"."title",
    "e"."description",
    "e"."start_date",
    "e"."end_date",
    "e"."start_time",
    "e"."end_time",
    "e"."location_id",
    "e"."organization_id",
    "e"."website",
    "e"."registration_link",
    "e"."external_image_url",
    "e"."cost",
    "e"."registration",
    "e"."status",
    "e"."featured",
    "e"."exclude_from_calendar",
    "e"."created_at",
    "e"."updated_at",
    "e"."primary_tag_id",
    "e"."secondary_tag_id",
    "e"."image_alt_text",
    "pt"."name" AS "primary_tag_name",
    "st"."name" AS "secondary_tag_name"
   FROM (("public"."events" "e"
     LEFT JOIN "public"."tags" "pt" ON (("e"."primary_tag_id" = "pt"."id")))
     LEFT JOIN "public"."tags" "st" ON (("e"."secondary_tag_id" = "st"."id")))
  WHERE (("e"."status" = 'approved'::"public"."event_status") AND ("e"."exclude_from_calendar" = false) AND (("e"."start_date" >= (CURRENT_DATE - '14 days'::interval)) OR (("e"."end_date" IS NOT NULL) AND ("e"."end_date" >= (CURRENT_DATE - '14 days'::interval)))));


ALTER VIEW "public"."public_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurrence_patterns" (
    "pattern_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "freq" "text" DEFAULT 'WEEKLY'::"text",
    "interval" integer DEFAULT 1,
    "weekdays" "text"[] NOT NULL,
    "until" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "recurrence_patterns_weekdays_check" CHECK (("array_length"("weekdays", 1) > 0))
);


ALTER TABLE "public"."recurrence_patterns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scrape_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "status" "text" NOT NULL,
    "error_message" "text",
    CONSTRAINT "scrape_logs_error_message_length" CHECK (("length"("error_message") <= 1000)),
    CONSTRAINT "scrape_logs_status_length" CHECK ((("length"("status") > 0) AND ("length"("status") <= 50)))
);


ALTER TABLE "public"."scrape_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."source_sites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "organization_id" "uuid",
    "event_tag_id" "uuid",
    "last_scraped" timestamp with time zone,
    "last_status" "text",
    "last_error" "text",
    "import_frequency" "public"."import_frequency" DEFAULT 'manual'::"public"."import_frequency",
    "extraction_function" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "source_sites_extraction_function_length" CHECK (("length"("extraction_function") <= 255)),
    CONSTRAINT "source_sites_last_error_length" CHECK (("length"("last_error") <= 1000)),
    CONSTRAINT "source_sites_last_status_length" CHECK (("length"("last_status") <= 50)),
    CONSTRAINT "source_sites_name_length" CHECK ((("length"("name") > 0) AND ("length"("name") <= 255))),
    CONSTRAINT "source_sites_url_format" CHECK (("url" ~* '^https?://'::"text"))
);


ALTER TABLE "public"."source_sites" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."activity_schedule"
    ADD CONSTRAINT "activity_schedule_pkey" PRIMARY KEY ("schedule_id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcements_staged"
    ADD CONSTRAINT "announcements_staged_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_exceptions"
    ADD CONSTRAINT "calendar_exception_pkey" PRIMARY KEY ("exception_id");



ALTER TABLE ONLY "public"."event_exceptions"
    ADD CONSTRAINT "event_exceptions_pkey" PRIMARY KEY ("exception_id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events_staged"
    ADD CONSTRAINT "events_staged_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_start_date_title_unique" UNIQUE ("start_date", "title");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "kid_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurrence_patterns"
    ADD CONSTRAINT "recurrence_patterns_pkey" PRIMARY KEY ("pattern_id");



ALTER TABLE ONLY "public"."scrape_logs"
    ADD CONSTRAINT "scrape_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_sites"
    ADD CONSTRAINT "source_sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activities_active" ON "public"."activities" USING "btree" ("active");



CREATE INDEX "idx_activities_activity_type" ON "public"."activities" USING "btree" ("activity_type");



CREATE INDEX "idx_activities_age_range" ON "public"."activities" USING "btree" ("min_age", "max_age");



CREATE INDEX "idx_activities_audience" ON "public"."activities" USING "btree" ("audience");



CREATE INDEX "idx_activities_category" ON "public"."activities" USING "btree" ("activity_category");



CREATE INDEX "idx_activities_end_datetime" ON "public"."activities" USING "btree" ("end_datetime");



CREATE INDEX "idx_activities_featured" ON "public"."activities" USING "btree" ("featured");



CREATE INDEX "idx_activities_location_id" ON "public"."activities" USING "btree" ("location_id");



CREATE INDEX "idx_activities_organization_id" ON "public"."activities" USING "btree" ("sponsoring_organization_id");



CREATE INDEX "idx_activities_parent_id" ON "public"."activities" USING "btree" ("parent_activity_id");



CREATE INDEX "idx_activities_participation_type" ON "public"."activities" USING "btree" ("participation_type");



CREATE INDEX "idx_activities_registration_opens" ON "public"."activities" USING "btree" ("registration_opens");



CREATE INDEX "idx_activities_session_id" ON "public"."activities" USING "btree" ("session_id");



CREATE INDEX "idx_activities_skill_level" ON "public"."activities" USING "btree" ("skill_level");



CREATE INDEX "idx_activities_start_datetime" ON "public"."activities" USING "btree" ("start_datetime");



CREATE INDEX "idx_activities_status" ON "public"."activities" USING "btree" ("status");



CREATE INDEX "idx_activity_events_activity_id" ON "public"."activity_events" USING "btree" ("activity_id");



CREATE INDEX "idx_activity_events_datetime" ON "public"."activity_events" USING "btree" ("start_datetime", "end_datetime");



CREATE INDEX "idx_activity_events_type" ON "public"."activity_events" USING "btree" ("event_type");



CREATE INDEX "idx_activity_schedule_active" ON "public"."activity_schedule" USING "btree" ("active");



CREATE INDEX "idx_activity_schedule_activity_id" ON "public"."activity_schedule" USING "btree" ("activity_id");



CREATE INDEX "idx_announcements_expires_at" ON "public"."announcements" USING "btree" ("expires_at");



CREATE INDEX "idx_announcements_show_at" ON "public"."announcements" USING "btree" ("show_at");



CREATE INDEX "idx_announcements_status" ON "public"."announcements" USING "btree" ("status");



CREATE INDEX "idx_calendar_exception_activity_id" ON "public"."calendar_exceptions" USING "btree" ("activity_id");



CREATE INDEX "idx_calendar_exception_dates" ON "public"."calendar_exceptions" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_calendar_exceptions_activity_id" ON "public"."calendar_exceptions" USING "btree" ("activity_id");



CREATE INDEX "idx_calendar_exceptions_dates" ON "public"."calendar_exceptions" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_event_exceptions_datetime" ON "public"."event_exceptions" USING "btree" ("start_datetime", "end_datetime");



CREATE INDEX "idx_event_exceptions_event_id" ON "public"."event_exceptions" USING "btree" ("event_id");



CREATE INDEX "idx_events_exclude_from_calendar" ON "public"."events" USING "btree" ("exclude_from_calendar");



CREATE INDEX "idx_events_featured" ON "public"."events" USING "btree" ("featured");



CREATE INDEX "idx_events_location_id" ON "public"."events" USING "btree" ("location_id");



CREATE INDEX "idx_events_organization_id" ON "public"."events" USING "btree" ("organization_id");



CREATE INDEX "idx_events_primary_tag_id" ON "public"."events" USING "btree" ("primary_tag_id");



CREATE INDEX "idx_events_start_date" ON "public"."events" USING "btree" ("start_date");



CREATE INDEX "idx_events_status" ON "public"."events" USING "btree" ("status");



CREATE INDEX "idx_events_title" ON "public"."events" USING "btree" ("title");



CREATE INDEX "idx_kid_activities_hierarchy_type" ON "public"."activities" USING "btree" ("activity_hierarchy_type");



CREATE INDEX "idx_kid_activities_is_fall" ON "public"."activities" USING "btree" ("is_fall");



CREATE INDEX "idx_kid_activities_is_ongoing" ON "public"."activities" USING "btree" ("is_ongoing");



CREATE INDEX "idx_kid_activities_is_spring" ON "public"."activities" USING "btree" ("is_spring");



CREATE INDEX "idx_kid_activities_is_summer" ON "public"."activities" USING "btree" ("is_summer");



CREATE INDEX "idx_kid_activities_is_winter" ON "public"."activities" USING "btree" ("is_winter");



CREATE INDEX "idx_kid_activities_season_end" ON "public"."activities" USING "btree" ("season_end_year", "season_end_month");



CREATE INDEX "idx_kid_activities_season_start" ON "public"."activities" USING "btree" ("season_start_year", "season_start_month");



CREATE INDEX "idx_kid_activities_waitlist_status" ON "public"."activities" USING "btree" ("waitlist_status");



CREATE INDEX "idx_locations_name" ON "public"."locations" USING "btree" ("name");



CREATE INDEX "idx_locations_status" ON "public"."locations" USING "btree" ("status");



CREATE INDEX "idx_organizations_name" ON "public"."organizations" USING "btree" ("name");



CREATE INDEX "idx_organizations_status" ON "public"."organizations" USING "btree" ("status");



CREATE INDEX "idx_recurrence_patterns_until" ON "public"."recurrence_patterns" USING "btree" ("until");



CREATE INDEX "idx_source_sites_import_frequency" ON "public"."source_sites" USING "btree" ("import_frequency");



CREATE OR REPLACE TRIGGER "update_activity_events_updated_at" BEFORE UPDATE ON "public"."activity_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_schedule_updated_at" BEFORE UPDATE ON "public"."activity_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_calendar_exception_updated_at" BEFORE UPDATE ON "public"."calendar_exceptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_calendar_exceptions_updated_at" BEFORE UPDATE ON "public"."calendar_exceptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_kid_activities_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_locations_updated_at" BEFORE UPDATE ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_recurrence_patterns_updated_at" BEFORE UPDATE ON "public"."recurrence_patterns" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_source_sites_updated_at" BEFORE UPDATE ON "public"."source_sites" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tags_updated_at" BEFORE UPDATE ON "public"."tags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_parent_activity_id_fkey" FOREIGN KEY ("parent_activity_id") REFERENCES "public"."activities"("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."activities"("id");



ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_recurrence_pattern_id_fkey" FOREIGN KEY ("recurrence_pattern_id") REFERENCES "public"."recurrence_patterns"("pattern_id");



ALTER TABLE ONLY "public"."activity_schedule"
    ADD CONSTRAINT "activity_schedule_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."calendar_exceptions"
    ADD CONSTRAINT "calendar_exception_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_exceptions"
    ADD CONSTRAINT "event_exceptions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."activity_events"("event_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_parent_event_id_fkey" FOREIGN KEY ("parent_event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_primary_tag_id_fkey" FOREIGN KEY ("primary_tag_id") REFERENCES "public"."tags"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_secondary_tag_id_fkey" FOREIGN KEY ("secondary_tag_id") REFERENCES "public"."tags"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."source_sites"("id");



ALTER TABLE ONLY "public"."events_staged"
    ADD CONSTRAINT "events_staged_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."events_staged"
    ADD CONSTRAINT "events_staged_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."events_staged"
    ADD CONSTRAINT "events_staged_parent_event_id_fkey" FOREIGN KEY ("parent_event_id") REFERENCES "public"."events_staged"("id");



ALTER TABLE ONLY "public"."events_staged"
    ADD CONSTRAINT "events_staged_primary_tag_id_fkey" FOREIGN KEY ("primary_tag_id") REFERENCES "public"."tags"("id");



ALTER TABLE ONLY "public"."events_staged"
    ADD CONSTRAINT "events_staged_secondary_tag_id_fkey" FOREIGN KEY ("secondary_tag_id") REFERENCES "public"."tags"("id");



ALTER TABLE ONLY "public"."events_staged"
    ADD CONSTRAINT "events_staged_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."source_sites"("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "kid_activities_sponsoring_organization_id_fkey" FOREIGN KEY ("sponsoring_organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_parent_location_id_fkey" FOREIGN KEY ("parent_location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_parent_organization_id_fkey" FOREIGN KEY ("parent_organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."scrape_logs"
    ADD CONSTRAINT "scrape_logs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."source_sites"("id");



ALTER TABLE ONLY "public"."source_sites"
    ADD CONSTRAINT "source_sites_event_tag_id_fkey" FOREIGN KEY ("event_tag_id") REFERENCES "public"."tags"("id");



ALTER TABLE ONLY "public"."source_sites"
    ADD CONSTRAINT "source_sites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



CREATE POLICY "Admin delete access to announcements_staged" ON "public"."announcements_staged" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin delete access to events_staged" ON "public"."events_staged" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin full access to announcements" ON "public"."announcements" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin full access to announcements_staged" ON "public"."announcements_staged" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin full access to events" ON "public"."events" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin full access to events_staged" ON "public"."events_staged" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin full access to locations" ON "public"."locations" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin full access to organizations" ON "public"."organizations" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin full access to scrape_logs" ON "public"."scrape_logs" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin full access to source_sites" ON "public"."source_sites" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin full access to tags" ON "public"."tags" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin read access to announcements_staged" ON "public"."announcements_staged" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin read access to events_staged" ON "public"."events_staged" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin update access to announcements_staged" ON "public"."announcements_staged" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admin update access to events_staged" ON "public"."events_staged" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admins have full access to activities" ON "public"."activities" USING ("public"."is_admin"());



CREATE POLICY "Admins have full access to calendar exceptions" ON "public"."calendar_exceptions" USING ("public"."is_admin"());



CREATE POLICY "Admins have full access to schedules" ON "public"."activity_schedule" USING ("public"."is_admin"());



CREATE POLICY "Enable delete for authenticated users only" ON "public"."activity_events" FOR DELETE USING (true);



CREATE POLICY "Enable delete for authenticated users only" ON "public"."announcements" FOR DELETE USING ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"()));



CREATE POLICY "Enable delete for authenticated users only" ON "public"."event_exceptions" FOR DELETE USING (true);



CREATE POLICY "Enable delete for authenticated users only" ON "public"."events" FOR DELETE USING ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"()));



CREATE POLICY "Enable delete for authenticated users only" ON "public"."events_staged" FOR DELETE USING ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"()));



CREATE POLICY "Enable delete for authenticated users only" ON "public"."locations" FOR DELETE USING ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"()));



CREATE POLICY "Enable delete for authenticated users only" ON "public"."organizations" FOR DELETE USING ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"()));



CREATE POLICY "Enable delete for authenticated users only" ON "public"."recurrence_patterns" FOR DELETE USING (true);



CREATE POLICY "Enable insert for all users" ON "public"."events_staged" FOR INSERT WITH CHECK ((("title" IS NOT NULL) AND ("length"("title") > 0) AND ("start_date" IS NOT NULL) AND ("start_date" >= CURRENT_DATE) AND (("end_date" IS NULL) OR ("end_date" >= "start_date")) AND (("email" IS NULL) OR ("email" ~* '^[^@]+@[^@]+\.[^@]+$'::"text")) AND (("website" IS NULL) OR ("website" ~* '^https?://'::"text")) AND (("registration_link" IS NULL) OR ("registration_link" ~* '^https?://'::"text"))));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."activity_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."announcements" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"() AND ("title" IS NOT NULL) AND ("length"("title") > 0) AND ("message" IS NOT NULL) AND ("length"("message") > 0) AND ("show_at" >= CURRENT_TIMESTAMP) AND (("expires_at" IS NULL) OR ("expires_at" > "show_at"))));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."event_exceptions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."events" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"() AND ("title" IS NOT NULL) AND ("length"("title") > 0) AND ("start_date" IS NOT NULL) AND ("start_date" >= CURRENT_DATE) AND (("end_date" IS NULL) OR ("end_date" >= "start_date")) AND (("status" IS NULL) OR ("status" = ANY (ARRAY['pending'::"public"."event_status", 'approved'::"public"."event_status", 'duplicate'::"public"."event_status", 'archived'::"public"."event_status"])))));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."locations" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"() AND ("name" IS NOT NULL) AND ("length"("name") > 0) AND (("latitude" IS NULL) OR (("latitude" >= ('-90'::integer)::double precision) AND ("latitude" <= (90)::double precision))) AND (("longitude" IS NULL) OR (("longitude" >= ('-180'::integer)::double precision) AND ("longitude" <= (180)::double precision)))));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."organizations" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"() AND ("name" IS NOT NULL) AND ("length"("name") > 0) AND (("email" IS NULL) OR ("email" ~* '^[^@]+@[^@]+\.[^@]+$'::"text"))));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."recurrence_patterns" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."activity_events" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."announcements" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."event_exceptions" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."events_staged" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."locations" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."organizations" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."recurrence_patterns" FOR SELECT USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."activity_events" FOR UPDATE USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."announcements" FOR UPDATE USING ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"())) WITH CHECK ((("title" IS NOT NULL) AND ("length"("title") > 0) AND ("message" IS NOT NULL) AND ("length"("message") > 0) AND ("show_at" >= CURRENT_TIMESTAMP) AND (("expires_at" IS NULL) OR ("expires_at" > "show_at"))));



CREATE POLICY "Enable update for authenticated users only" ON "public"."event_exceptions" FOR UPDATE USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."events" FOR UPDATE USING ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"())) WITH CHECK ((("title" IS NOT NULL) AND ("length"("title") > 0) AND ("start_date" IS NOT NULL) AND ("start_date" >= CURRENT_DATE) AND (("end_date" IS NULL) OR ("end_date" >= "start_date")) AND (("status" IS NULL) OR ("status" = ANY (ARRAY['pending'::"public"."event_status", 'approved'::"public"."event_status", 'duplicate'::"public"."event_status", 'archived'::"public"."event_status"])))));



CREATE POLICY "Enable update for authenticated users only" ON "public"."events_staged" FOR UPDATE USING ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"())) WITH CHECK ((("title" IS NOT NULL) AND ("length"("title") > 0) AND ("start_date" IS NOT NULL) AND ("start_date" >= CURRENT_DATE) AND (("end_date" IS NULL) OR ("end_date" >= "start_date")) AND (("email" IS NULL) OR ("email" ~* '^[^@]+@[^@]+\.[^@]+$'::"text")) AND (("website" IS NULL) OR ("website" ~* '^https?://'::"text")) AND (("registration_link" IS NULL) OR ("registration_link" ~* '^https?://'::"text"))));



CREATE POLICY "Enable update for authenticated users only" ON "public"."locations" FOR UPDATE USING ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"())) WITH CHECK ((("name" IS NOT NULL) AND ("length"("name") > 0) AND (("latitude" IS NULL) OR (("latitude" >= ('-90'::integer)::double precision) AND ("latitude" <= (90)::double precision))) AND (("longitude" IS NULL) OR (("longitude" >= ('-180'::integer)::double precision) AND ("longitude" <= (180)::double precision)))));



CREATE POLICY "Enable update for authenticated users only" ON "public"."organizations" FOR UPDATE USING ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"())) WITH CHECK ((("name" IS NOT NULL) AND ("length"("name") > 0) AND (("email" IS NULL) OR ("email" ~* '^[^@]+@[^@]+\.[^@]+$'::"text"))));



CREATE POLICY "Enable update for authenticated users only" ON "public"."recurrence_patterns" FOR UPDATE USING (true);



CREATE POLICY "Public can view approved activities" ON "public"."activities" FOR SELECT USING ((("status" = 'approved'::"public"."event_status") AND ("active" = true)));



CREATE POLICY "Public can view calendar exceptions" ON "public"."calendar_exceptions" FOR SELECT USING (true);



CREATE POLICY "Public can view schedules for approved activities" ON "public"."activity_schedule" FOR SELECT USING (("activity_id" IN ( SELECT "activities"."id"
   FROM "public"."activities"
  WHERE (("activities"."status" = 'approved'::"public"."event_status") AND ("activities"."active" = true)))));



CREATE POLICY "Public insert access for announcements_staged" ON "public"."announcements_staged" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public insert access for events" ON "public"."events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public insert access for events_staged" ON "public"."events_staged" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public read access for approved events" ON "public"."events" FOR SELECT USING ((("status" = 'approved'::"public"."event_status") AND ("exclude_from_calendar" = false)));



CREATE POLICY "Public read access for approved locations" ON "public"."locations" FOR SELECT USING (("status" = 'approved'::"public"."event_status"));



CREATE POLICY "Public read access for approved organizations" ON "public"."organizations" FOR SELECT USING (("status" = 'approved'::"public"."event_status"));



CREATE POLICY "Public read access for published announcements" ON "public"."announcements" FOR SELECT USING ((("status" = 'published'::"public"."announcement_status") AND ("show_at" <= "now"()) AND (("expires_at" IS NULL) OR ("expires_at" > "now"()))));



CREATE POLICY "Public read access for tags" ON "public"."tags" FOR SELECT USING (true);



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcements_staged" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_exceptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_exceptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events_staged" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurrence_patterns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scrape_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."source_sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."clone_event_to_series"("p_source_event_id" "uuid", "p_dates" "date"[], "p_titles" "text"[], "p_insert" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."clone_event_to_series"("p_source_event_id" "uuid", "p_dates" "date"[], "p_titles" "text"[], "p_insert" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."clone_event_to_series"("p_source_event_id" "uuid", "p_dates" "date"[], "p_titles" "text"[], "p_insert" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_activity_ancestors"("activity_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_activity_ancestors"("activity_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_activity_ancestors"("activity_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_activity_exceptions"("activity_uuid" "uuid", "query_start_date" "date", "query_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_activity_exceptions"("activity_uuid" "uuid", "query_start_date" "date", "query_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_activity_exceptions"("activity_uuid" "uuid", "query_start_date" "date", "query_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_effective_location"("activity_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_effective_location"("activity_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_effective_location"("activity_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recurring_monthly_events"("p_event_title" "text", "p_day_of_week" "text", "p_week_of_month" integer, "p_months_ahead" integer, "p_start_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."recurring_monthly_events"("p_event_title" "text", "p_day_of_week" "text", "p_week_of_month" integer, "p_months_ahead" integer, "p_start_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recurring_monthly_events"("p_event_title" "text", "p_day_of_week" "text", "p_week_of_month" integer, "p_months_ahead" integer, "p_start_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."activity_events" TO "anon";
GRANT ALL ON TABLE "public"."activity_events" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_events" TO "service_role";



GRANT ALL ON TABLE "public"."activity_schedule" TO "anon";
GRANT ALL ON TABLE "public"."activity_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."announcements_staged" TO "anon";
GRANT ALL ON TABLE "public"."announcements_staged" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements_staged" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_exceptions" TO "anon";
GRANT ALL ON TABLE "public"."calendar_exceptions" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_exceptions" TO "service_role";



GRANT ALL ON TABLE "public"."event_exceptions" TO "anon";
GRANT ALL ON TABLE "public"."event_exceptions" TO "authenticated";
GRANT ALL ON TABLE "public"."event_exceptions" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."events_staged" TO "anon";
GRANT ALL ON TABLE "public"."events_staged" TO "authenticated";
GRANT ALL ON TABLE "public"."events_staged" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."public_activities" TO "anon";
GRANT ALL ON TABLE "public"."public_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."public_activities" TO "service_role";



GRANT ALL ON TABLE "public"."public_announcements" TO "anon";
GRANT ALL ON TABLE "public"."public_announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."public_announcements" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."public_events" TO "anon";
GRANT ALL ON TABLE "public"."public_events" TO "authenticated";
GRANT ALL ON TABLE "public"."public_events" TO "service_role";



GRANT ALL ON TABLE "public"."recurrence_patterns" TO "anon";
GRANT ALL ON TABLE "public"."recurrence_patterns" TO "authenticated";
GRANT ALL ON TABLE "public"."recurrence_patterns" TO "service_role";



GRANT ALL ON TABLE "public"."scrape_logs" TO "anon";
GRANT ALL ON TABLE "public"."scrape_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."scrape_logs" TO "service_role";



GRANT ALL ON TABLE "public"."source_sites" TO "anon";
GRANT ALL ON TABLE "public"."source_sites" TO "authenticated";
GRANT ALL ON TABLE "public"."source_sites" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
