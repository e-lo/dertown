# Der Town Design System & Style Guide

Welcome to the living style guide for Der Town. This document outlines our design system, reusable components, and CSS variables for consistent, maintainable UI development.

---

## Components

### Navbar (`main-navbar`)

- **Purpose:** Site-wide navigation, brand, and calendar subscription links.
- **Usage:**
  - Use the `<Navbar />` component in your base template.
  - BEM classes: `main-navbar__brand`, `main-navbar__subscribe`, `main-navbar__link`, etc.
- **Notes:**
  - Uses Bootstrap for layout, custom BEM for branding and subscribe icons.

### Footer (`footer`)

- **Purpose:** Site-wide footer with legal and info links.
- **Usage:**
  - Use the `<Footer />` component at the bottom of your base template.
  - BEM classes: `footer`, `footer__link`.

### Event Card (`event-card`)

- **Purpose:** Display event summary in lists and carousels.
- **Usage:**
  - Use the `<EventCard />` component in event lists and carousels.
  - BEM classes: `event-card`, `event-card__title`, `event-card__date`, `event-card__tag`, etc.

### Event Carousel (`event-carousel`)

- **Purpose:** Horizontally scrollable list of event cards.
- **Usage:**
  - Use the `<EventCarousel />` component on the homepage or event category pages.
  - BEM classes: `event-carousel`, `event-carousel__item`, `event-carousel__control`, etc.

### Event List Card (`event-list-card`)

- **Purpose:** Vertical list of events with date, title, and tags.
- **Usage:**
  - Use the `<EventListCard />` component for event lists.
  - BEM classes: `event-list-card`, `event-list-card__date`, `event-list-card__tag`, etc.

### Announcement Marquee (`announcement-marquee`)

- **Purpose:** Highlight important announcements in a scrolling or static banner.
- **Usage:**
  - Use the `<AnnouncementMarquee />` component at the top of the homepage or event pages.
  - BEM classes: `announcement-marquee`, `announcement-marquee__track`, `announcement-marquee__item`, etc.

### Category Section (`category-section`)

- **Purpose:** Display event categories with icons and links.
- **Usage:**
  - Use the `<CategorySection />` component on the homepage or event pages.
  - BEM classes: `category-section`, `category-section__title`, `category-section__icon`, etc.

---

## Color Palette

These are the raw color variables used throughout the design system. Define your palette here, then map them to theme roles below.

| Variable           | Color   | Description                        |
| ------------------ | ------- | ---------------------------------- |
| `--dark-purple`    | #0f0326 | Brand dark background, headings    |
| `--blue-green`     | #219ebc | Brand primary, buttons, links      |
| `--gold`           | #ffd700 | Brand accent, featured, highlights |
| `--shamrock-green` | #4da167 | Success, positive, tags            |
| `--davys-gray`     | #575761 | Neutral, muted text                |
| `--indian-red`     | #DB5461 | Accent, error, callout             |
| `--pale-dogwood`   | #F5D0C5 | Soft background, tag, badge        |
| `--hunter-green`   | #355834 | Secondary, dark accent             |
| `--off-white`      | #f8f8f8 | Main background                    |

---

## Color Theme Mapping

These variables map the palette colors to theme roles for use throughout the UI. Update these to change how palette colors are applied.

| Theme Variable      | Mapped Palette Color | Description             |
| ------------------- | -------------------- | ----------------------- |
| `--primary`         | `--blue-green`       | Main primary color      |
| `--primary-light`   | #56c3e0              | Lighter blue-green      |
| `--primary-dark`    | #17607e              | Darker blue-green       |
| `--accent`          | `--indian-red`       | Main accent color       |
| `--bg-primary`      | `--off-white`        | Main background         |
| `--bg-secondary`    | #f1f5f9              | Card/section background |
| `--bg-tertiary`     | #f1f5f9              | Filter/soft background  |
| `--bg-medium`       | `--davys-gray`       | Medium background       |
| `--bg-dark`         | `--dark-purple`      | Dark background         |
| `--text-primary`    | `--dark-purple`      | Main text               |
| `--text-secondary`  | `--davys-gray`       | Subdued text            |
| `--text-tertiary`   | #94a3b8              | Muted text, headers     |
| `--text-dark`       | `--dark-purple`      | Nav, headings           |
| `--text-light`      | `--off-white`        | Body                    |
| `--text-medium`     | `--davys-gray`       | Body                    |
| `--text-title`      | `--dark-purple`      | Event header title      |
| `--text-subtitle`   | `--davys-gray`       | Event header subtitle   |
| `--event-featured`  | -                    | Featured event color    |
| `--event-today`     | -                    | Today event color       |
| `--event-now`       | -                    | Now event color         |
| `--event-festival`  | -                    | Festival event color    |
| `--event-community` | -                    | Community event color   |
| `--event-sports`    | -                    | Sports event color      |
| `--event-civic`     | -                    | Civic event color       |
| `--event-arts`      | -                    | Arts event color        |
| `--event-town`      | -                    | Town event color        |
| `--event-family`    | -                    | Family event color      |
| `--event-business`  | -                    | Business event color    |
| `--event-nature`    | -                    | Nature event color      |
| `--event-outdoors`  | -                    | Outdoors event color    |
| ...                 | ...                  | ...                     |

---

## CSS Variables (from `theme.css`)

All color, spacing, and font variables are defined in `dertown/static/css/theme.css` under the `:root` selector. Use these for consistent theming.

| Variable            | Description                       |
| ------------------- | --------------------------------- |
| `--event-featured`  | Featured event color              |
| `--event-today`     | Today event color                 |
| `--event-now`       | Now event color                   |
| `--event-festival`  | Festival event color              |
| `--event-community` | Community event color             |
| `--event-sports`    | Sports event color                |
| `--event-civic`     | Civic event color                 |
| `--event-arts`      | Arts event color                  |
| `--event-town`      | Town event color                  |
| `--event-family`    | Family event color                |
| `--event-business`  | Business event color              |
| `--event-nature`    | Nature event color                |
| `--event-outdoors`  | Outdoors event color              |
| ...                 | ... (see theme.css for full list) |

---

## Usage Guidelines

- **Always use BEM class names** for custom components.
- **Use Bootstrap utilities** for layout, spacing, and grid.
- **Reference CSS variables** for all colors, spacing, and fonts.
- **Componentize** new UI elements for reusability and maintainability.

---

_This style guide is a living document. Please update it as you add or change components and variables!_
