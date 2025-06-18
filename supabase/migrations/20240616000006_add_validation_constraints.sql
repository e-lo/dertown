-- Add SQL constraints for data validation
-- This provides database-level validation instead of complex application schemas

-- Events table constraints
ALTER TABLE events 
ADD CONSTRAINT events_title_length CHECK (length(title) > 0 AND length(title) <= 255),
ADD CONSTRAINT events_description_length CHECK (length(description) <= 2000),
ADD CONSTRAINT events_email_format CHECK (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'),
ADD CONSTRAINT events_cost_length CHECK (length(cost) <= 100),
ADD CONSTRAINT events_start_date_future CHECK (start_date >= CURRENT_DATE),
ADD CONSTRAINT events_end_date_after_start CHECK (end_date IS NULL OR end_date >= start_date),
ADD CONSTRAINT events_time_consistency CHECK (
    (start_time IS NULL AND end_time IS NULL) OR 
    (start_time IS NOT NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
);

-- Events staged table constraints (same as events)
ALTER TABLE events_staged 
ADD CONSTRAINT events_staged_title_length CHECK (length(title) > 0 AND length(title) <= 255),
ADD CONSTRAINT events_staged_description_length CHECK (length(description) <= 2000),
ADD CONSTRAINT events_staged_email_format CHECK (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'),
ADD CONSTRAINT events_staged_cost_length CHECK (length(cost) <= 100),
ADD CONSTRAINT events_staged_start_date_future CHECK (start_date >= CURRENT_DATE),
ADD CONSTRAINT events_staged_end_date_after_start CHECK (end_date IS NULL OR end_date >= start_date),
ADD CONSTRAINT events_staged_time_consistency CHECK (
    (start_time IS NULL AND end_time IS NULL) OR 
    (start_time IS NOT NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
);

-- Locations table constraints
ALTER TABLE locations 
ADD CONSTRAINT locations_name_length CHECK (length(name) > 0 AND length(name) <= 255),
ADD CONSTRAINT locations_address_length CHECK (length(address) <= 500),
ADD CONSTRAINT locations_phone_length CHECK (length(phone) <= 20),
ADD CONSTRAINT locations_latitude_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
ADD CONSTRAINT locations_longitude_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

-- Organizations table constraints
ALTER TABLE organizations 
ADD CONSTRAINT organizations_name_length CHECK (length(name) > 0 AND length(name) <= 255),
ADD CONSTRAINT organizations_description_length CHECK (length(description) <= 2000),
ADD CONSTRAINT organizations_email_format CHECK (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'),
ADD CONSTRAINT organizations_phone_length CHECK (length(phone) <= 20);

-- Announcements table constraints
ALTER TABLE announcements 
ADD CONSTRAINT announcements_title_length CHECK (length(title) > 0 AND length(title) <= 255),
ADD CONSTRAINT announcements_message_length CHECK (length(message) > 0 AND length(message) <= 2000),
ADD CONSTRAINT announcements_email_format CHECK (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'),
ADD CONSTRAINT announcements_author_length CHECK (length(author) <= 255),
ADD CONSTRAINT announcements_show_at_future CHECK (show_at >= CURRENT_TIMESTAMP),
ADD CONSTRAINT announcements_expires_after_show CHECK (expires_at IS NULL OR expires_at > show_at);

-- Tags table constraints
ALTER TABLE tags 
ADD CONSTRAINT tags_name_length CHECK (length(name) > 0 AND length(name) <= 255),
ADD CONSTRAINT tags_calendar_id_length CHECK (length(calendar_id) <= 255),
ADD CONSTRAINT tags_share_id_length CHECK (length(share_id) <= 255);

-- Source sites table constraints
ALTER TABLE source_sites 
ADD CONSTRAINT source_sites_name_length CHECK (length(name) > 0 AND length(name) <= 255),
ADD CONSTRAINT source_sites_url_format CHECK (url ~* '^https?://'),
ADD CONSTRAINT source_sites_extraction_function_length CHECK (length(extraction_function) <= 255),
ADD CONSTRAINT source_sites_last_status_length CHECK (length(last_status) <= 50),
ADD CONSTRAINT source_sites_last_error_length CHECK (length(last_error) <= 1000);

-- Scrape logs table constraints
ALTER TABLE scrape_logs 
ADD CONSTRAINT scrape_logs_status_length CHECK (length(status) > 0 AND length(status) <= 50),
ADD CONSTRAINT scrape_logs_error_message_length CHECK (length(error_message) <= 1000);

-- Add basic indexes for better performance (removed problematic ones)
CREATE INDEX idx_events_title ON events(title);
CREATE INDEX idx_locations_name ON locations(name);
CREATE INDEX idx_organizations_name ON organizations(name); 