-- Migration: Add image_alt_text for accessibility
ALTER TABLE events ADD COLUMN image_alt_text TEXT;
ALTER TABLE events_staged ADD COLUMN image_alt_text TEXT;

-- Add length constraints
ALTER TABLE events ADD CONSTRAINT events_image_alt_text_length CHECK (image_alt_text IS NULL OR length(image_alt_text) <= 255);
ALTER TABLE events_staged ADD CONSTRAINT events_staged_image_alt_text_length CHECK (image_alt_text IS NULL OR length(image_alt_text) <= 255);

-- Add comments for accessibility
COMMENT ON COLUMN events.image_alt_text IS 'Alt text for event image for accessibility (screen readers)';
COMMENT ON COLUMN events_staged.image_alt_text IS 'Alt text for event image for accessibility (screen readers)'; 