-- Remove redundant time fields from kid_activities since time is defined in meeting patterns
-- First drop the view that depends on these columns
DROP VIEW IF EXISTS public_kid_activities;

-- Then drop the columns
ALTER TABLE kid_activities DROP COLUMN IF EXISTS schedule_start_time;
ALTER TABLE kid_activities DROP COLUMN IF EXISTS schedule_end_time;
ALTER TABLE kid_activities DROP COLUMN IF EXISTS schedule_days;
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
    -- Schedule fields (only waitlist_status remains)
    waitlist_status
FROM kid_activities
WHERE active = true; 