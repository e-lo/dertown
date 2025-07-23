drop view if exists "public"."public_events";

alter table "public"."events" drop column "google_calendar_event_id";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.recurring_monthly_events(p_event_title text, p_day_of_week text, p_week_of_month integer, p_months_ahead integer DEFAULT 6, p_start_month integer DEFAULT (EXTRACT(month FROM CURRENT_DATE))::integer)
 RETURNS TABLE(title text, date date)
 LANGUAGE plpgsql
AS $function$
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
$function$
;

create or replace view "public"."public_events" as  SELECT id,
    title,
    description,
    start_date,
    end_date,
    start_time,
    end_time,
    location_id,
    organization_id,
    website,
    registration_link,
    external_image_url,
    cost,
    registration,
    status,
    featured,
    exclude_from_calendar,
    created_at,
    updated_at,
    primary_tag_id,
    secondary_tag_id,
    image_alt_text
   FROM events
  WHERE ((status = 'approved'::event_status) AND (exclude_from_calendar = false) AND ((start_date >= (CURRENT_DATE - '14 days'::interval)) OR ((end_date IS NOT NULL) AND (end_date >= (CURRENT_DATE - '14 days'::interval)))));



