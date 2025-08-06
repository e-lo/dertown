-- Migration to add season-level date columns for planning ahead
-- These columns allow for month-level precision when exact dates aren't known yet

-- Add season date columns for planning ahead
ALTER TABLE kid_activities ADD COLUMN season_start_month INTEGER CHECK (season_start_month >= 1 AND season_start_month <= 12);
ALTER TABLE kid_activities ADD COLUMN season_start_year INTEGER;
ALTER TABLE kid_activities ADD COLUMN season_end_month INTEGER CHECK (season_end_month >= 1 AND season_end_month <= 12);
ALTER TABLE kid_activities ADD COLUMN season_end_year INTEGER;

-- Add constraint to ensure season dates make sense
ALTER TABLE kid_activities ADD CONSTRAINT valid_season_dates 
  CHECK (
    (season_start_month IS NULL AND season_start_year IS NULL AND season_end_month IS NULL AND season_end_year IS NULL) OR
    (season_start_month IS NOT NULL AND season_start_year IS NOT NULL AND season_end_month IS NOT NULL AND season_end_year IS NOT NULL AND
     (season_start_year < season_end_year OR 
      (season_start_year = season_end_year AND season_start_month <= season_end_month)))
  );

-- Create indexes for season date queries
CREATE INDEX idx_kid_activities_season_start ON kid_activities(season_start_year, season_start_month);
CREATE INDEX idx_kid_activities_season_end ON kid_activities(season_end_year, season_end_month);

-- Update the public view to include the new columns
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
    featured,
    active,
    created_at,
    updated_at
FROM kid_activities
WHERE status = 'approved' AND active = TRUE; 