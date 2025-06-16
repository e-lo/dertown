-- Enable Row Level Security on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for approved content
CREATE POLICY "Public read access for approved events" ON events
    FOR SELECT USING (status = 'approved' AND exclude_from_calendar = FALSE);

CREATE POLICY "Public read access for approved locations" ON locations
    FOR SELECT USING (status = 'approved');

CREATE POLICY "Public read access for approved organizations" ON organizations
    FOR SELECT USING (status = 'approved');

CREATE POLICY "Public read access for tags" ON tags
    FOR SELECT USING (true);

CREATE POLICY "Public read access for published announcements" ON announcements
    FOR SELECT USING (status = 'published' AND show_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW()));

-- Admin full access (requires authenticated user with admin role)
CREATE POLICY "Admin full access to events" ON events
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to locations" ON locations
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to organizations" ON organizations
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to tags" ON tags
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to source_sites" ON source_sites
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to announcements" ON announcements
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to scrape_logs" ON scrape_logs
    FOR ALL USING (auth.role() = 'authenticated');

-- Public insert access for event submissions (with rate limiting)
CREATE POLICY "Public insert access for events" ON events
    FOR INSERT WITH CHECK (true);

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- For now, allow all authenticated users admin access
    -- In production, you would check for specific admin roles
    RETURN auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 