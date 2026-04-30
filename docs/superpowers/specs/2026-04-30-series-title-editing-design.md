# Design: Add Title Editing to Series Edit Modal

**Date:** 2026-04-30  
**Feature:** Allow editing event titles when bulk-updating event series  
**Scope:** Admin series management modal

## Overview

Users currently cannot edit event titles when using the "Edit Series" modal to bulk-update multiple events in a series. This design adds title field support and filters the event list to show only future events by default.

## Requirements

- Add a title input field to the series edit form
- Title field applies to all selected events
- Event checkbox list shows only future events by default
- Title must be tracked for change detection (only submit if changed)

## Use Cases

1. **Bulk title fix:** Change "Farmer's Market Dates" to "Farmer's Market" for all upcoming instances
2. **Special event marker:** Edit specific future events to "Farmer's Market - with kids market!" when needed

## Implementation Details

### 1. Event List Filtering

**File:** `/src/pages/admin/series.astro` (line 320–329)

In the event checkbox list building loop, filter to show only future events:

```javascript
series.children
  .filter(event => event.start_date >= new Date().toISOString().split('T')[0])
  .forEach(event => { ... })
```

Mark past events as "Past" for clarity; exclude them from the list entirely.

### 2. Title Field Addition

**File:** `/src/pages/admin/series.astro` (line 355–442)

Insert a title input field as the first form field, immediately after the event selection list and before description:

```html
<div class="form-field">
  <label class="form-label">Title:</label>
  <input type="text" id="editSeriesTitle" class="form-input-base" value="${commonValues.title || ''}">
</div>
```

Where `commonValues.title` is extracted from the first event (line 335):

```javascript
const commonValues = {
  title: firstEvent.title || '',
  description: firstEvent.description || '',
  ...
};
```

### 3. Form State Tracking

**File:** `/src/pages/admin/series.astro` (line 475–492)

Add title to `originalFormValues`:

```javascript
originalFormValues = {
  title: commonValues.title || '',
  description: commonValues.description || '',
  ...
};
```

### 4. Form Submission

**File:** `/src/pages/admin/series.astro` (line 700–750)

Add title change detection and inclusion:

```javascript
const currentTitle = document.getElementById('editSeriesTitle').value;

if (hasChanged('title', currentTitle, originalFormValues.title)) {
  updateData.title = currentTitle.trim() || null;
}
```

## Data Flow

1. User opens "Edit Series" modal
2. Event list populates with only future events
3. Form fields populate with values from first event (including title)
4. User modifies title field and/or other fields
5. On submit, only changed fields are included in the request
6. API bulk-updates selected events with new title (and any other changed fields)

## API Contract

The existing `/api/admin/events/bulk-update` endpoint already supports title updates. No API changes needed.

**Request payload addition:**
```json
{
  "event_ids": ["id1", "id2"],
  "title": "New Title"
}
```

## Testing Checklist

- [ ] Open edit series modal for a series with both past and future events
- [ ] Verify only future events appear in the checkbox list
- [ ] Edit title field and submit; verify all selected events receive new title
- [ ] Edit title AND another field; verify both are sent to API
- [ ] Leave title unchanged; verify it's not included in the request (change detection works)
- [ ] Edit title for one event instance using "Select All" then uncheck past events

## Future Considerations

- Per-event title customization (override titles for specific instances)
- Bulk edit for other event fields (currently supported; just documenting)
