-- Migration to implement CLASS_INSTANCE and events schema
-- This replaces the previous SCHEDULE approach with a more flexible event system

-- 1. Update activity_hierarchy_type to include CLASS_INSTANCE
ALTER TABLE kid_activities 
DROP CONSTRAINT IF EXISTS kid_activities_activity_hierarchy_type_check;

ALTER TABLE kid_activities 
ADD CONSTRAINT kid_activities_activity_hierarchy_type_check 
CHECK (activity_hierarchy_type IN ('PROGRAM','SESSION','CLASS_TYPE','CLASS_INSTANCE'));

-- 2. Add waitlist_status enum to kid_activities (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kid_activities' AND column_name = 'waitlist_status') THEN
        ALTER TABLE kid_activities 
        ADD COLUMN waitlist_status TEXT CHECK (waitlist_status IN (NULL, 'FULL_WAITLIST_AVAILABLE', 'FULL'));
    END IF;
END $$;

-- 3. Drop old meeting_pattern and meeting_day tables if they exist
DROP TABLE IF EXISTS meeting_day CASCADE;
DROP TABLE IF EXISTS meeting_pattern CASCADE;

-- 4. Create new recurrence_patterns table
CREATE TABLE recurrence_patterns (
    pattern_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    freq TEXT DEFAULT 'WEEKLY',
    interval INTEGER DEFAULT 1,
    weekdays TEXT[] NOT NULL CHECK (array_length(weekdays, 1) > 0),
    until DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create activity_events table
CREATE TABLE activity_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES kid_activities(id) ON DELETE CASCADE,
    event_type TEXT CHECK (event_type IN ('RECURRING', 'ONE_OFF')),
    name TEXT NOT NULL,
    description TEXT,
    recurrence_pattern_id UUID REFERENCES recurrence_patterns(pattern_id),
    start_datetime TIMESTAMP WITH TIME ZONE,
    end_datetime TIMESTAMP WITH TIME ZONE,
    waitlist_status TEXT CHECK (waitlist_status IN (NULL, 'FULL_WAITLIST_AVAILABLE', 'FULL')),
    ignore_exceptions BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CHECK (
        (event_type = 'RECURRING' AND recurrence_pattern_id IS NOT NULL AND start_datetime IS NULL AND end_datetime IS NULL) OR
        (event_type = 'ONE_OFF' AND recurrence_pattern_id IS NULL AND start_datetime IS NOT NULL AND end_datetime IS NOT NULL)
    )
);

-- 6. Create event_exceptions table
CREATE TABLE event_exceptions (
    exception_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES activity_events(event_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Rename calendar_exception to calendar_exceptions and update
ALTER TABLE IF EXISTS calendar_exception RENAME TO calendar_exceptions;

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_recurrence_patterns_until ON recurrence_patterns(until);
CREATE INDEX IF NOT EXISTS idx_activity_events_activity_id ON activity_events(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_type ON activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_events_datetime ON activity_events(start_datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_event_exceptions_event_id ON event_exceptions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_exceptions_datetime ON event_exceptions(start_datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_activity_id ON calendar_exceptions(activity_id);
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_dates ON calendar_exceptions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_kid_activities_waitlist_status ON kid_activities(waitlist_status);

-- 9. Add triggers for updated_at
CREATE TRIGGER update_recurrence_patterns_updated_at 
    BEFORE UPDATE ON recurrence_patterns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activity_events_updated_at 
    BEFORE UPDATE ON activity_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_exceptions_updated_at 
    BEFORE UPDATE ON calendar_exceptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Enable RLS on new tables
ALTER TABLE recurrence_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_exceptions ENABLE ROW LEVEL SECURITY;

-- 11. Add RLS policies
CREATE POLICY "Enable read access for all users" ON recurrence_patterns FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON recurrence_patterns FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON recurrence_patterns FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON recurrence_patterns FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON activity_events FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON activity_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON activity_events FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON activity_events FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON event_exceptions FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON event_exceptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON event_exceptions FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON event_exceptions FOR DELETE USING (true);

-- 12. Update public_kid_activities view to include waitlist_status
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
    activity_hierarchy_type,
    status,
    featured,
    active,
    created_at,
    updated_at,
    created_by,
    notes,
    waitlist_status
FROM kid_activities
WHERE active = true;

-- 13. Delete existing SCHEDULE activities (as requested)
DELETE FROM kid_activities WHERE activity_hierarchy_type = 'SCHEDULE';

-- 14. Helper function to get all ancestor activities for exception cascading
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

-- 15. Function to get all exceptions for an activity (including ancestors)
DROP FUNCTION IF EXISTS get_activity_exceptions(UUID, DATE, DATE);
CREATE OR REPLACE FUNCTION get_activity_exceptions(
    activity_uuid UUID,
    query_start_date DATE,
    query_end_date DATE
)
RETURNS TABLE(
    exception_id UUID,
    name TEXT,
    activity_id UUID,
    start_date DATE,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.exception_id,
        ce.name,
        ce.activity_id,
        ce.start_date,
        ce.end_date,
        ce.start_time,
        ce.end_time,
        ce.notes
    FROM calendar_exceptions ce
    WHERE ce.activity_id IN (
        SELECT ancestor_id FROM get_activity_ancestors(activity_uuid)
    )
    AND ce.start_date <= query_end_date 
    AND ce.end_date >= query_start_date;
END;
$$ LANGUAGE plpgsql; 