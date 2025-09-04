# Data Model Refactoring Plan

## Current State Analysis

### Existing Tables

1. **`events`** - One-time community events (concerts, festivals, etc.)
2. **`kid_activities`** - Recurring activities (originally for kids, now used for all ages)
3. **`activity_events`** - Calendar events for activities (recurring and one-off)
4. **`recurrence_patterns`** - Recurrence rules for activity events
5. **`event_exceptions`** - Exceptions to recurring events
6. **`calendar_exceptions`** - Holidays and closures

### Current Issues

1. **Naming confusion** - `kid_activities` table handles all ages, not just kids
2. **Mixed concerns** - Activities and events are separate concepts but related
3. **Inconsistent patterns** - Different approaches for recurring vs one-time events
4. **Limited flexibility** - Hard to extend for new activity types or features

## Proposed Refactoring

### Option 1: Rename and Extend (Recommended)

**Pros:**

- Minimal breaking changes
- Preserves existing data and relationships
- Gradual migration path
- Maintains backward compatibility

**Cons:**

- Still some naming confusion
- Doesn't fully address architectural concerns

### Option 2: Complete Restructure (Future Consideration)

**Pros:**

- Clean separation of concerns
- Better scalability
- More flexible architecture
- Clearer naming

**Cons:**

- Major breaking changes
- Complex migration
- Requires significant development time

## Recommended Approach: Option 1 (Rename and Extend)

### Phase 1: Immediate Changes (Low Risk)

#### 1.1 Rename Tables and Views

```sql
-- Rename kid_activities to activities
ALTER TABLE kid_activities RENAME TO activities;

-- Rename related indexes
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

-- Rename foreign key constraints
ALTER TABLE activities RENAME CONSTRAINT kid_activities_location_id_fkey TO activities_location_id_fkey;
ALTER TABLE activities RENAME CONSTRAINT kid_activities_parent_activity_id_fkey TO activities_parent_activity_id_fkey;

-- Rename the view
DROP VIEW IF EXISTS public_kid_activities;
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
    ka.waitlist_status
FROM activities ka
LEFT JOIN activities parent ON ka.parent_activity_id = parent.id
WHERE ka.active = true;
```

#### 1.2 Update RLS Policies

```sql
-- Update RLS policies
DROP POLICY IF EXISTS "Public can view approved kid activities" ON activities;
CREATE POLICY "Public can view approved activities" ON activities
    FOR SELECT USING (status = 'approved' AND active = TRUE);

DROP POLICY IF EXISTS "Admins have full access to kid activities" ON activities;
CREATE POLICY "Admins have full access to activities" ON activities
    FOR ALL USING (is_admin());
```

#### 1.3 Add New Fields for Better Activity Classification

```sql
-- Add audience field to distinguish between kids, adults, and all ages
ALTER TABLE activities ADD COLUMN audience TEXT CHECK (audience IN ('kids', 'adults', 'all_ages')) DEFAULT 'all_ages';

-- Add skill_level field for activities
ALTER TABLE activities ADD COLUMN skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'all_levels')) DEFAULT 'all_levels';

-- Add activity_category for better organization
ALTER TABLE activities ADD COLUMN activity_category TEXT CHECK (activity_category IN ('sports', 'arts', 'education', 'recreation', 'community', 'fitness', 'outdoor', 'indoor', 'other')) DEFAULT 'other';

-- Add indexes for new fields
CREATE INDEX idx_activities_audience ON activities(audience);
CREATE INDEX idx_activities_skill_level ON activities(skill_level);
CREATE INDEX idx_activities_category ON activities(activity_category);
```

### Phase 2: API and Code Updates

#### 2.1 Update TypeScript Types

```typescript
// Update src/types/database.ts
export interface Database {
  public: {
    Tables: {
      activities: {  // renamed from kid_activities
        Row: {
          // ... existing fields ...
          audience: 'kids' | 'adults' | 'all_ages' | null;
          skill_level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels' | null;
          activity_category: 'sports' | 'arts' | 'education' | 'recreation' | 'community' | 'fitness' | 'outdoor' | 'indoor' | 'other' | null;
        };
      };
      public_activities: {  // renamed from public_kid_activities
        Row: {
          // ... existing fields ...
          audience: 'kids' | 'adults' | 'all_ages' | null;
          skill_level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels' | null;
          activity_category: 'sports' | 'arts' | 'education' | 'recreation' | 'community' | 'fitness' | 'outdoor' | 'indoor' | 'other' | null;
        };
      };
    };
  };
}
```

#### 2.2 Update API Endpoints

```typescript
// Update src/pages/api/activities.ts
// Change from public_kid_activities to public_activities
const { data: activities } = await supabase
  .from('public_activities')  // renamed
  .select(`
    *,
    sponsoring_organization:organizations!sponsoring_organization_id(name, website),
    location:locations!location_id(name, address)
  `)
  .order('name');
```

#### 2.3 Update Frontend Components
```typescript
// Update all references from kid_activities to activities
// Update all references from public_kid_activities to public_activities
```

### Phase 3: Enhanced Features

#### 3.1 Add Activity Tags System
```sql
-- Create activity_tags table for flexible tagging
CREATE TABLE activity_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activity_tag_assignments junction table
CREATE TABLE activity_tag_assignments (
    activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES activity_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (activity_id, tag_id)
);

-- Add indexes
CREATE INDEX idx_activity_tag_assignments_activity_id ON activity_tag_assignments(activity_id);
CREATE INDEX idx_activity_tag_assignments_tag_id ON activity_tag_assignments(tag_id);
```

#### 3.2 Add Activity Reviews/Ratings
```sql
-- Create activity_reviews table
CREATE TABLE activity_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    reviewer_name TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_activity_reviews_activity_id ON activity_reviews(activity_id);
CREATE INDEX idx_activity_reviews_status ON activity_reviews(status);
```

#### 3.3 Add Activity Images

```sql
-- Add image support to activities
ALTER TABLE activities ADD COLUMN image_id UUID;
ALTER TABLE activities ADD COLUMN image_alt_text TEXT;

-- Add index
CREATE INDEX idx_activities_image_id ON activities(image_id);
```

## Migration Strategy

### Step 1: Create Migration Script

```sql
-- Create migration script: 20250101000000_rename_kid_activities_to_activities.sql
-- This will handle all the renaming and new field additions
```

### Step 2: Update Codebase
1. Update all TypeScript types
2. Update all API endpoints
3. Update all frontend components
4. Update all documentation

### Step 3: Test and Deploy
1. Test all functionality with new schema
2. Deploy migration
3. Monitor for any issues
4. Update any remaining references

## Benefits of This Approach

1. **Clearer Naming** - `activities` is more accurate than `kid_activities`
2. **Better Classification** - New fields for audience, skill level, and category
3. **Enhanced Features** - Tags, reviews, and images
4. **Backward Compatibility** - Existing data and relationships preserved
5. **Future-Proof** - Easier to extend for new features

## Future Considerations (Option 2)

If we want to do a complete restructure in the future, we could:

1. **Separate Concerns** - Split into `activities`, `activity_sessions`, `activity_events`
2. **Unified Event System** - Merge `events` and `activity_events` into a single system
3. **Better Hierarchy** - More flexible parent-child relationships
4. **Enhanced Metadata** - More sophisticated tagging and categorization

But for now, Option 1 provides the best balance of improvements with minimal risk. 