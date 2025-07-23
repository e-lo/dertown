-- Migration: Update public views to filter out old events and announcements
-- This keeps the public view uncluttered by only showing recent content (last 14 days)

-- Update public_events view to only include recent events
CREATE OR REPLACE VIEW public_events AS
SELECT 
    id, title, description, start_date, end_date, start_time, end_time,
    location_id, organization_id, website, registration_link, external_image_url,
    cost, registration, status, featured, exclude_from_calendar, created_at, updated_at,
    primary_tag_id, secondary_tag_id,
    image_alt_text
FROM events 
WHERE status = 'approved'
  AND exclude_from_calendar = FALSE
  AND (
    start_date >= (CURRENT_DATE - INTERVAL '14 days')
    OR (end_date IS NOT NULL AND end_date >= (CURRENT_DATE - INTERVAL '14 days'))
  );

-- Update public_announcements view to only include recent announcements
CREATE OR REPLACE VIEW public_announcements AS
SELECT 
    id, title, message, show_at, expires_at, status, created_at
FROM announcements 
WHERE status = 'published'
  AND show_at <= NOW()
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (
    show_at >= (NOW() - INTERVAL '14 days')
    OR (expires_at IS NOT NULL AND expires_at >= (NOW() - INTERVAL '14 days'))
  );

-- Grant access to updated views for anonymous users
GRANT SELECT ON public_events TO anon;
GRANT SELECT ON public_announcements TO anon;

-- Grant access to updated views for authenticated users (for public queries)
GRANT SELECT ON public_events TO authenticated;
GRANT SELECT ON public_announcements TO authenticated; 