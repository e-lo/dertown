# Kid Activity Calendar

# Kid Activity Calendar Customer UX

Parents should be able to find programs and their ongoing/upcoming sessions based on combinations:

1. specific programs that they know exist
2. activity type
3. filtered by age so they only see activities that are relevant for their child
4. filtered by month/season so they only see activities that are either ongoing or for the time period they are interested in
5. filtered by specific days of week in case they need to find something for their kid do on, e.g. wednesday aftnroons.

Filtered views of activities should have permalinks attached to them so they can bookmark or share.

When searching by program, I should see a list of upcoming sessions and relevant info about the class types and instances (e.g. days of week) available for them so that I don't have to drill down on each program to understand if the class for my kid fits with my schedule.

I should also be able to have a drill-down page with detail for a specific program.

# Kid Activity Calendar Data Schema

This schema supports **fixed‑term courses** (e.g., a school‑year gymnastics session) **and** **rolling‑enrollment programs** (e.g., open‐ended Jiu‑Jitsu). It also handles common holidays and one‑off overrides with *one* exceptions table.

---

## 1 Current Schema: `kid_activities` Table

Our current `kid_activities` table already supports the basic hierarchy concept:

```sql
CREATE TABLE kid_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Information
    name TEXT NOT NULL,
    description TEXT,
    sponsoring_organization_id UUID REFERENCES organizations(id),
    website TEXT,
    email TEXT,
    phone TEXT,
    
    -- Registration Information (Updated)
    registration_opens DATE, -- renamed from general_registration_opens
    registration_closes DATE,
    registration_link TEXT,
    registration_info TEXT, -- new field for general registration info
    registration_required BOOLEAN DEFAULT FALSE,
    
    -- Season Planning (New)
    is_fall BOOLEAN DEFAULT FALSE,
    is_winter BOOLEAN DEFAULT FALSE,
    is_spring BOOLEAN DEFAULT FALSE,
    is_summer BOOLEAN DEFAULT FALSE,
    is_ongoing BOOLEAN DEFAULT FALSE,
    season_start_month INTEGER CHECK (season_start_month >= 1 AND season_start_month <= 12),
    season_start_year INTEGER,
    season_end_month INTEGER CHECK (season_end_month >= 1 AND season_end_month <= 12),
    season_end_year INTEGER,
    
    -- Age and Grade Requirements
    min_age INTEGER,
    max_age INTEGER,
    min_grade TEXT,
    max_grade TEXT,
    
    -- Cost Information
    cost TEXT,
    cost_assistance_available BOOLEAN DEFAULT FALSE,
    cost_assistance_details TEXT,
    
    -- Schedule Information (iCal RRULE standard)
    start_datetime TIMESTAMP WITH TIME ZONE,
    end_datetime TIMESTAMP WITH TIME ZONE,
    rrule TEXT, -- iCal RRULE syntax, e.g., 'FREQ=WEEKLY;BYDAY=MO,WE,FR'
    commitment_level TEXT,
    
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
    waitlist_status TEXT CHECK (waitlist_status IN (NULL, 'FULL_WAITLIST_AVAILABLE', 'FULL')),
    
    -- Activity Type and Categories
    activity_type TEXT,
    participation_type TEXT,
    activity_hierarchy_type TEXT CHECK (activity_hierarchy_type IN ('PROGRAM','SESSION','CLASS_TYPE','CLASS_INSTANCE')),
    
    -- Parent-Child Relationships
    parent_activity_id UUID REFERENCES kid_activities(id),
    
    -- Status and Visibility
    status event_status DEFAULT 'pending',
    featured BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    notes TEXT
);
```

---

## 2 Enhanced Calendar Schema

### 2.1 Entity Relationship Diagram (Updated)

```
kid_activities (PK id) ⟶ parent_activity_id → kid_activities.id  (self‑referencing hierarchy)
│   ├── PROGRAM         (top‑level brand: "Apple Capital Gymnastics")
│   ├── SESSION         (optional date‑bounded term: "2025‑26 Recreational Session")
│   ├── CLASS_TYPE      (specific class type: "Apple Buds")
│   └── CLASS_INSTANCE  (specific time slot/team: "Monday 3-4pm Apple Buds", "Red Team")
│
├─< activity_events (PK event_id)        — recurring and one-off events
│      ├── recurrence_patterns (PK pattern_id) — recurring time patterns
│      └── event_exceptions (PK exception_id)  — event-specific cancellations
│
└─< calendar_exceptions (PK exception_id) — holidays / closures
        activity_id FK                    — applies to activity and all children
```

