-- Migration to update kid_activities registration fields
-- Remove advance registration fields, rename general_registration_opens, and add registration_info text field

-- Drop the view first since it depends on the columns we're modifying
DROP VIEW IF EXISTS public_kid_activities;

-- Add the new registration_info field
ALTER TABLE kid_activities ADD COLUMN registration_info TEXT;

-- Add season boolean fields
ALTER TABLE kid_activities ADD COLUMN is_fall BOOLEAN DEFAULT FALSE;
ALTER TABLE kid_activities ADD COLUMN is_winter BOOLEAN DEFAULT FALSE;
ALTER TABLE kid_activities ADD COLUMN is_spring BOOLEAN DEFAULT FALSE;
ALTER TABLE kid_activities ADD COLUMN is_summer BOOLEAN DEFAULT FALSE;
ALTER TABLE kid_activities ADD COLUMN is_ongoing BOOLEAN DEFAULT FALSE;

-- Remove the old advance registration fields
ALTER TABLE kid_activities DROP COLUMN advance_registration_opens;
ALTER TABLE kid_activities DROP COLUMN advance_registration_requirements;

-- Rename general_registration_opens to registration_opens
ALTER TABLE kid_activities RENAME COLUMN general_registration_opens TO registration_opens;

-- Drop the old index that included the removed fields
DROP INDEX IF EXISTS idx_kid_activities_registration_opens;

-- Create new index for registration fields
CREATE INDEX idx_kid_activities_registration_opens ON kid_activities(registration_opens);

-- Create indexes for season fields
CREATE INDEX idx_kid_activities_is_fall ON kid_activities(is_fall);
CREATE INDEX idx_kid_activities_is_winter ON kid_activities(is_winter);
CREATE INDEX idx_kid_activities_is_spring ON kid_activities(is_spring);
CREATE INDEX idx_kid_activities_is_summer ON kid_activities(is_summer);
CREATE INDEX idx_kid_activities_is_ongoing ON kid_activities(is_ongoing);

-- Recreate the public view to reflect the new structure
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