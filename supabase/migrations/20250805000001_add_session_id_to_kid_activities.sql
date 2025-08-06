-- Add session_id field to kid_activities table
-- This allows class instances to be associated with specific sessions

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kid_activities' 
        AND column_name = 'session_id'
    ) THEN
        ALTER TABLE kid_activities ADD COLUMN session_id UUID REFERENCES kid_activities(id);
    END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_kid_activities_session_id ON kid_activities(session_id);

-- Add comment
COMMENT ON COLUMN kid_activities.session_id IS 'Optional session association for class instances. Allows class instances to be associated with specific sessions even when their parent is a class type.'; 