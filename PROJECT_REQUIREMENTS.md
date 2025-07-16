# 📘 Project Requirements & System Design for Der Town

## 1. 🎯 Purpose

A lightweight, modern web application for community events and announcements, optimized for small towns. Built for fast, accessible, and low-maintenance operation, with a focus on admin review, public submissions, and calendar integration.

---

## 2. ✅ Core Features

- Public-facing event and announcement calendar (carousel, list, and calendar views)
- Event detail pages with calendar download (Google, Outlook, iCal)
- Filterable event list (by category, date, organization, location)
- Subscribable RSS and iCal feeds (all events or by tag)
- Responsive, accessible layout
- Fast page loads (static-first delivery)
- Admin panel for reviewing/approving staged events/announcements
- Public submission forms (with hybrid dropdowns, spam protection, and admin review)
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

- See Supabase migrations for canonical schema
- Key tables: `events`, `announcements`, `locations`, `organizations`, `tags`, `events_staged`, `announcements_staged`
- Field-level security: public views for public data, base tables for admin
- RLS policies: enforced for all sensitive operations

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

- All core features above are implemented as described
- Calendar sync is feed-based and real-time
- Hybrid UI system is in place (no full UI library)
- Field-level security and RLS are enforced
- Spam protection is active on all public forms
- Admin panel supports review/approval of staged submissions
- Python scripts and Makefile support all major admin/data tasks

---

## 10. 📝 Outstanding Phases & Future Enhancements (Prioritized)

1. **Automated duplicate detection** for event/org/location submissions
2. **Advanced data validation** for CSV/ICS imports
3. **More granular admin roles** (e.g., event moderator, announcement editor)
4. **Better analytics and monitoring** (beyond Google Analytics)
5. **User-facing notifications** (email/SMS for event changes)
6. **Mobile-first UI polish**
7. **More robust test coverage** (unit/integration)
8. **Optional: Public API for event/announcement data**
9. **Optional: Eventbrite or other calendar sync integrations**
10. **Optional: Advanced content moderation tools**

---

## 11. 📚 Reference

- [README.md](./README.md): Project overview and quickstart
- [DEVELOPING.md](./DEVELOPING.md): Developer/admin workflow, Makefile/Python usage, troubleshooting
- Supabase, Astro, Tailwind, and FullCalendar documentation
