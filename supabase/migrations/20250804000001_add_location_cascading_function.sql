-- Function to get the effective location for any activity by cascading up the hierarchy
CREATE OR REPLACE FUNCTION get_effective_location(activity_uuid UUID)
RETURNS TABLE (
  location_id UUID,
  location_name TEXT,
  location_address TEXT,
  location_details TEXT,
  source_level TEXT
) AS $$
DECLARE
  current_activity RECORD;
  parent_activity RECORD;
  found_location BOOLEAN := FALSE;
BEGIN
  -- Start with the current activity
  SELECT * INTO current_activity 
  FROM kid_activities 
  WHERE id = activity_uuid;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check if current activity has a location
  IF current_activity.location_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      l.id as location_id,
      l.name as location_name,
      l.address as location_address,
      current_activity.location_details as location_details,
      current_activity.activity_hierarchy_type as source_level
    FROM locations l
    WHERE l.id = current_activity.location_id;
    RETURN;
  END IF;
  
  -- If no location at current level, check parent
  IF current_activity.parent_activity_id IS NOT NULL THEN
    SELECT * INTO parent_activity 
    FROM kid_activities 
    WHERE id = current_activity.parent_activity_id;
    
    IF FOUND AND parent_activity.location_id IS NOT NULL THEN
      RETURN QUERY
      SELECT 
        l.id as location_id,
        l.name as location_name,
        l.address as location_address,
        parent_activity.location_details as location_details,
        parent_activity.activity_hierarchy_type as source_level
      FROM locations l
      WHERE l.id = parent_activity.location_id;
      RETURN;
    END IF;
    
    -- If parent doesn't have location, check grandparent (recursive)
    IF parent_activity.parent_activity_id IS NOT NULL THEN
      RETURN QUERY
      SELECT * FROM get_effective_location(parent_activity.parent_activity_id);
      RETURN;
    END IF;
  END IF;
  
  -- No location found in hierarchy
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION get_effective_location(UUID) IS 'Gets the effective location for an activity by cascading up the hierarchy (self -> parent -> grandparent, etc.)'; 