-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-assets', 'event-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for event-assets bucket
CREATE POLICY "Public read access for event assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'event-assets');

CREATE POLICY "Authenticated users can upload event assets" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'event-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update event assets" ON storage.objects
    FOR UPDATE USING (bucket_id = 'event-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete event assets" ON storage.objects
    FOR DELETE USING (bucket_id = 'event-assets' AND auth.role() = 'authenticated'); 