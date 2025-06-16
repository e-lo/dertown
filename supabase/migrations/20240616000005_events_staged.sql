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

-- Public can insert
CREATE POLICY "Public insert access for events_staged" ON events_staged
    FOR INSERT WITH CHECK (true);

-- Admins can read/write all
CREATE POLICY "Admin full access to events_staged" ON events_staged
    FOR ALL USING (auth.role() = 'authenticated'); 