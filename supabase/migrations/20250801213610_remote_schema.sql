set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.clone_event_to_series(p_source_event_id uuid, p_dates date[], p_titles text[], p_insert boolean DEFAULT false)
 RETURNS TABLE(title text, start_date date, start_time time without time zone, end_time time without time zone, external_image_url text, image_alt_text text, website text, cost text, parent_event_id uuid, primary_tag_id uuid, secondary_tag_id uuid, organization_id uuid, location_id uuid)
 LANGUAGE plpgsql
AS $function$
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
$function$
;


