-- Allow public read access to source_sites so the scraper can resolve
-- source IDs using the anon key (dry-run mode reads without writing).
CREATE POLICY "Enable read access for all users"
  ON "public"."source_sites"
  FOR SELECT
  USING (true);