### 2.2 Additional Tables Needed

#### 2.2.1 `activity_events` ✅ IMPLEMENTED

| column                    | type                      | notes                                    |
| ------------------------- | ------------------------- | ---------------------------------------- |
| `event_id`                | `UUID` **PK**             | Using UUID to match kid_activities       |
| `activity_id`             | `UUID` FK→`kid_activities` | attach to any activity level |
| `event_type`              | `TEXT` CHECK (`'RECURRING'`, `'ONE_OFF'`) | type of event |
| `name`                    | `TEXT` NOT NULL           | e.g., "Weekly Practice", "Spring Recital" |
| `description`             | `TEXT`                    | optional description |
| `recurrence_pattern_id`   | `UUID` FK→`recurrence_patterns` | for recurring events |
| `start_datetime`          | `TIMESTAMP WITH TIME ZONE` | for one-off events |
| `end_datetime`            | `TIMESTAMP WITH TIME ZONE` | for one-off events |
| `waitlist_status`         | `TEXT` CHECK (`NULL`, `'FULL_WAITLIST_AVAILABLE'`, `'FULL'`) | waitlist status |
| `ignore_exceptions`       | `BOOLEAN` DEFAULT `FALSE` | whether to ignore parent exceptions |
| `created_at`              | `TIMESTAMP WITH TIME ZONE` | audit trail                              |
| `updated_at`              | `TIMESTAMP WITH TIME ZONE` | audit trail                              |

**Purpose**: Defines both recurring and one-off events for any activity level.

#### 2.2.2 `recurrence_patterns` ✅ IMPLEMENTED

| column                    | type                      | notes                                    |
| ------------------------- | ------------------------- | ---------------------------------------- |
| `pattern_id`              | `UUID` **PK**             | Using UUID to match kid_activities       |
| `start_time` / `end_time` | `TIME`                    | local clock times                        |
| `freq`                    | `TEXT` DEFAULT `'WEEKLY'` | leave flexible for future needs          |
| `interval`                | `INT` DEFAULT `1`         | e.g., bi‑weekly = 2                      |
| `weekdays`                | `TEXT[]`                  | array of weekdays: `['MO', 'WE', 'FR']` |
| `until`                   | `DATE` NULL               | if NULL fall back to `activity.end_date` |
| `created_at`              | `TIMESTAMP WITH TIME ZONE` | audit trail                              |
| `updated_at`              | `TIMESTAMP WITH TIME ZONE` | audit trail                              |

**Purpose**: Defines recurring patterns (e.g., "Every Monday and Wednesday 3-4pm") using array for weekdays.

#### 2.2.3 `event_exceptions` ✅ IMPLEMENTED

| column                    | type                      | notes                              |
| ------------------------- | ------------------------- | ---------------------------------- |
| `exception_id`            | `UUID` **PK**             | Using UUID to match kid_activities |
| `event_id`                | `UUID` FK→`activity_events` | specific event to cancel |
| `name`                    | `TEXT`                    | e.g., "Practice Cancelled" |
| `start_datetime`          | `TIMESTAMP WITH TIME ZONE` | when exception starts |
| `end_datetime`            | `TIMESTAMP WITH TIME ZONE` | when exception ends |
| `notes`                   | `TEXT`                    | admin comments |
| `created_at`              | `TIMESTAMP WITH TIME ZONE` | audit trail |

**Purpose**: Defines event-specific cancellations (e.g., "Monday practice cancelled due to weather").

#### 2.2.4 `calendar_exceptions` ✅ IMPLEMENTED

| column                    | type                      | notes                              |
| ------------------------- | ------------------------- | ---------------------------------- |
| `exception_id`            | `UUID` **PK**             | Using UUID to match kid_activities |
| `name`                    | `TEXT`                    | e.g., **Spring Break**             |
| `activity_id`             | `UUID` FK→`kid_activities` | scope anchor; applies to this activity and all children |
| `start_date` / `end_date` | `DATE`                    | inclusive range                    |
| `start_time` / `end_time` | `TIME` NULL               | NULL ⇒ full‑day closure            |
| `notes`                   | `TEXT`                    | admin comments                     |
| `created_at`              | `TIMESTAMP WITH TIME ZONE` | audit trail                        |
| `updated_at`              | `TIMESTAMP WITH TIME ZONE` | audit trail                        |

