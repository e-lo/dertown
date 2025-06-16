-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types for status fields
CREATE TYPE event_status AS ENUM ('pending', 'approved', 'duplicate', 'archived');
CREATE TYPE import_frequency AS ENUM ('hourly', 'daily', 'weekly', 'manual');
CREATE TYPE announcement_status AS ENUM ('pending', 'published', 'archived');

-- Create locations table
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    website TEXT,
    phone TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    parent_location_id UUID REFERENCES locations(id),
    status event_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    website TEXT,
    phone TEXT,
    email TEXT,
    location_id UUID REFERENCES locations(id),
    parent_organization_id UUID REFERENCES organizations(id),
    status event_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    calendar_id TEXT,
    share_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create source_sites table
CREATE TABLE source_sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    event_tag_id UUID REFERENCES tags(id),
    last_scraped TIMESTAMP WITH TIME ZONE,
    last_status TEXT,
    last_error TEXT,
    import_frequency import_frequency DEFAULT 'manual',
    extraction_function TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE events (
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
    image_id UUID, -- Will reference storage bucket
    external_image_url TEXT,
    featured BOOLEAN DEFAULT FALSE,
    parent_event_id UUID REFERENCES events(id),
    exclude_from_calendar BOOLEAN DEFAULT FALSE,
    google_calendar_event_id TEXT,
    registration BOOLEAN DEFAULT FALSE,
    cost TEXT,
    status event_status DEFAULT 'pending',
    source_id UUID REFERENCES source_sites(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details_outdated_checked_at TIMESTAMP WITH TIME ZONE
);

-- Create announcements table
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    email TEXT,
    organization_id UUID REFERENCES organizations(id),
    author TEXT,
    status announcement_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    show_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create scrape_logs table
CREATE TABLE scrape_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES source_sites(id) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL,
    error_message TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_location_id ON events(location_id);
CREATE INDEX idx_events_organization_id ON events(organization_id);
CREATE INDEX idx_events_primary_tag_id ON events(primary_tag_id);
CREATE INDEX idx_events_featured ON events(featured);
CREATE INDEX idx_events_exclude_from_calendar ON events(exclude_from_calendar);

CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_show_at ON announcements(show_at);
CREATE INDEX idx_announcements_expires_at ON announcements(expires_at);

CREATE INDEX idx_locations_status ON locations(status);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_source_sites_import_frequency ON source_sites(import_frequency);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_source_sites_updated_at BEFORE UPDATE ON source_sites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 