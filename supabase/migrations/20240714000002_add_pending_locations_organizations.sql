-- Add columns for pending location and organization additions
-- This allows admins to review new locations/organizations before approving them

-- Add to events_staged table
ALTER TABLE events_staged 
ADD COLUMN location_added TEXT,
ADD COLUMN organization_added TEXT;

-- Add to announcements_staged table  
ALTER TABLE announcements_staged
ADD COLUMN location_added TEXT,
ADD COLUMN organization_added TEXT;

-- Add comments for clarity
COMMENT ON COLUMN events_staged.location_added IS 'Name of new location to be reviewed by admin';
COMMENT ON COLUMN events_staged.organization_added IS 'Name of new organization to be reviewed by admin';
COMMENT ON COLUMN announcements_staged.location_added IS 'Name of new location to be reviewed by admin';
COMMENT ON COLUMN announcements_staged.organization_added IS 'Name of new organization to be reviewed by admin'; 