> **Constraint:** `activity_id IS NOT NULL` - exceptions always apply to a specific activity and cascade to all child activities.

**Purpose**: Defines closures, holidays, or modifications that apply to an activity and all its child activities (e.g., "Gym closed for Spring Break" applied to PROGRAM level cascades to all sessions, classes, and instances).

---

## 2.3 How Components Work Together

### **Hierarchy Structure:**

```
PROGRAM (Apple Capital Gymnastics)
├── SESSION (2025-26 School Year) - Optional, for date-bounded terms
│   ├── CLASS_TYPE (Apple Buds) - Specific class type
│   │   ├── CLASS_INSTANCE (Monday 3-4pm Apple Buds) - Specific time slot
│   │   ├── CLASS_INSTANCE (Tuesday 3-4pm Apple Buds) - Another time slot
│   │   └── CLASS_INSTANCE (Wednesday 3-4pm Apple Buds) - Another time slot
│   └── CLASS_TYPE (U10 Boys Soccer)
│       ├── CLASS_INSTANCE (Red Team)
│       └── CLASS_INSTANCE (Blue Team)
└── CLASS_TYPE (Ongoing Jiu-Jitsu) - For ongoing programs
    └── CLASS_INSTANCE (Wednesday 4-5pm Jiu-Jitsu)
```

### **Calendar Components:**

1. **Activity Events** (`activity_events` + `recurrence_patterns`):
   - **Purpose**: Define both recurring and one-off events (e.g., "Weekly Practice", "Spring Recital")
   - **Can be attached to**: Any activity level (PROGRAM, SESSION, CLASS_TYPE, CLASS_INSTANCE)
   - **Use case**: For activities that have scheduled events

2. **CLASS_INSTANCE** (`kid_activities` with `activity_hierarchy_type = 'CLASS_INSTANCE'`):
   - **Purpose**: Define specific time slots or teams with waitlist status
   - **Waitlist Status**: NULL (not at capacity), FULL_WAITLIST_AVAILABLE, FULL
   - **Use case**: "Monday 3-4pm Apple Buds" with waitlist available

3. **Calendar Exceptions** (`calendar_exceptions`):
   - **Purpose**: Define closures, holidays, or modifications
   - **Scope**: Applies to the activity and ALL its child activities
   - **Use case**: "Gym closed for Spring Break" applied to PROGRAM level affects everything

4. **Event Exceptions** (`event_exceptions`):
   - **Purpose**: Define event-specific cancellations
   - **Scope**: Applies to specific events only
   - **Use case**: "Monday practice cancelled due to weather"

### **Data Entry Workflow:**

1. Create PROGRAM (e.g., "Apple Capital Gymnastics")
2. Optionally create SESSION (e.g., "2025-26 School Year")
3. Create CLASS_TYPE (e.g., "Apple Buds") with CLASS_INSTANCE(s) (e.g., "Monday 3-4pm", "Tuesday 3-4pm")
4. Add events to CLASS_INSTANCE (e.g., "Weekly Practice" recurring event)
5. Add one-off events (e.g., "Spring Recital")
6. ✅ COMPLETED: Add calendar exceptions to PROGRAM level for gym-wide closures

---

## 3 Implementation Plan

### Phase 1: Database Schema Migration ✅ COMPLETE

#### 3.1 Add Activity Type Field ✅ COMPLETE

```sql
-- Add type field to kid_activities to support hierarchy
ALTER TABLE kid_activities ADD COLUMN activity_hierarchy_type TEXT 
  CHECK (activity_hierarchy_type IN ('PROGRAM','SESSION','CLASS_TYPE','CLASS_INSTANCE'));

-- Set default values based on existing data
UPDATE kid_activities SET activity_hierarchy_type = 'PROGRAM' WHERE parent_activity_id IS NULL;
UPDATE kid_activities SET activity_hierarchy_type = 'SESSION' WHERE parent_activity_id IS NOT NULL;
```

#### 3.2 Create Calendar Tables ✅ COMPLETE

