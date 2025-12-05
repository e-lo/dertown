# 📘 Project Requirements & System Design for Der Town

## 1. 🎯 Purpose

A lightweight, mobile-responsive, modern web application for community events and announcements, optimized for small towns. Built for fast, accessible, and low-maintenance operation, with a focus on admin review, public submissions, and calendar integration.

---

## 2. ✅ Core Features

### Events & Announcements
- Public-facing event and announcement calendar (carousel, list, and calendar views)
- Event detail pages with calendar download (Google, Outlook, iCal)
- Filterable event list (by category, date, organization, location)
- Subscribable RSS and iCal feeds (all events or by tag)
- Admin panel for reviewing/approving staged events/announcements
- Public submission forms (with hybrid dropdowns, spam protection, and admin review)
- Event edit suggestions via email (Resend API)

### Activities & Programs
- "Things to Do" page with kid activities and adult activities
- Kid activities with hierarchical structure (PROGRAM → SESSION → CLASS_TYPE → CLASS_INSTANCE)
- Activity calendar with recurring events, exceptions, and closures
- Activity filtering by age, season, activity type, and day of week
- Calendar export for activities (iCalendar format)

### Technical
- Responsive, accessible layout
- Fast page loads (static-first delivery)
- Field-level security for private data (emails, comments)
- Automated calendar sync (feed-based, real-time updates)

---

## 3. 🛠️ Tech Stack

| Layer         | Tool/Service         | Notes                                 |
| -------------|----------------------|---------------------------------------|
| Frontend     | Astro, Tailwind CSS  | Static-first, custom UI components    |
| Calendar UI  | FullCalendar.js      | Dynamic calendar rendering            |
| Backend      | Supabase             | PostgreSQL, Auth, Storage, RLS        |
| Auth         | Supabase Auth        | Email/password login, RLS roles       |
| APIs         | Astro serverless     | RESTful endpoints                     |
| Python Jobs  | Python + Pydantic    | Data import, validation, admin tasks  |
| Hosting      | Netlify/Vercel       | Static + serverless                   |
| Automation   | GitHub Actions       | Scheduled jobs, health checks         |

---

## 4. ⚙️ System Architecture

```
User ↔️ Astro Frontend ↔️ Astro API Routes ↔️ Supabase (DB, Auth, Storage)
         ↑
   Python Scripts (import, validate, seed, backup)
         ↑
   GitHub Actions (scheduled jobs)
```

---

## 5. 🗃️ Database Schema (Supabase)

- See Supabase migrations for canonical schema (`supabase/migrations/`)
- **Core tables:** `events`, `announcements`, `locations`, `organizations`, `tags`
- **Staging tables:** `events_staged`, `announcements_staged` (for public submissions)
- **Activities tables:** `kid_activities` (hierarchical: PROGRAM/SESSION/CLASS_TYPE/CLASS_INSTANCE)
- **Calendar tables:** `activity_events`, `recurrence_patterns`, `event_exceptions`, `calendar_exceptions`
- **Security:** Field-level security via public views for public data, base tables for admin
- **RLS policies:** Enforced for all sensitive operations

> **Detailed Schema Notes:** For comprehensive kid activities calendar schema design and implementation history, see [KID_ACTIVITY_CALENDAR_EVENTS.md](./KID_ACTIVITY_CALENDAR_EVENTS.md)

---

## 6. 🔄 Calendar Synchronization

- All calendar platforms (iCal, Google, Outlook) use feed-based subscriptions (`/api/calendar/ical`)
- Feeds are always up-to-date; calendar apps poll every 2-6 hours
- Tag-based feeds supported via query params (e.g., `/api/calendar/ical?tag=Arts+Culture`)
- iCal feed is RFC 5545 compliant, supports filtering, and returns proper MIME type
- No caching: feeds are generated on-demand for real-time updates
- See code for technical details

---

## 7. 🧩 UI Component System

- Hybrid system: custom Astro components + Tailwind utilities
- Core UI: `Badge.astro`, `Button.astro`, `Input.astro`, `Select.astro`, `FormField.astro`
- Utilities: `date-utils.ts`, `components.css`
- No full UI library (e.g., daisyUI) to avoid bloat/conflicts
- See DEVELOPING.md for implementation notes

