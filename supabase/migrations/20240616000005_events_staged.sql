-- Create events_staged table for public event submissions
CREATE TABLE events_staged (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    location_id UUID REFERENCES locations(id),
    organization_id UUID REFERENCES organizations(id),
    email TEXT,
    website TEXT,
    registration_link TEXT,
    primary_tag_id UUID REFERENCES tags(id),
    secondary_tag_id UUID REFERENCES tags(id),
    image_id UUID,
    external_image_url TEXT,
    featured BOOLEAN DEFAULT FALSE,
    parent_event_id UUID REFERENCES events_staged(id),
    exclude_from_calendar BOOLEAN DEFAULT FALSE,
    google_calendar_event_id TEXT,
    registration BOOLEAN DEFAULT FALSE,
    cost TEXT,
    status TEXT DEFAULT 'pending',
    source_id UUID REFERENCES source_sites(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details_outdated_checked_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE events_staged ENABLE ROW LEVEL SECURITY;

-- Remove all existing policies first (idempotent)
DROP POLICY IF EXISTS "Public insert access for events_staged" ON events_staged;
DROP POLICY IF EXISTS "Enable insert for all users" ON events_staged;
DROP POLICY IF EXISTS "Enable read access for all users" ON events_staged;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON events_staged;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON events_staged;
DROP POLICY IF EXISTS "Admin full access to events_staged" ON events_staged;

-- Public can insert
CREATE POLICY "Public insert access for events_staged" ON events_staged
    FOR INSERT WITH CHECK (true);

-- Only authenticated users (admins) can read/update/delete
CREATE POLICY "Admin read access to events_staged" ON events_staged
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin update access to events_staged" ON events_staged
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete access to events_staged" ON events_staged
    FOR DELETE USING (auth.role() = 'authenticated');

-- Only authenticated users (admins) can do everything else
CREATE POLICY "Admin full access to events_staged" ON events_staged
    FOR ALL USING (auth.role() = 'authenticated'); 