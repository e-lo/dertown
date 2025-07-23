-- Migration: Add image_alt_text to public_events view for accessibility
CREATE OR REPLACE VIEW public_events AS
SELECT 
    id, title, description, start_date, end_date, start_time, end_time,
    location_id, organization_id, website, registration_link, external_image_url,
    cost, registration, status, featured, exclude_from_calendar, created_at, updated_at,
    primary_tag_id, secondary_tag_id,
    image_alt_text -- now at the end
FROM events 
WHERE status = 'approved'
  AND exclude_from_calendar = FALSE
  AND (
    start_date >= (CURRENT_DATE - INTERVAL '14 days')
    OR (end_date IS NOT NULL AND end_date >= (CURRENT_DATE - INTERVAL '14 days'))
  ); 