```sql
-- Create recurrence_patterns table
CREATE TABLE recurrence_patterns (
    pattern_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    freq TEXT DEFAULT 'WEEKLY',
    interval INTEGER DEFAULT 1,
    weekdays TEXT[] NOT NULL CHECK (array_length(weekdays, 1) > 0),
    until DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activity_events table
CREATE TABLE activity_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES kid_activities(id) ON DELETE CASCADE,
    event_type TEXT CHECK (event_type IN ('RECURRING', 'ONE_OFF')),
    name TEXT NOT NULL,
    description TEXT,
    recurrence_pattern_id UUID REFERENCES recurrence_patterns(pattern_id),
    start_datetime TIMESTAMP WITH TIME ZONE,
    end_datetime TIMESTAMP WITH TIME ZONE,
    waitlist_status TEXT CHECK (waitlist_status IN (NULL, 'FULL_WAITLIST_AVAILABLE', 'FULL')),
    ignore_exceptions BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CHECK (
        (event_type = 'RECURRING' AND recurrence_pattern_id IS NOT NULL AND start_datetime IS NULL AND end_datetime IS NULL) OR
        (event_type = 'ONE_OFF' AND recurrence_pattern_id IS NULL AND start_datetime IS NOT NULL AND end_datetime IS NOT NULL)
    )
);

-- Create event_exceptions table
CREATE TABLE event_exceptions (
    exception_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES activity_events(event_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create calendar_exceptions table
CREATE TABLE calendar_exceptions (
    exception_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    activity_id UUID REFERENCES kid_activities(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3.3 Add Indexes and Constraints ✅ COMPLETE

```sql
-- Indexes for performance
CREATE INDEX idx_recurrence_patterns_until ON recurrence_patterns(until);
CREATE INDEX idx_activity_events_activity_id ON activity_events(activity_id);
CREATE INDEX idx_activity_events_type ON activity_events(event_type);
CREATE INDEX idx_activity_events_datetime ON activity_events(start_datetime, end_datetime);
CREATE INDEX idx_event_exceptions_event_id ON event_exceptions(event_id);
CREATE INDEX idx_event_exceptions_datetime ON event_exceptions(start_datetime, end_datetime);
CREATE INDEX idx_calendar_exceptions_activity_id ON calendar_exceptions(activity_id);
CREATE INDEX idx_calendar_exceptions_dates ON calendar_exceptions(start_date, end_date);
CREATE INDEX idx_kid_activities_waitlist_status ON kid_activities(waitlist_status);

-- Triggers for updated_at
CREATE TRIGGER update_recurrence_patterns_updated_at 
    BEFORE UPDATE ON recurrence_patterns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activity_events_updated_at 
    BEFORE UPDATE ON activity_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_exceptions_updated_at 
    BEFORE UPDATE ON calendar_exceptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Phase 2: Data Migration ✅ COMPLETE

#### 3.4 Migrate Existing RRULE Data ✅ COMPLETE

```sql
-- Parse existing rrule data and create meeting_pattern records
-- This will require a custom migration script to parse RRULE strings
-- and extract frequency, interval, and weekday information
```

**Status**: Migration script `scripts/migrate_existing_calendar_data.py` has been created and executed.

#### 3.5 Create Helper Functions ✅ COMPLETE

```sql
-- Function to get all ancestor activities for exception cascading
CREATE OR REPLACE FUNCTION get_activity_ancestors(activity_uuid UUID)
RETURNS TABLE(ancestor_id UUID) AS $$
WITH RECURSIVE ancestors AS (
    SELECT id, parent_activity_id, 1 as level
    FROM kid_activities 
    WHERE id = activity_uuid
    
    UNION ALL
    
    SELECT ka.id, ka.parent_activity_id, a.level + 1
    FROM kid_activities ka
    JOIN ancestors a ON ka.id = a.parent_activity_id
    WHERE a.level < 10 -- Prevent infinite loops
)
SELECT id FROM ancestors;
$$ LANGUAGE SQL;

-- Function to get all exceptions for an activity (including ancestors)
CREATE OR REPLACE FUNCTION get_activity_exceptions(
    activity_uuid UUID,
    query_start_date DATE,
    query_end_date DATE
)
RETURNS TABLE(
    exception_id UUID,
    name TEXT,
    activity_id UUID,
    start_date DATE,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.exception_id,
        ce.name,
        ce.activity_id,
        ce.start_date,
        ce.end_date,
        ce.start_time,
        ce.end_time,
        ce.notes
    FROM calendar_exceptions ce
    WHERE ce.activity_id IN (
        SELECT ancestor_id FROM get_activity_ancestors(activity_uuid)
    )
    AND ce.start_date <= query_end_date 
    AND ce.end_date >= query_start_date;
END;
$$ LANGUAGE plpgsql;
```

