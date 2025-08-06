-- Phase 1: Database Schema Migration for Calendar Functionality
-- This migration implements the comprehensive calendar data model

-- 1. Add activity hierarchy type field to kid_activities
ALTER TABLE kid_activities ADD COLUMN activity_hierarchy_type TEXT 
  CHECK (activity_hierarchy_type IN ('PROGRAM','SESSION','CLASS','DROPIN'));

-- Set default values based on existing data
UPDATE kid_activities SET activity_hierarchy_type = 'PROGRAM' WHERE parent_activity_id IS NULL;
UPDATE kid_activities SET activity_hierarchy_type = 'SESSION' WHERE parent_activity_id IS NOT NULL;

-- 2. Create meeting_pattern table
CREATE TABLE meeting_pattern (
    pattern_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES kid_activities(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    freq TEXT DEFAULT 'WEEKLY',
    interval INTEGER DEFAULT 1,
    until DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create meeting_day table
CREATE TABLE meeting_day (
    pattern_id UUID REFERENCES meeting_pattern(pattern_id) ON DELETE CASCADE,
    weekday CHAR(2) NOT NULL CHECK (weekday IN ('MO','TU','WE','TH','FR','SA','SU')),
    PRIMARY KEY (pattern_id, weekday)
);

-- 4. Create calendar_exception table
CREATE TABLE calendar_exception (
    exception_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    gym_wide BOOLEAN DEFAULT FALSE,
    activity_id UUID REFERENCES kid_activities(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (gym_wide OR activity_id IS NOT NULL)
);

-- 5. Add indexes for performance
CREATE INDEX idx_meeting_pattern_activity_id ON meeting_pattern(activity_id);
CREATE INDEX idx_meeting_pattern_until ON meeting_pattern(until);
CREATE INDEX idx_calendar_exception_dates ON calendar_exception(start_date, end_date);
CREATE INDEX idx_calendar_exception_gym_wide ON calendar_exception(gym_wide);
CREATE INDEX idx_calendar_exception_activity_id ON calendar_exception(activity_id);
CREATE INDEX idx_kid_activities_hierarchy_type ON kid_activities(activity_hierarchy_type);

-- 6. Add triggers for updated_at
CREATE TRIGGER update_meeting_pattern_updated_at 
    BEFORE UPDATE ON meeting_pattern 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_exception_updated_at 
    BEFORE UPDATE ON calendar_exception 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Create helper function for getting activity ancestors
CREATE OR REPLACE FUNCTION get_activity_ancestors(activity_uuid UUID)
RETURNS TABLE(ancestor_id UUID) AS $$
WITH RECURSIVE ancestors AS (
    SELECT id, parent_activity_id, 1 as level
    FROM kid_activities 
    WHERE id = activity_uuid
    
    UNION ALL
    
    SELECT ka.id, ka.parent_activity_id, a.level + 1
    FROM kid_activities ka
    JOIN ancestors a ON ka.id = a.parent_activity_id
    WHERE a.level < 10 -- Prevent infinite loops
)
SELECT id FROM ancestors;
$$ LANGUAGE SQL;

-- 8. Create function to get applicable calendar exceptions for an activity
CREATE OR REPLACE FUNCTION get_activity_exceptions(activity_uuid UUID, query_start_date DATE, query_end_date DATE)
RETURNS TABLE(
    exception_id UUID,
    name TEXT,
    gym_wide BOOLEAN,
    activity_id UUID,
    exception_start_date DATE,
    exception_end_date DATE,
    start_time TIME,
    end_time TIME,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT ce.exception_id, ce.name, ce.gym_wide, ce.activity_id, 
           ce.start_date, ce.end_date, ce.start_time, ce.end_time, ce.notes
    FROM calendar_exception ce
    WHERE (ce.gym_wide = TRUE OR ce.activity_id IN (
        SELECT ancestor_id FROM get_activity_ancestors(activity_uuid)
    ))
    AND ce.start_date <= query_end_date 
    AND ce.end_date >= query_start_date;
END;
$$ LANGUAGE plpgsql;

-- 9. Update the public view to include the new hierarchy type
DROP VIEW IF EXISTS public_kid_activities;

CREATE VIEW public_kid_activities AS
SELECT 
    id,
    name,
    description,
    sponsoring_organization_id,
    website,
    email,
    phone,
    registration_opens,
    registration_closes,
    registration_link,
    registration_info,
    registration_required,
    is_fall,
    is_winter,
    is_spring,
    is_summer,
    is_ongoing,
    season_start_month,
    season_start_year,
    season_end_month,
    season_end_year,
    activity_hierarchy_type,
    min_age,
    max_age,
    min_grade,
    max_grade,
    cost,
    cost_assistance_available,
    cost_assistance_details,
    start_datetime,
    end_datetime,
    rrule,
    commitment_level,
    location_id,
    location_details,
    required_gear,
    gear_assistance_available,
    gear_assistance_details,
    transportation_provided,
    transportation_details,
    transportation_assistance_available,
    transportation_assistance_details,
    additional_requirements,
    special_needs_accommodations,
    special_needs_details,
    max_capacity,
    waitlist_available,
    activity_type,
    participation_type,
    parent_activity_id,
    featured,
    active,
    created_at,
    updated_at
FROM kid_activities
WHERE status = 'approved' AND active = TRUE;

-- 10. Add RLS policies for new tables
ALTER TABLE meeting_pattern ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_day ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_exception ENABLE ROW LEVEL SECURITY;

-- Public read access to meeting patterns for approved activities
CREATE POLICY "Public can view meeting patterns for approved activities" ON meeting_pattern
    FOR SELECT USING (
        activity_id IN (
            SELECT id FROM kid_activities 
            WHERE status = 'approved' AND active = TRUE
        )
    );

-- Public read access to meeting days for approved activities
CREATE POLICY "Public can view meeting days for approved activities" ON meeting_day
    FOR SELECT USING (
        pattern_id IN (
            SELECT mp.pattern_id FROM meeting_pattern mp
            JOIN kid_activities ka ON mp.activity_id = ka.id
            WHERE ka.status = 'approved' AND ka.active = TRUE
        )
    );

-- Public read access to calendar exceptions
CREATE POLICY "Public can view calendar exceptions" ON calendar_exception
    FOR SELECT USING (TRUE);

-- Admin full access to all calendar tables
CREATE POLICY "Admins have full access to meeting patterns" ON meeting_pattern
    FOR ALL USING (is_admin());

CREATE POLICY "Admins have full access to meeting days" ON meeting_day
    FOR ALL USING (is_admin());

CREATE POLICY "Admins have full access to calendar exceptions" ON calendar_exception
    FOR ALL USING (is_admin()); 