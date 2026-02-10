-- Update public_events view and RLS policies to include cancelled events
-- Must run in a separate migration after the enum value is committed

-- Update public_events view to include cancelled events (still excluding excluded-from-calendar)
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
  WHERE (("e"."status" = ANY (ARRAY['approved'::"public"."event_status", 'cancelled'::"public"."event_status"]))
    AND ("e"."exclude_from_calendar" = false)
    AND (("e"."start_date" >= (CURRENT_DATE - '14 days'::interval)) OR (("e"."end_date" IS NOT NULL) AND ("e"."end_date" >= (CURRENT_DATE - '14 days'::interval)))));

ALTER VIEW "public"."public_events" OWNER TO "postgres";

-- Update RLS policies to allow cancelled events to be publicly readable
DROP POLICY IF EXISTS "Public read access for approved events" ON "public"."events";
CREATE POLICY "Public read access for approved events" ON "public"."events"
  FOR SELECT
  USING ((("status" = 'approved'::"public"."event_status") OR ("status" = 'cancelled'::"public"."event_status")) AND ("exclude_from_calendar" = false));

-- Expand insert/update policies to include cancelled status
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."events";
CREATE POLICY "Enable insert for authenticated users only" ON "public"."events"
  FOR INSERT
  WITH CHECK ((
    ("auth"."role"() = 'authenticated'::"text")
    AND "public"."is_admin"()
    AND ("title" IS NOT NULL)
    AND ("length"("title") > 0)
    AND ("start_date" IS NOT NULL)
    AND ("start_date" >= CURRENT_DATE)
    AND (("end_date" IS NULL) OR ("end_date" >= "start_date"))
    AND (("status" IS NULL) OR ("status" = ANY (ARRAY[
      'pending'::"public"."event_status",
      'approved'::"public"."event_status",
      'duplicate'::"public"."event_status",
      'archived'::"public"."event_status",
      'cancelled'::"public"."event_status"
    ])))
  ));

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."events";
CREATE POLICY "Enable update for authenticated users only" ON "public"."events"
  FOR UPDATE
  USING ((("auth"."role"() = 'authenticated'::"text") AND "public"."is_admin"()))
  WITH CHECK ((
    ("title" IS NOT NULL)
    AND ("length"("title") > 0)
    AND ("start_date" IS NOT NULL)
    AND ("start_date" >= CURRENT_DATE)
    AND (("end_date" IS NULL) OR ("end_date" >= "start_date"))
    AND (("status" IS NULL) OR ("status" = ANY (ARRAY[
      'pending'::"public"."event_status",
      'approved'::"public"."event_status",
      'duplicate'::"public"."event_status",
      'archived'::"public"."event_status",
      'cancelled'::"public"."event_status"
    ])))
  ));
