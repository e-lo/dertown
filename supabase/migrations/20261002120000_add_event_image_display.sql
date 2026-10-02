-- Per-event image framing for the carousel card and detail page.
--
-- Holds admin choices (focal point / full-with-blur / detail layout) plus the
-- image's natural size and the URL the settings were made for. Parsed and
-- validated by src/lib/image-display.ts; NULL means "all Auto".
--
-- public_events lists columns explicitly, so it is replaced to expose the new
-- column. CREATE OR REPLACE VIEW can only append columns, hence its position.

ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "image_display" jsonb;

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
    "e"."parent_event_id",
    "pt"."name" AS "primary_tag_name",
    "st"."name" AS "secondary_tag_name",
    "e"."image_display"
   FROM (("public"."events" "e"
     LEFT JOIN "public"."tags" "pt" ON (("e"."primary_tag_id" = "pt"."id")))
     LEFT JOIN "public"."tags" "st" ON (("e"."secondary_tag_id" = "st"."id")))
  WHERE (
    "e"."status" = 'approved'::"public"."event_status"
    AND "e"."exclude_from_calendar" = false
    AND (
      ("e"."start_date" >= (CURRENT_DATE - '14 days'::interval))
      OR (("e"."end_date" IS NOT NULL) AND ("e"."end_date" >= (CURRENT_DATE - '14 days'::interval)))
    )
  );