### Phase 3: API and Frontend Updates 🔄 IN PROGRESS

#### 3.6 Update TypeScript Types ✅ COMPLETE

- ✅ Regenerated types to include new tables
- ✅ Updated existing interfaces to support new calendar functionality

#### 3.7 Create Calendar API Endpoints 🔄 PARTIALLY COMPLETE

```typescript
// ✅ COMPLETED: GET /api/kid-activities/:id/calendar-events - Get calendar events for an activity
// ✅ COMPLETED: GET /api/kid-activities/:id/meeting-patterns - Get meeting patterns for an activity
// ✅ COMPLETED: POST /api/kid-activities/:id/meeting-patterns - Create meeting pattern
// ✅ COMPLETED: PUT /api/kid-activities/:id/meeting-patterns/:patternId - Update meeting pattern
// ✅ COMPLETED: DELETE /api/kid-activities/:id/meeting-patterns/:patternId - Delete meeting pattern
// ✅ COMPLETED: POST /api/calendar-exceptions - Create calendar exception
// ✅ COMPLETED: GET /api/calendar-exceptions - List calendar exceptions
// ✅ COMPLETED: GET /api/admin/kid-activities/:id/activity-events - Admin endpoint for activity events
// ✅ COMPLETED: POST /api/admin/kid-activities/:id/activity-events - Admin endpoint for creating events
// ✅ COMPLETED: GET /api/admin/kid-activities/:id/calendar-export - Calendar export functionality
```

#### 3.8 Update Frontend Components 🔄 PARTIALLY COMPLETE

- ✅ COMPLETED: Modified activity forms to support meeting pattern creation
- ✅ COMPLETED: Added calendar exception management interface
- ✅ COMPLETED: Updated calendar display to show recurring events with exceptions
- ✅ COMPLETED: Refactored `src/pages/families/activities.astro` into modular components
- ✅ COMPLETED: Created `ActivityFilters.astro`, `ActivityCard.astro`, `ScheduleView.astro`, `ProgramView.astro`, `ViewToggle.astro`
- 🔄 TODO: Update calendar display to handle both recurring events and one-time exceptions
- 🔄 TODO: Add admin interface for calendar exception management

### Phase 4: Calendar Export ✅ COMPLETE

#### 3.9 iCalendar Export Functionality ✅ COMPLETE

```typescript
// ✅ COMPLETED: Function to generate iCalendar events from meeting patterns
// ✅ COMPLETED: API endpoint: GET /api/admin/kid-activities/:id/calendar-export
// ✅ COMPLETED: Handles both recurring events and exceptions
```

---

## 4 Current Implementation Status

### ✅ Completed Features

1. **Database Schema**: All calendar-related tables have been created and migrated
2. **TypeScript Types**: Updated to include all new tables and relationships
3. **API Endpoints**: Core calendar functionality endpoints are implemented
4. **Frontend Components**: Modular component architecture implemented
5. **Calendar Export**: iCalendar export functionality is working
6. **Data Migration**: Existing RRULE data has been migrated to new schema

### 🔄 In Progress

1. **Frontend Integration**: Calendar display needs to be updated to handle new event structure
2. **Admin Interface**: Calendar exception management UI needs to be completed
3. **Error Handling**: Some TypeScript errors need to be resolved

### ❌ Pending Tasks

1. **TypeScript Error Resolution**: 48 TypeScript errors across 13 files need to be addressed
2. **Frontend Calendar Display**: Update to use new `activity_events` and `recurrence_patterns` tables
3. **Admin Calendar Management**: Complete the admin interface for managing calendar exceptions
4. **Testing**: Comprehensive testing of calendar functionality
5. **Documentation**: API documentation and user guides

---

## 5 Conflicts and Anticipated Issues

### 5.1 Data Migration Challenges ✅ RESOLVED

- ✅ **RRULE Parsing**: Existing `rrule` field contains complex iCalendar strings that need to be parsed and converted to the new normalized format
- ✅ **Data Loss Risk**: Migration from single `rrule` field to multiple normalized tables could lose information if not handled carefully
- ✅ **Backward Compatibility**: Need to maintain support for existing `rrule` field during transition period

### 5.2 Schema Conflicts ✅ RESOLVED

