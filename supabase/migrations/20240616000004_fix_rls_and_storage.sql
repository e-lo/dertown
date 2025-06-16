-- Fix RLS policies to allow public event submissions
DROP POLICY IF EXISTS "Public insert access for events" ON events;
CREATE POLICY "Public insert access for events" ON events
    FOR INSERT WITH CHECK (true);

-- Fix storage bucket creation (ensure it exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-assets', 'event-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Update storage policies to be more permissive for testing
DROP POLICY IF EXISTS "Public read access for event assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update event assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete event assets" ON storage.objects;

CREATE POLICY "Public read access for event assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'event-assets');

CREATE POLICY "Public upload access for event assets" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'event-assets');

CREATE POLICY "Public update access for event assets" ON storage.objects
    FOR UPDATE USING (bucket_id = 'event-assets');

CREATE POLICY "Public delete access for event assets" ON storage.objects
    FOR DELETE USING (bucket_id = 'event-assets'); 