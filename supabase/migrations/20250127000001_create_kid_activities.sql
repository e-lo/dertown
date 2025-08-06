-- Create kid_activities table for recurring activities
CREATE TABLE kid_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Information
    name TEXT NOT NULL,
    description TEXT,
    sponsoring_organization_id UUID REFERENCES organizations(id),
    website TEXT,
    email TEXT,
    phone TEXT,
    
    -- Registration Information
    advance_registration_opens DATE,
    advance_registration_requirements TEXT,
    general_registration_opens DATE,
    registration_closes DATE,
    registration_link TEXT,
    registration_required BOOLEAN DEFAULT FALSE,
    
    -- Age and Grade Requirements
    min_age INTEGER,
    max_age INTEGER,
    min_grade TEXT, -- e.g., 'K', '1st', '2nd', etc.
    max_grade TEXT,
    
    -- Cost Information
    cost TEXT, -- e.g., '$150', 'Free', 'Sliding scale'
    cost_assistance_available BOOLEAN DEFAULT FALSE,
    cost_assistance_details TEXT,
    
    -- Schedule Information (iCal RRULE standard)
    start_datetime TIMESTAMP WITH TIME ZONE,
    end_datetime TIMESTAMP WITH TIME ZONE,
    rrule TEXT, -- iCal RRULE syntax, e.g., 'FREQ=WEEKLY;BYDAY=MO,WE,FR'
    commitment_level TEXT, -- e.g., 'One practice and one game per week', 'Daily practice', 'Monthly workshops'
    
    -- Location Information
    location_id UUID REFERENCES locations(id),
    location_details TEXT,
    
    -- Equipment and Gear
    required_gear TEXT,
    gear_assistance_available BOOLEAN DEFAULT FALSE,
    gear_assistance_details TEXT,
    
    -- Transportation
    transportation_provided BOOLEAN DEFAULT FALSE,
    transportation_details TEXT,
    transportation_assistance_available BOOLEAN DEFAULT FALSE,
    transportation_assistance_details TEXT,
    
    -- Additional Requirements
    additional_requirements TEXT,
    special_needs_accommodations BOOLEAN DEFAULT FALSE,
    special_needs_details TEXT,
    
    -- Capacity and Waitlist
    max_capacity INTEGER,
    waitlist_available BOOLEAN DEFAULT FALSE,
    
    -- Activity Type and Categories
    activity_type TEXT, -- e.g., 'Sports', 'Arts', 'STEM', 'Outdoor'
    participation_type TEXT, -- e.g., 'Recreational', 'Competitive', 'Tryouts Required', 'Audition Required'
    
    -- Parent-Child Relationships
    parent_activity_id UUID REFERENCES kid_activities(id),
    
    -- Status and Visibility
    status event_status DEFAULT 'pending',
    featured BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID, -- Could reference a users table if you add one
    notes TEXT,
    
    -- Constraints
    CONSTRAINT valid_age_range CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age),
    CONSTRAINT valid_datetime_range CHECK (start_datetime IS NULL OR end_datetime IS NULL OR start_datetime <= end_datetime)
);

-- Create indexes for better performance
CREATE INDEX idx_kid_activities_status ON kid_activities(status);
CREATE INDEX idx_kid_activities_active ON kid_activities(active);
CREATE INDEX idx_kid_activities_organization_id ON kid_activities(sponsoring_organization_id);
CREATE INDEX idx_kid_activities_location_id ON kid_activities(location_id);
CREATE INDEX idx_kid_activities_activity_type ON kid_activities(activity_type);
CREATE INDEX idx_kid_activities_start_datetime ON kid_activities(start_datetime);
CREATE INDEX idx_kid_activities_end_datetime ON kid_activities(end_datetime);
CREATE INDEX idx_kid_activities_featured ON kid_activities(featured);
CREATE INDEX idx_kid_activities_registration_opens ON kid_activities(advance_registration_opens, general_registration_opens);
CREATE INDEX idx_kid_activities_age_range ON kid_activities(min_age, max_age);
CREATE INDEX idx_kid_activities_participation_type ON kid_activities(participation_type);
CREATE INDEX idx_kid_activities_parent_id ON kid_activities(parent_activity_id);

-- Create trigger for updated_at
CREATE TRIGGER update_kid_activities_updated_at 
    BEFORE UPDATE ON kid_activities 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();



-- Create a public view for approved activities
CREATE VIEW public_kid_activities AS
SELECT 
    id,
    name,
    description,
    sponsoring_organization_id,
    website,
    email,
    phone,
    advance_registration_opens,
    advance_registration_requirements,
    general_registration_opens,
    registration_closes,
    registration_link,
    registration_required,
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

-- Add RLS policies for kid_activities
ALTER TABLE kid_activities ENABLE ROW LEVEL SECURITY;

-- Public read access to approved activities
CREATE POLICY "Public can view approved kid activities" ON kid_activities
    FOR SELECT USING (status = 'approved' AND active = TRUE);



-- Admin full access to kid_activities
CREATE POLICY "Admins have full access to kid activities" ON kid_activities
    FOR ALL USING (is_admin()); 