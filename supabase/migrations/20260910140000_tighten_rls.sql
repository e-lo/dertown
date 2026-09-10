-- Tighten row-level security to what the app actually needs.
--
-- Every write in the site goes through the service role (which bypasses RLS),
-- the mobile app only calls /api routes, and there is no browser-side Supabase
-- client. So the anon key only ever needs to READ approved/published rows, and
-- authenticated-user policies only matter for direct REST calls. Yet the
-- schema had accumulated:
--   * an anon INSERT policy on events and USING (true) UPDATE/DELETE policies
--     on activity_events;
--   * blanket "read access for all users" policies that OR together with the
--     approved-only policies and expose archived events, unapproved locations
--     and every staged submission to the public key;
--   * admin policies keyed on auth.role() = 'authenticated' or on is_admin(),
--     which on production returns true for any signed-in user.
-- The real admin check is has_admin_access() (user_permissions.is_admin), which
-- the newer *_super_admin policies already use. This migration makes that the
-- only admin path and retires is_admin().

-- ── events ───────────────────────────────────────────────────────────────────
-- keep: "Public read access for approved events", events_org_editor_*, events_super_admin
DROP POLICY IF EXISTS "Public insert access for events"            ON "public"."events";
DROP POLICY IF EXISTS "Enable read access for all users"           ON "public"."events";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."events";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."events";
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."events";

-- ── events_staged ────────────────────────────────────────────────────────────
-- Submissions are inserted server-side with the service role; nothing reads
-- staged rows with the anon key.
DROP POLICY IF EXISTS "Enable read access for all users"           ON "public"."events_staged";
DROP POLICY IF EXISTS "Public insert access for events_staged"     ON "public"."events_staged";
DROP POLICY IF EXISTS "Enable insert for all users"                ON "public"."events_staged";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."events_staged";
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."events_staged";
DROP POLICY IF EXISTS "Admin full access to events_staged"         ON "public"."events_staged";
DROP POLICY IF EXISTS "Admin read access to events_staged"         ON "public"."events_staged";
DROP POLICY IF EXISTS "Admin update access to events_staged"       ON "public"."events_staged";
DROP POLICY IF EXISTS "Admin delete access to events_staged"       ON "public"."events_staged";
CREATE POLICY "events_staged_super_admin" ON "public"."events_staged"
  FOR ALL USING ("public"."has_admin_access"()) WITH CHECK ("public"."has_admin_access"());

-- ── announcements_staged ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public insert access for announcements_staged" ON "public"."announcements_staged";
DROP POLICY IF EXISTS "Admin full access to announcements_staged"     ON "public"."announcements_staged";
DROP POLICY IF EXISTS "Admin read access to announcements_staged"     ON "public"."announcements_staged";
DROP POLICY IF EXISTS "Admin update access to announcements_staged"   ON "public"."announcements_staged";
DROP POLICY IF EXISTS "Admin delete access to announcements_staged"   ON "public"."announcements_staged";
CREATE POLICY "announcements_staged_super_admin" ON "public"."announcements_staged"
  FOR ALL USING ("public"."has_admin_access"()) WITH CHECK ("public"."has_admin_access"());

-- ── locations / organizations ────────────────────────────────────────────────
-- keep: "Public read access for approved …", *_org_editor_*, *_super_admin
DROP POLICY IF EXISTS "Enable read access for all users"           ON "public"."locations";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."locations";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."locations";
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."locations";
DROP POLICY IF EXISTS "Enable read access for all users"           ON "public"."organizations";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."organizations";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."organizations";
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."organizations";

-- ── announcements ────────────────────────────────────────────────────────────
-- The published-only policy excluded rows with show_at IS NULL (NULL <= now()
-- is NULL), which is why /api/announcements leaned on the blanket policy.
-- Treat a null show_at as "show immediately" so the blanket policy can go.
DROP POLICY IF EXISTS "Enable read access for all users"             ON "public"."announcements";
DROP POLICY IF EXISTS "Enable insert for authenticated users only"   ON "public"."announcements";
DROP POLICY IF EXISTS "Enable update for authenticated users only"   ON "public"."announcements";
DROP POLICY IF EXISTS "Public read access for published announcements" ON "public"."announcements";
CREATE POLICY "Public read access for published announcements" ON "public"."announcements"
  FOR SELECT USING (
    "status" = 'published'::"public"."announcement_status"
    AND ("show_at" IS NULL OR "show_at" <= "now"())
    AND ("expires_at" IS NULL OR "expires_at" > "now"())
  );

-- ── tags / source_sites / scrape_logs ────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access to tags" ON "public"."tags";
CREATE POLICY "tags_super_admin" ON "public"."tags"
  FOR ALL USING ("public"."has_admin_access"()) WITH CHECK ("public"."has_admin_access"());
-- source_sites is scraper/admin configuration; no public page reads it.
DROP POLICY IF EXISTS "Enable read access for all users"    ON "public"."source_sites";
DROP POLICY IF EXISTS "Admin full access to source_sites"   ON "public"."source_sites";
CREATE POLICY "source_sites_super_admin" ON "public"."source_sites"
  FOR ALL USING ("public"."has_admin_access"()) WITH CHECK ("public"."has_admin_access"());
DROP POLICY IF EXISTS "Admin full access to scrape_logs" ON "public"."scrape_logs";
CREATE POLICY "scrape_logs_super_admin" ON "public"."scrape_logs"
  FOR ALL USING ("public"."has_admin_access"()) WITH CHECK ("public"."has_admin_access"());

-- ── activities / activity_events ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins have full access to activities" ON "public"."activities";
CREATE POLICY "activities_super_admin" ON "public"."activities"
  FOR ALL USING ("public"."has_admin_access"()) WITH CHECK ("public"."has_admin_access"());
DROP POLICY IF EXISTS "Enable read access for all users"           ON "public"."activity_events";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."activity_events";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."activity_events";
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."activity_events";
CREATE POLICY "Public can view events for approved activities" ON "public"."activity_events"
  FOR SELECT USING (
    "activity_id" IN (
      SELECT "id" FROM "public"."activities"
      WHERE "status" = 'approved'::"public"."event_status" AND "active" = true
    )
  );
CREATE POLICY "activity_events_super_admin" ON "public"."activity_events"
  FOR ALL USING ("public"."has_admin_access"()) WITH CHECK ("public"."has_admin_access"());

-- ── push_tokens ──────────────────────────────────────────────────────────────
-- Registered through /api/mobile/register-push-token with the service role.
DROP POLICY IF EXISTS "Anyone can register push token"     ON "public"."push_tokens";
DROP POLICY IF EXISTS "Anyone can update their push token" ON "public"."push_tokens";
CREATE POLICY "push_tokens_super_admin" ON "public"."push_tokens"
  FOR ALL USING ("public"."has_admin_access"()) WITH CHECK ("public"."has_admin_access"());

-- ── dormant scheduling tables ────────────────────────────────────────────────
-- activity_schedule and calendar_exceptions are dropped in the next migration;
-- their is_admin() policies go now so the function can be removed. Their
-- public read policies stay until the tables do.
DROP POLICY IF EXISTS "Admins have full access to schedules"           ON "public"."activity_schedule";
DROP POLICY IF EXISTS "Admins have full access to calendar exceptions" ON "public"."calendar_exceptions";

-- Nothing references is_admin() any more.
DROP FUNCTION IF EXISTS "public"."is_admin"();
