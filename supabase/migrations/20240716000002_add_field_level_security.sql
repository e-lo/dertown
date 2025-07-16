-- Add Field Level Security for private fields
-- This migration creates public views that exclude private fields

-- Create public view for events that excludes email and comments
CREATE OR REPLACE VIEW public_events AS
SELECT 
    id, title, description, start_date, end_date, start_time, end_time,
    location_id, organization_id, website, registration_link, external_image_url,
    cost, registration, status, featured, exclude_from_calendar, created_at, updated_at,
    primary_tag_id, secondary_tag_id
FROM events 
WHERE status = 'approved' AND exclude_from_calendar = FALSE;

-- Create public view for announcements that excludes email and comments
CREATE OR REPLACE VIEW public_announcements AS
SELECT 
    id, title, message, show_at, expires_at, status, created_at
FROM announcements 
WHERE status = 'published' AND show_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW());

-- Grant access to public views for anonymous users
GRANT SELECT ON public_events TO anon;
GRANT SELECT ON public_announcements TO anon;

-- Grant access to public views for authenticated users (for public queries)
GRANT SELECT ON public_events TO authenticated;
GRANT SELECT ON public_announcements TO authenticated; 