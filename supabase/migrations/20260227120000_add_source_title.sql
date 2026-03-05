-- Add source_title column for dedup-safe title matching.
-- The scraper writes the original parsed title here; admins can freely edit
-- the public-facing `title` without breaking future dedup matching.
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_title text;
ALTER TABLE events_staged ADD COLUMN IF NOT EXISTS source_title text;
