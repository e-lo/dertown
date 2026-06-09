-- Reconcile program_format enum per docs/KID_ACTIVITIES_PRD.md
--
-- Before: camp | league | lesson | class | session   (added 20260526120000)
-- After:  camp | league | class | workshop
--
-- Rationale:
--   * 'session' collided with the SESSION value of activity_hierarchy_type and is
--     dropped as a *format*. SESSION remains a hierarchy tier only.
--   * 'lesson' merges into 'class' (both = recurring / multi-instance offerings).
--   * 'workshop' is added (one-off or short multi-instance; may be a parentless leaf).
--
-- Data migration (conservative — review against real data before applying to prod):
--   * lesson  -> class   (locked decision; safe semantic merge)
--   * session -> NULL     (ambiguous origin; NULL = "uncategorized", surfaces as the
--                          catch-all on /families/programs for a human to recategorize.
--                          We do NOT guess a concrete format for these rows.)

-- 1. Drop the old CHECK constraint so existing values can be remapped.
ALTER TABLE "public"."activities"
  DROP CONSTRAINT IF EXISTS "activities_program_format_check";

-- 2. Remap existing rows to the new vocabulary.
UPDATE "public"."activities" SET "program_format" = 'class'
  WHERE "program_format" = 'lesson';

UPDATE "public"."activities" SET "program_format" = NULL
  WHERE "program_format" = 'session';

-- 3. Re-add the CHECK constraint with the reconciled value set.
ALTER TABLE "public"."activities"
  ADD CONSTRAINT "activities_program_format_check"
  CHECK ("program_format" IN ('camp', 'league', 'class', 'workshop'));

-- 4. Refresh the column comment.
COMMENT ON COLUMN "public"."activities"."program_format" IS
  'Structural template for the top-level offering: camp (PROGRAM -> weekly SESSIONs), '
  'league (PROGRAM -> season SESSION -> division CLASS_TYPE -> team CLASS_INSTANCE), '
  'class (PROGRAM -> CLASS_TYPE -> CLASS_INSTANCE), workshop (parentless PROGRAM leaf). '
  'NULL = uncategorized. See docs/KID_ACTIVITIES_PRD.md.';

-- Note: public_activities view already selects program_format and does not filter on its
-- values, so it does not need to be rebuilt for this enum change.
