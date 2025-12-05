# Adult Activities Guide

> **See also:** [DEVELOPING.md](./DEVELOPING.md) for general development setup and [PROJECT_REQUIREMENTS.md](./PROJECT_REQUIREMENTS.md) for system architecture.

This guide explains how to add adult activities to the Der Town "Things to Do" page.

## Current Implementation

The "Things to Do" page currently combines:

1. **Kid Activities** - From the `kid_activities` database table
2. **Adult Activities** - Hardcoded in `src/pages/things-to-do.astro`

## Adding Adult Activities

### Option 1: Add to Database (Recommended)

The `kid_activities` table can handle adult activities by setting appropriate age ranges:

```sql
INSERT INTO kid_activities (
    name,
    description,
    activity_type,
    participation_type,
    min_age,
    max_age,
    cost,
    website,
    is_ongoing,
    is_fall,
    is_winter,
    is_spring,
    is_summer,
    status,
    active
) VALUES (
    'Recreational Softball League',
    'Co-ed recreational softball league for adults. Games played on weekday evenings.',
    'Sports',
    'Recreational',
    18,
    NULL,
    '$50 per season',
    'mailto:dertownleavenworth@gmail.com',
    true,
    false,
    false,
    true,
    true,
    'approved',
    true
);
```

### Option 2: Add to Hardcoded List

For quick additions, you can add activities to the `adultActivities` array in `src/pages/things-to-do.astro`:

```typescript
const adultActivities = [
  // ... existing activities ...
  {
    id: 'adult-new-activity-1',
    name: 'New Adult Activity',
    description: 'Description of the new activity.',
    activity_type: 'Sports', // or 'Arts', 'Community', etc.
    participation_type: 'Recreational', // or 'Competitive', etc.
    min_age: 18,
    max_age: null,
    cost: 'Free', // or '$XX', 'Sliding scale', etc.
    website: 'mailto:dertownleavenworth@gmail.com', // or actual URL
    sponsoring_organization: { name: 'Organization Name', website: null },
    location: { name: 'Location Name', address: 'Address' },
    is_ongoing: true, // or false
    is_fall: false, // or true
    is_winter: false, // or true
    is_spring: true, // or false
    is_summer: true, // or false
    children: [],
    is_adult: true
  }
];
```

## Activity Types

Supported activity types:

- `Sports` - General sports activities
- `Gymnastics` - Gymnastics and tumbling
- `Martial Arts` - Martial arts and self-defense
- `Climbing` - Rock climbing and bouldering
- `Cycling` - Biking and cycling activities
- `Winter Sports` - Skiing, snowboarding, etc.
- `Aquatics` - Swimming and water activities
- `Arts` - Visual arts and crafts
- `Music` - Music lessons and performances
- `Dance` - Dance classes and performances
- `Theater` - Theater and drama
- `Scouting` - Scouting organizations
- `Social` - Social and community groups
- `Academic` - Educational activities

## Participation Types

Supported participation types:

- `Recreational` - Casual, non-competitive
- `Competitive` - Competitive leagues and teams
- `Tryouts Required` - Requires tryouts or auditions
- `Audition Required` - Requires auditions
- `Drop-in` - Drop-in participation allowed

## Age Ranges

- `min_age: 18, max_age: null` - Adults only (18+)
- `min_age: 16, max_age: null` - Teens and adults (16+)
- `min_age: null, max_age: null` - All ages

## Seasons

Set the appropriate boolean fields:

- `is_ongoing` - Year-round activities
- `is_fall` - Fall activities (September-November)
- `is_winter` - Winter activities (December-February)
- `is_spring` - Spring activities (March-May)
- `is_summer` - Summer activities (June-August)

## Future Enhancements

1. **Separate Adult Activities Table** - Create a dedicated `adult_activities` table
2. **Admin Interface** - Add adult activities management to the admin panel
3. **Activity Submission Form** - Allow public submission of adult activities
4. **Advanced Filtering** - Add filters for skill level, cost, location, etc.
5. **Calendar Integration** - Link adult activities to the calendar system

## Examples

### Recreational Softball League

```typescript
{
  id: 'adult-softball-1',
  name: 'Recreational Softball League',
  description: 'Co-ed recreational softball league for adults. Games played on weekday evenings.',
  activity_type: 'Sports',
  participation_type: 'Recreational',
  min_age: 18,
  max_age: null,
  cost: '$50 per season',
  website: 'mailto:dertownleavenworth@gmail.com',
  sponsoring_organization: { name: 'Der Town Recreation', website: null },
  location: { name: 'Enchantment Park', address: 'Leavenworth, WA' },
  is_ongoing: true,
  is_fall: false,
  is_winter: false,
  is_spring: true,
  is_summer: true,
  children: [],
  is_adult: true
}
```

### Pickup Soccer

```typescript
{
  id: 'adult-soccer-1',
  name: 'Pickup Soccer',
  description: 'Casual pickup soccer games for adults. All skill levels welcome.',
  activity_type: 'Sports',
  participation_type: 'Recreational',
  min_age: 18,
  max_age: null,
  cost: 'Free',
  website: 'mailto:dertownleavenworth@gmail.com',
  sponsoring_organization: { name: 'Der Town Recreation', website: null },
  location: { name: 'Enchantment Park', address: 'Leavenworth, WA' },
  is_ongoing: true,
  is_fall: true,
  is_winter: false,
  is_spring: true,
  is_summer: true,
  children: [],
  is_adult: true
}
```
