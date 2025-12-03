-- Add parent_event_id to public_events view
-- Drop and recreate the view to add the new column
DROP VIEW IF EXISTS "public"."public_events";

CREATE VIEW "public"."public_events" AS
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
    "e"."parent_event_id",
    "pt"."name" AS "primary_tag_name",
    "st"."name" AS "secondary_tag_name"
   FROM (("public"."events" "e"
     LEFT JOIN "public"."tags" "pt" ON (("e"."primary_tag_id" = "pt"."id")))
     LEFT JOIN "public"."tags" "st" ON (("e"."secondary_tag_id" = "st"."id")))
  WHERE (("e"."status" = 'approved'::"public"."event_status") AND ("e"."exclude_from_calendar" = false) AND (("e"."start_date" >= (CURRENT_DATE - '14 days'::interval)) OR (("e"."end_date" IS NOT NULL) AND ("e"."end_date" >= (CURRENT_DATE - '14 days'::interval)))));

ALTER VIEW "public"."public_events" OWNER TO "postgres";
