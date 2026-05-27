-- Fix public_announcements view: treat show_at IS NULL as "show immediately"
-- The original view used `show_at <= now()` which excludes NULL values in PostgreSQL
-- (NULL comparisons evaluate to NULL, not TRUE). Many announcements use show_at=NULL
-- to mean "publish immediately", so they were incorrectly hidden.
-- Also removes the 14-day lookback restriction — expiry is controlled by expires_at.

CREATE OR REPLACE VIEW public.public_announcements AS
SELECT
  id,
  title,
  message,
  link,
  email,
  organization_id,
  author,
  show_at,
  expires_at,
  created_at,
  status
FROM public.announcements
WHERE
  status = 'published'
  AND (show_at IS NULL OR show_at <= now())
  AND (expires_at IS NULL OR expires_at > now());
