# UI Components

This directory contains reusable UI components that follow a consistent design system and reduce code duplication across the application.

## Design Philosophy

- **Consistent**: All components follow the same design patterns
- **Flexible**: Components accept props for customization
- **Accessible**: Built with accessibility in mind
- **Lightweight**: No external dependencies, pure Astro + Tailwind

## Components

### Badge

A versatile badge component for labels, tags, and status indicators.

```astro
---
import Badge from './ui/Badge.astro';
---

<!-- Basic usage -->
<Badge>Default</Badge>

<!-- Variants -->
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="info">Info</Badge>
<Badge variant="featured">Featured</Badge>
<Badge variant="today">Today</Badge>

<!-- Sizes -->
<Badge size="sm">Small</Badge>
<Badge size="md">Medium</Badge>
<Badge size="lg">Large</Badge>

<!-- Custom styling -->
<Badge variant="success" className="my-2">Custom</Badge>

<!-- Category variants -->
<Badge variant="arts-culture">Arts & Culture</Badge>
<Badge variant="family">Family</Badge>
<Badge variant="nature">Nature</Badge>
<Badge variant="town">Town</Badge>
```

**Props:**
- `variant`: 'default' | 'success' | 'warning' | 'info' | 'featured' | 'today' | 'arts-culture' | 'civic' | 'family' | 'nature' | 'outdoors' | 'school' | 'sports' | 'town'
- `size`: 'sm' | 'md' | 'lg'
- `className`: Additional CSS classes

**Category Variants:**
Use the `getCategoryBadgeVariant()` utility function for consistent category styling:
```astro
---
import { getCategoryBadgeVariant } from '../../lib/date-utils';
---
<Badge variant={getCategoryBadgeVariant('Arts+Culture')}>Arts & Culture</Badge>
```

### Button

A button component with consistent styling and variants.

```astro
---
import Button from './ui/Button.astro';
---

<!-- Basic usage -->
<Button>Click me</Button>

<!-- Variants -->
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>

<!-- Sizes -->
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

<!-- Types -->
<Button type="submit">Submit</Button>
<Button type="button" disabled>Disabled</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'outline' | 'ghost'
- `size`: 'sm' | 'md' | 'lg'
- `type`: 'button' | 'submit' | 'reset'
- `disabled`: boolean
- `className`: Additional CSS classes

### Input

A form input component with consistent styling.

```astro
---
import Input from './ui/Input.astro';
---

<!-- Basic usage -->
<Input name="email" type="email" placeholder="Enter email" />

<!-- With value -->
<Input name="title" value="Event Title" />

<!-- Required field -->
<Input name="title" required />

<!-- Disabled -->
<Input name="readonly" value="Read only" disabled />
```

**Props:**
- `type`: 'text' | 'email' | 'password' | 'url' | 'date' | 'time' | 'number' | 'tel'
- `name`: string (required)
- `id`: string (defaults to name)
- `value`: string
- `placeholder`: string
- `required`: boolean
- `disabled`: boolean
- `maxlength`: number
- `className`: Additional CSS classes

### Select

A select dropdown component with consistent styling.

```astro
---
import Select from './ui/Select.astro';
---

<Select name="category" required>
  <option value="">Select a category</option>
  <option value="arts">Arts & Culture</option>
  <option value="family">Family</option>
  <option value="nature">Nature</option>
</Select>
```

**Props:**
- `name`: string (required)
- `id`: string (defaults to name)
- `required`: boolean
- `disabled`: boolean
- `className`: Additional CSS classes

### FormField

A wrapper component that provides consistent label styling for form fields.

```astro
---
import FormField from './ui/FormField.astro';
import Input from './ui/Input.astro';
---

<FormField label="Event Title" required>
  <Input name="title" placeholder="Enter event title" />
</FormField>

<FormField label="Description">
  <textarea name="description" class="w-full px-3 py-2 border border-gray-300 rounded-md">
  </textarea>
</FormField>
```

**Props:**
- `label`: string (required)
- `required`: boolean
- `className`: Additional CSS classes

### TagFilter

A filter component for event categories with interactive pill buttons.

```astro
---
import TagFilter from '../TagFilter.astro';
---

<TagFilter 
  tags={[
    { id: '1', name: 'Arts+Culture' },
    { id: '2', name: 'Family' },
    { id: '3', name: 'Nature' }
  ]} 
  selectedTag="Arts+Culture"
  className="mb-4"
/>
```

**Props:**
- `tags`: Array of tag objects with `id` and `name` properties
- `selectedTag`: Currently selected tag (defaults to 'all')
- `showAllOption`: Whether to show "All Events" option (defaults to true)
- `allOptionText`: Text for the "all" option (defaults to 'All Events')
- `className`: Additional CSS classes

**Features:**
- Client-side filtering of event cards
- URL state management
- Category-specific colors using theme CSS classes
- Responsive design

## Usage Guidelines

### When to Use Components

- **Badge**: For status indicators, tags, categories, and small labels
- **Button**: For all interactive buttons (submit, cancel, actions)
- **Input**: For all text inputs, dates, times, emails, etc.
- **Select**: For dropdown selections
- **FormField**: When you need a labeled form field
- **TagFilter**: For filtering content by categories or tags

### When NOT to Use Components

- **Simple text**: Use regular HTML elements
- **Complex layouts**: Create custom components
- **One-off styling**: Use Tailwind classes directly

### Customization

All components accept a `className` prop for additional styling:

```astro
<Button variant="primary" className="w-full md:w-auto">
  Responsive Button
</Button>
```

### Accessibility

Components are built with accessibility in mind:
- Proper ARIA labels
- Focus management
- Keyboard navigation
- Screen reader support

## Future Enhancements

- **Modal**: For dialogs and overlays
- **Tooltip**: For hover information
- **Alert**: For success/error messages
- **Card**: For content containers
- **Navigation**: For menus and breadcrumbs

## Utility Functions

### Date Utilities (`src/lib/date-utils.ts`)

The project includes utility functions for common date/time operations:

```typescript
import { 
  formatEventDate, 
  formatTime, 
  isToday, 
  getEventUrl,
  transformEventForCalendar 
} from '../lib/date-utils';

// Format event dates consistently
const { month, day, dayOfWeek } = formatEventDate(event.start_date);

// Format time strings
const timeString = formatTime(event.start_time);

// Check if event is today
const isEventToday = isToday(event.start_date);

// Get event URL
const eventUrl = getEventUrl(event.id);

// Transform database events for FullCalendar
const calendarEvents = events.map(transformEventForCalendar);
```

These utilities help maintain consistency across components and reduce code duplication. 