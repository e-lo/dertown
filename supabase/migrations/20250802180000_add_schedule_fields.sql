-- Add schedule-specific fields to kid_activities table
ALTER TABLE kid_activities ADD COLUMN IF NOT EXISTS schedule_start_time TIME;
ALTER TABLE kid_activities ADD COLUMN IF NOT EXISTS schedule_end_time TIME;
ALTER TABLE kid_activities ADD COLUMN IF NOT EXISTS schedule_days TEXT[]; -- Array of weekday codes (MO, TU, WE, etc.)
ALTER TABLE kid_activities ADD COLUMN IF NOT EXISTS waitlist_status TEXT CHECK (waitlist_status IN ('null', 'full', 'waitlist') OR waitlist_status IS NULL);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_kid_activities_schedule_times ON kid_activities(schedule_start_time, schedule_end_time);
CREATE INDEX IF NOT EXISTS idx_kid_activities_waitlist_status ON kid_activities(waitlist_status);

-- Update the public view to include new fields
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
    -- New schedule fields
    schedule_start_time,
    schedule_end_time,
    schedule_days,
    waitlist_status
FROM kid_activities
WHERE active = true; 