- ✅ **UUID vs Integer**: Original document uses INTEGER PKs, but our schema uses UUIDs. This is actually better for distributed systems but requires consistent usage
- ✅ **Timezone Handling**: Current schema has `start_datetime`/`end_datetime` with timezone, but meeting patterns use local TIME. Need clear separation between planning (local time) and scheduling (timezone-aware)
- ✅ **Constraint Complexity**: The calendar exception constraint (`activity_id IS NOT NULL`) requires careful validation

### 5.3 Performance Considerations 🔄 IN PROGRESS

- ✅ **Recursive Queries**: Getting all ancestor activities for exception cascading requires recursive CTEs which can be expensive
- ✅ **Index Strategy**: Need composite indexes for date range queries on calendar exceptions
- 🔄 **Caching**: Calendar generation will be computationally expensive and should be cached

### 5.4 Business Logic Complexity 🔄 IN PROGRESS

- ✅ **Exception Precedence**: Need clear rules for when gym-wide vs activity-specific exceptions take precedence
- ✅ **Time Overlaps**: Handling partial time exceptions (e.g., class normally 3-5pm, but exception 4-5pm only)
- ✅ **Recurrence Patterns**: Supporting complex RRULE patterns beyond weekly recurrence

### 5.5 Frontend Integration 🔄 IN PROGRESS

- ✅ **Form Complexity**: Meeting pattern creation UI will be complex with weekday selection, time ranges, etc.
- 🔄 **Calendar Display**: Need to handle both recurring events and one-time exceptions in calendar views
- 🔄 **User Experience**: Managing calendar exceptions requires admin-level permissions and clear UI

---

## 6 Recommended Implementation Order

1. ✅ **Start with Phase 1** - Database schema changes
2. ✅ **Create data migration scripts** - Parse existing RRULE data
3. ✅ **Implement basic API endpoints** - CRUD for meeting patterns and exceptions
4. ✅ **Add calendar export functionality** - iCalendar generation
5. ✅ **Update frontend forms** - Meeting pattern creation UI
6. 🔄 **Add calendar display** - Show recurring events with exceptions
7. 🔄 **Implement caching** - Performance optimization
8. 🔄 **Add admin interface** - Calendar exception management

This approach allows for incremental implementation while maintaining backward compatibility with existing data.

---

## 7 TODO List

### High Priority

1. **Fix TypeScript Errors** 🔥
   - [ ] Resolve 48 TypeScript errors across 13 files
   - [ ] Update type definitions to match current schema
   - [ ] Fix type mismatches in API routes

2. **Update Frontend Calendar Display**
   - [ ] Update `ScheduleView.astro` to use new `activity_events` table
   - [ ] Update `ProgramView.astro` to show event information
   - [ ] Integrate calendar exceptions into display

3. **Complete Admin Interface**
   - [ ] Create admin interface for managing calendar exceptions
   - [ ] Add calendar exception creation/editing forms
   - [ ] Implement calendar exception deletion

### Medium Priority

4. **Performance Optimization**
   - [ ] Implement caching for calendar generation
   - [ ] Optimize database queries for calendar views
   - [ ] Add pagination for large calendar datasets

5. **Testing**
   - [ ] Write unit tests for calendar functionality
   - [ ] Write integration tests for API endpoints
   - [ ] Test calendar export functionality

6. **Documentation**
   - [ ] Create API documentation
   - [ ] Write user guides for calendar features
   - [ ] Document calendar exception management

### Low Priority

7. **Advanced Features**
   - [ ] Add calendar import functionality
   - [ ] Implement calendar sharing features
   - [ ] Add calendar notification system

8. **UI/UX Improvements**
   - [ ] Add calendar view options (month, week, day)
   - [ ] Implement drag-and-drop calendar editing
   - [ ] Add calendar search functionality

---

## 8 Technical Debt

1. **Legacy Code**: Some old `meeting_pattern` and `meeting_day` references still exist in codebase
2. **Type Safety**: Need to improve TypeScript types for calendar functionality
3. **Error Handling**: Need to add comprehensive error handling for calendar operations
4. **Testing**: Need to add tests for calendar functionality
5. **Documentation**: Need to document calendar API endpoints and usage

---

## 9 Notes

- The calendar schema has been successfully implemented and migrated
- Frontend components have been refactored into a modular architecture
- API endpoints are functional but need frontend integration
- TypeScript errors need to be resolved before production deployment
- Calendar export functionality is working and ready for use
