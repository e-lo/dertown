-- Update activity hierarchy to support the new design
-- PROGRAM -> SESSION (optional) -> CLASS_TYPE -> SCHEDULE

-- Update the activity_hierarchy_type enum to include SCHEDULE
ALTER TABLE kid_activities DROP CONSTRAINT IF EXISTS kid_activities_activity_hierarchy_type_check;
ALTER TABLE kid_activities ADD CONSTRAINT kid_activities_activity_hierarchy_type_check 
  CHECK (activity_hierarchy_type IN ('PROGRAM','SESSION','CLASS_TYPE','SCHEDULE'));

-- Add a new table for schedules (multiple times per class type)
CREATE TABLE activity_schedule (
    schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES kid_activities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_capacity INTEGER,
    waitlist_available BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update calendar exception to remove gym_wide and make it cascade automatically
ALTER TABLE calendar_exception DROP COLUMN IF EXISTS gym_wide;
ALTER TABLE calendar_exception DROP CONSTRAINT IF EXISTS calendar_exception_check;
ALTER TABLE calendar_exception ADD CONSTRAINT calendar_exception_activity_id_not_null 
  CHECK (activity_id IS NOT NULL);

-- Add indexes for performance
CREATE INDEX idx_activity_schedule_activity_id ON activity_schedule(activity_id);
CREATE INDEX idx_activity_schedule_active ON activity_schedule(active);

-- Add trigger for updated_at
CREATE TRIGGER update_activity_schedule_updated_at 
    BEFORE UPDATE ON activity_schedule 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Drop and recreate the get_activity_exceptions function to cascade automatically
DROP FUNCTION IF EXISTS get_activity_exceptions(UUID, DATE, DATE);
CREATE OR REPLACE FUNCTION get_activity_exceptions(activity_uuid UUID, query_start_date DATE, query_end_date DATE)
RETURNS TABLE(
    exception_id UUID,
    name TEXT,
    activity_id UUID,
    exception_start_date DATE,
    exception_end_date DATE,
    start_time TIME,
    end_time TIME,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT ce.exception_id, ce.name, ce.activity_id, 
           ce.start_date, ce.end_date, ce.start_time, ce.end_time, ce.notes
    FROM calendar_exception ce
    WHERE ce.activity_id IN (
        SELECT ancestor_id FROM get_activity_ancestors(activity_uuid)
    )
    AND ce.start_date <= query_end_date 
    AND ce.end_date >= query_start_date;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for activity_schedule
ALTER TABLE activity_schedule ENABLE ROW LEVEL SECURITY;

-- Public read access to schedules for approved activities
CREATE POLICY "Public can view schedules for approved activities" ON activity_schedule
    FOR SELECT USING (
        activity_id IN (
            SELECT id FROM kid_activities 
            WHERE status = 'approved' AND active = TRUE
        )
    );

-- Admin full access to schedules
CREATE POLICY "Admins have full access to schedules" ON activity_schedule
    FOR ALL USING (is_admin());

-- Update the public view to include the new hierarchy type
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