---

## 8. 🔒 Security & Privacy

- Supabase RLS policies for all sensitive tables
- Field-level security: public views for public data, base tables for admin
- Private fields (emails, comments) only visible to authenticated admins
- Spam protection: honeypot fields and rate limiting on forms
- All admin actions require Supabase Auth

---

## 9. 🛠️ Implementation Record

### ✅ Completed Features

- All core events and announcements features are implemented
- Calendar sync is feed-based and real-time
- Hybrid UI system is in place (no full UI library)
- Field-level security and RLS are enforced
- Spam protection is active on all public forms
- Admin panel supports review/approval of staged submissions
- Python scripts and Makefile support all major admin/data tasks
- Kid activities database schema with hierarchical structure
- Activity calendar system with recurring events and exceptions
- Activity filtering and calendar export functionality
- Email notifications via Resend API for event edit suggestions

### 🔄 Partially Complete

- Kid activities frontend calendar display (needs integration with new event structure)
- Admin interface for calendar exception management (basic structure in place)

### 📝 Key Design Decisions

- **Calendar Sync:** Feed-based subscriptions rather than push notifications (simpler, more reliable)
- **UI Components:** Custom components over full UI library (reduces bundle size, avoids conflicts)
- **Activity Hierarchy:** Self-referencing `kid_activities` table supports flexible PROGRAM/SESSION/CLASS_TYPE/CLASS_INSTANCE structure
- **Exception Handling:** Separate `calendar_exceptions` (gym-wide closures) and `event_exceptions` (specific event cancellations)

---

## 10. 📝 Future Features & Enhancements

### High Priority

1. **Bulk edits in admin interface** - Edit all events in a series or with shared parent event, bulk status updates, etc.
2. **Improved landing page UX** - Increase discoverability of calendar subscription features (iCal feeds, calendar downloads)
3. **Improve calendar view UX/look/feel** - Enhanced calendar display, better visual design, improved interactions
4. **Improve event searchability** - Better search functionality on `/events` page (full-text search, filters, sorting)
5. **Email subscription system** (Big Project) - Add email subscription features with:
   - User-selectable email frequency (daily, weekly, monthly digests)
   - Category/tag-based subscriptions
   - Email content backend for generating newsletters
   - Email sending service integration (Resend or similar)
   - Subscription management interface

### Medium Priority

6. **Token refresh for authentication** - Automatic token refresh to prevent 1-hour logout
7. **Admin calendar exception management UI** - Complete interface for managing closures and exceptions
8. **Automated duplicate detection** - Detect and suggest merging duplicate events/orgs/locations
9. **Advanced data validation** - Enhanced validation for CSV/ICS imports with better error reporting
10. **More granular admin roles** - Event moderator, announcement editor, activity manager roles
11. **Better analytics and monitoring** - Enhanced tracking beyond Google Analytics
12. **User-facing notifications** - Email/SMS notifications for event changes, new activities
13. **Mobile-first UI polish** - Enhanced mobile experience and responsive design improvements
14. **Separate adult activities table** - Move from hardcoded list to database table

### Low Priority / Nice to Have

15. **Complete kid activities calendar frontend** - Integrate new `activity_events` structure into calendar display
16. **Activity submission form** - Public form for submitting new kid/adult activities
17. **More robust test coverage** - Unit and integration tests for critical paths
18. **Public API** - RESTful API for event/announcement data (for integrations)
19. **Calendar integrations** - Eventbrite, Facebook Events, or other calendar platform sync
20. **Advanced content moderation** - AI-powered spam detection, auto-flagging
21. **Activity waitlist management** - UI for managing activity waitlists
22. **Activity registration system** - Built-in registration handling for activities
23. **Multi-language support** - Internationalization for multiple languages
24. **Advanced search** - Full-text search across events, announcements, and activities
25. **User accounts** - Public user accounts for favorites, personalized calendars

---

## 11. 📚 Reference

- [README.md](./README.md): Project overview and quickstart
- [DEVELOPING.md](./DEVELOPING.md): Developer/admin workflow, Makefile/Python usage, troubleshooting
- Supabase, Astro, Tailwind, and FullCalendar documentation
