-- Migration: Rename kid_activities to activities and add new fields
-- This migration renames the kid_activities table to activities and adds new fields
-- for better activity classification and organization.

-- Step 1: Rename the main table
ALTER TABLE kid_activities RENAME TO activities;

-- Step 2: Rename all related indexes
ALTER INDEX idx_kid_activities_status RENAME TO idx_activities_status;
ALTER INDEX idx_kid_activities_active RENAME TO idx_activities_active;
ALTER INDEX idx_kid_activities_organization_id RENAME TO idx_activities_organization_id;
ALTER INDEX idx_kid_activities_location_id RENAME TO idx_activities_location_id;
ALTER INDEX idx_kid_activities_activity_type RENAME TO idx_activities_activity_type;
ALTER INDEX idx_kid_activities_start_datetime RENAME TO idx_activities_start_datetime;
ALTER INDEX idx_kid_activities_end_datetime RENAME TO idx_activities_end_datetime;
ALTER INDEX idx_kid_activities_featured RENAME TO idx_activities_featured;
ALTER INDEX idx_kid_activities_registration_opens RENAME TO idx_activities_registration_opens;
ALTER INDEX idx_kid_activities_age_range RENAME TO idx_activities_age_range;
ALTER INDEX idx_kid_activities_participation_type RENAME TO idx_activities_participation_type;
ALTER INDEX idx_kid_activities_parent_id RENAME TO idx_activities_parent_id;

-- Step 3: Rename foreign key constraints
ALTER TABLE activities RENAME CONSTRAINT kid_activities_location_id_fkey TO activities_location_id_fkey;
ALTER TABLE activities RENAME CONSTRAINT kid_activities_parent_activity_id_fkey TO activities_parent_activity_id_fkey;

-- Step 4: Add new fields for better activity classification
ALTER TABLE activities ADD COLUMN IF NOT EXISTS audience TEXT CHECK (audience IN ('kids', 'adults', 'all_ages')) DEFAULT 'all_ages';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'all_levels')) DEFAULT 'all_levels';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS activity_category TEXT CHECK (activity_category IN ('sports', 'arts', 'education', 'recreation', 'community', 'fitness', 'outdoor', 'indoor', 'other')) DEFAULT 'other';

-- Step 5: Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_activities_audience ON activities(audience);
CREATE INDEX IF NOT EXISTS idx_activities_skill_level ON activities(skill_level);
CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(activity_category);

-- Step 6: Drop the old view
DROP VIEW IF EXISTS public_kid_activities;

-- Step 7: Create the new view
CREATE VIEW public_activities AS
SELECT 
    ka.id,
    ka.name,
    ka.description,
    ka.sponsoring_organization_id,
    ka.website,
    ka.email,
    ka.phone,
    ka.registration_opens,
    ka.registration_closes,
    ka.registration_link,
    ka.registration_info,
    ka.registration_required,
    ka.is_fall,
    ka.is_winter,
    ka.is_spring,
    ka.is_summer,
    ka.is_ongoing,
    ka.season_start_month,
    ka.season_start_year,
    ka.season_end_month,
    ka.season_end_year,
    ka.min_age,
    ka.max_age,
    ka.min_grade,
    ka.max_grade,
    ka.cost,
    ka.cost_assistance_available,
    ka.cost_assistance_details,
    ka.start_datetime,
    ka.end_datetime,
    ka.rrule,
    ka.commitment_level,
    ka.location_id,
    ka.location_details,
    ka.required_gear,
    ka.gear_assistance_available,
    ka.gear_assistance_details,
    ka.transportation_provided,
    ka.transportation_details,
    ka.transportation_assistance_available,
    ka.transportation_assistance_details,
    ka.additional_requirements,
    ka.special_needs_accommodations,
    ka.special_needs_details,
    ka.max_capacity,
    ka.waitlist_available,
    -- Inherit activity_type from parent when NULL or empty
    COALESCE(NULLIF(ka.activity_type, ''), parent.activity_type) as activity_type,
    ka.participation_type,
    ka.parent_activity_id,
    ka.activity_hierarchy_type,
    ka.status,
    ka.featured,
    ka.active,
    ka.created_at,
    ka.updated_at,
    ka.created_by,
    ka.notes,
    ka.waitlist_status,
    -- New fields
    ka.audience,
    ka.skill_level,
    ka.activity_category
FROM activities ka
LEFT JOIN activities parent ON ka.parent_activity_id = parent.id
WHERE ka.active = true;

-- Step 8: Update RLS policies
DROP POLICY IF EXISTS "Public can view approved kid activities" ON activities;
CREATE POLICY "Public can view approved activities" ON activities
    FOR SELECT USING (status = 'approved' AND active = TRUE);

DROP POLICY IF EXISTS "Admins have full access to kid activities" ON activities;
CREATE POLICY "Admins have full access to activities" ON activities
    FOR ALL USING (is_admin());

-- Step 9: Update any references in other tables
-- Update activity_events table to reference the new table name
ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_events_activity_id_fkey;
ALTER TABLE activity_events ADD CONSTRAINT activity_events_activity_id_fkey 
    FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE;

-- Step 10: Add comments for documentation
COMMENT ON TABLE activities IS 'Activities table - renamed from kid_activities to support all ages';
COMMENT ON COLUMN activities.audience IS 'Target audience: kids, adults, or all_ages';
COMMENT ON COLUMN activities.skill_level IS 'Required skill level: beginner, intermediate, advanced, or all_levels';
COMMENT ON COLUMN activities.activity_category IS 'Activity category for better organization'; 