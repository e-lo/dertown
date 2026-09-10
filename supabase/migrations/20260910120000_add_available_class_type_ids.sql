-- Which class types a SESSION offers.
--
-- Some programs run every class type each season (ski teams), others run a
-- session for just one (LSC "Kinder Kicks"). Sessions and class types are
-- siblings under the same PROGRAM, so a session lists the sibling CLASS_TYPE
-- ids it offers. NULL or empty means "all class types" (the common case).
--
-- Postgres can't enforce foreign keys on array elements; the admin UI only
-- offers sibling class types, and the public pages ignore unknown ids.
ALTER TABLE "public"."activities"
  ADD COLUMN IF NOT EXISTS "available_class_type_ids" uuid[] DEFAULT NULL;

COMMENT ON COLUMN "public"."activities"."available_class_type_ids" IS
  'SESSION rows only: sibling CLASS_TYPE ids offered in this session. NULL/empty = all class types.';
