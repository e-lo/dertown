-- Seed the Give Back tag for volunteer/fundraiser/community-support events.
-- Uses WHERE NOT EXISTS to be idempotent (safe to re-run).

INSERT INTO "public"."tags" ("id", "name")
SELECT "extensions"."uuid_generate_v4"(), 'Give Back'
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."tags" WHERE "name" = 'Give Back'
);
