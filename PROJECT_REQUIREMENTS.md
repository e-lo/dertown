# 📘 Project Requirements & System Design for `Der Town`

## 1. 🛍️ Purpose

To create a lightweight, modern web application that displays events from a PostgreSQL database via a calendar interface. The system supports authenticated admin editing, scheduled data ingestion (e.g., `.ics` import), and file storage — with low cold-start latency and minimal hosting/maintenance costs.

Background:

A previous implementation of this site was implemented as a Django site which can be referenced when helpful within the `/reference` directory.  Do not implement anything that is in conflict with the design in this document.  Rather attempt to translate it if and when it makes sense – but not if it doesn't support the intent and plan as described in this document.

---

## 2. 🎯 Core Features

### ✅ Public-Facing Calendar Website

* Render events and community announcements on carousel of cards
* Render event details on their own, linkable pages, with related events in a series or similar organizations or locations with ability to download a google calendar, outlook calendar or ical calendar event for the event or 
* A scrollable list of events that is filterable by event category, date, organization, and location with permalink urls
* A calendar UX viewable by week, day or month and filterable by category, organization and location with permalink urls
* Subscribable RSS feed links for events for certain categories or all events regardless of categories
* Links to ical, outlook, and google calendar feeds to subscribe to certain categories or all events
* Responsive, accessible layout
* Fast page loads (static-first delivery)

### ✅ Admin Tools

* Supabase UI for manual editing (no-code CMS-like)
* Astro-powered private admin routes (optional)
* Admin-only API routes for:

  * Importing `.ics` files
  * Scraping pages for event data
  * Summarizing long content into previews
  * **Reviewing and promoting events from `events_staged` to `events`**

### ✅ Event Updates and Syncing

* Regular or triggered script that syncs events on supabase to google calendar
* GitHub Actions run Python scripts on a schedule to detect and import relevant events or updated event information from specific source websites
* Output is inserted into Supabase via API

### ✅ File & Image Upload

* Supabase Storage for hosting images or attachments
* Public and private buckets for different asset types

### ✅ Public Submission Form

* Astro-based web form for community event suggestions fuzzy automatching to existing organizations and locations or drop-downs - or the ability to add new ones if they don't exist yet
* Spam protected via honeypot/CAPTCHA
* Submissions inserted into DB via a dedicated `events_staged` table (not directly into `events`)
* Admins can review, edit, and publish (move to `events`)

---

## 3. 🔧 Tech Stack

| Layer             | Tool/Service            | Notes                                         |
| ----------------- | ----------------------- | --------------------------------------------- |
| **Frontend**      | Astro                   | Static-first, fast, minimal JS                |
| **Styling**       | Tailwind CSS            | Utility-first CSS, customized with themes     |
| **UI Components** | Shoelace                | Accessible Web Components for forms, modals   |
| **Calendar UI**   | FullCalendar.js         | Dynamic calendar rendering via API            |
| **Backend**       | Supabase                | PostgreSQL, Auth, Storage, RLS                |
| **Auth**          | Supabase Auth           | Email/password login, roles via RLS           |
| **APIs**          | Astro serverless routes | RESTful endpoints (import, summarize, scrape) |
| **Python Jobs**   | Python + Pydantic       | For wrangling `.ics` or scraping event data   |
| **Scheduler**     | GitHub Actions          | Serverless cron jobs                          |
| **Hosting**       | Vercel **or** Netlify   | Static + serverless, low cold-start time      |

---

## 4. ⚙️ System Architecture Overview

```text
                        +----------------------+
                        |    GitHub Actions    | <-- nightly .ics import
                        +----------+-----------+
                                   |
                           runs Python script
                                   |
                          parses, validates with
                            Pydantic and uploads
                                   |
                        +----------v-----------+
                        |     Supabase DB      | <-- stores events, orgs, locations
                        | + Storage (images)   |
                        | + Auth (admin users) |
                        +----------+-----------+
                                   ^
                                   |
    +-----------+         +-------+--------+         +---------------+
    |  Web App  | <------ |  Astro API     | <------ |  Admin Actions |
    | (Astro +  |         | (/api/import)  |         |  (dashboard)   |
    | FullCalendar)       +----------------+         +----------------+
```

---

## 5. 📃 Database Schema (via Supabase)

### Core Models

#### `events` table

| Column                    | Type      | Notes                                    |
| ------------------------- | --------- | ---------------------------------------- |
| `id`                      | UUID      | Primary key                              |
| `title`                   | Text      | Event title                              |
| `description`             | Text      | Long description                         |
| `start_date`              | Date      | Start date                               |
| `end_date`                | Date      | Optional end date                        |
| `start_time`              | Time      | Optional start time                      |
| `end_time`                | Time      | Optional end time                        |
| `location_id`             | UUID (FK) | → `locations.id`                         |
| `organization_id`         | UUID (FK) | → `organizations.id`                     |
| `email`                   | Text      | Contact email                            |
| `website`                 | Text      | Event website URL                        |
| `registration_link`       | Text      | Registration page URL                    |
| `primary_tag_id`          | UUID (FK) | → `tags.id`                              |
| `secondary_tag_id`        | UUID (FK) | → `tags.id`                              |
| `image_id`                | UUID (FK) | → `wagtailimages_image.id`               |
| `external_image_url`      | Text      | External image URL                       |
| `featured`                | Bool      | Featured event flag                      |
| `parent_event_id`         | UUID (FK) | → `events.id` (self-referencing)         |
| `exclude_from_calendar`   | Bool      | Hide from calendar display               |
| `google_calendar_event_id`| Text      | Google Calendar sync ID                  |
| `registration`            | Bool      | Registration required flag               |
| `cost`                    | Text      | Event cost/fee                           |
| `status`                  | Text      | 'pending', 'approved', 'duplicate', 'archived' |
| `updated_at`              | Timestamp | Auto-updated timestamp                   |
| `details_outdated_checked_at` | Timestamp | Last outdated check time             |
| `source_id`               | UUID (FK) | → `source_site.id` |

#### `locations` table

| Column            | Type      | Notes                                    |
| ----------------- | --------- | ---------------------------------------- |
| `id`              | UUID      | Primary key                              |
| `name`            | Text      | Location name                            |
| `address`         | Text      | Full address                             |
| `website`         | Text      | Location website                         |
| `phone`           | Text      | Contact phone                            |
| `latitude`        | Float     | GPS latitude                             |
| `longitude`       | Float     | GPS longitude                            |
| `parent_location_id` | UUID (FK) | → `locations.id` (self-referencing)      |
| `status`          | Text      | 'pending', 'approved', 'duplicate', 'archived' |

#### `organizations` table

| Column                | Type      | Notes                                    |
| --------------------- | --------- | ---------------------------------------- |
| `id`                  | UUID      | Primary key                              |
| `name`                | Text      | Organization name                        |
| `description`         | Text      | Organization description                 |
| `website`             | Text      | Organization website                     |
| `phone`               | Text      | Contact phone                            |
| `email`               | Text      | Contact email                            |
| `location_id`         | UUID (FK) | → `locations.id`                         |
| `parent_organization_id` | UUID (FK) | → `organizations.id` (self-referencing)  |
| `status`              | Categorical Text      | 'pending', 'approved', 'duplicate', 'archived' |

#### `tags` table

| Column        | Type      | Notes                                    |
| ------------- | --------- | ---------------------------------------- |
| `id`          | UUID      | Primary key                              |
| `name`        | Text      | Tag/category name                        |
| `calendar_id` | Text      | Google Calendar ID                       |
| `share_id`    | Text      | Google Calendar share ID                 |

#### `announcements` table

| Column        | Type      | Notes                                    |
| ------------- | --------- | ---------------------------------------- |
| `id`          | UUID      | Primary key                              |
| `title`       | Text      | Announcement title                       |
| `message`     | Text      | Announcement content                     |
| `link`        | Text      | Optional link URL                        |
| `email`       | Text      | Optional Contact email                   |
| `organization_id` | UUID (FK) | Optional. → `organizations.id`       |
| `author`      | Text      | Optional Author name                     |
| `status`      | Categorical Text  | Pending, published, archived     |
| `created_at`  | Timestamp | Creation timestamp                       |
| `show_at`     | Timestamp | When to start showing                    |
| `expires_at`  | Timestamp | Optional expiration                      |

#### `source_sites` table (SourceSite model)

| Column                | Type      | Notes                                    |
| --------------------- | --------- | ---------------------------------------- |
| `id`                  | UUID      | Primary key                              |
| `name`                | Text      | Source site name                         |
| `url`                 | Text      | Source site URL                          |
| `organization_id`     | UUID (FK) | → `organizations.id`                     |
| `event_tag_id`        | UUID (FK) | → `tags.id`                              |
| `last_scraped`        | Timestamp | Last scrape timestamp                    |
| `last_status`         | Text      | Last scrape status                       |
| `last_error`          | Text      | Last error message                       |
| `import_frequency`    | Text      | 'hourly', 'daily', 'weekly', 'manual'    |
| `extraction_function` | Text      | Extraction method name                   |

#### `scrape_logs` table (ScrapeLog model)

| Column        | Type      | Notes                                    |
| ------------- | --------- | ---------------------------------------- |
| `id`          | UUID      | Primary key                              |
| `source_id`   | UUID (FK) | → `source_sites.id`                      |
| `timestamp`   | Timestamp | Log timestamp                            |
| `status`      | Text      | Scrape status                            |
| `error_message` | Text   | Error details                            |

#### `simple_pages` table (SimplePage model)

| Column        | Type      | Notes                                    |
| ------------- | --------- | ---------------------------------------- |
| `id`          | UUID      | Primary key                              |
| `title`       | Text      | Page title                               |
| `slug`        | Text      | URL slug                                 |
| `body`        | Text      | Rich text content                        |
| `path`        | Text      | Wagtail tree path                        |
| `depth`       | Integer   | Tree depth                               |
| `numchild`    | Integer   | Number of children                       |
| `url_path`    | Text      | Full URL path                            |
| `seo_title`   | Text      | SEO title                                |
| `search_description` | Text | Meta description                         |
| `go_live_at`  | Timestamp | Publication date                         |
| `expire_at`   | Timestamp | Expiration date                          |
| `expired`     | Bool      | Expired flag                             |
| `content_type_id` | UUID (FK) | → `django_content_type.id`               |
| `live`        | Bool      | Published status                         |
| `has_unpublished_changes` | Bool | Draft changes flag                       |
| `owner_id`    | UUID (FK) | → `auth_user.id`                         |
| `latest_revision_created_at` | Timestamp | Last revision time                   |
| `first_published_at` | Timestamp | First publication time                   |
| `last_published_at` | Timestamp | Last publication time                    |
| `live_revision_id` | UUID (FK) | → `wagtailcore_revision.id`              |

#### `home_pages` table (HomePage model)

| Column        | Type      | Notes                                    |
| ------------- | --------- | ---------------------------------------- |
| `id`          | UUID      | Primary key                              |
| `title`       | Text      | Page title                               |
| `slug`        | Text      | URL slug                                 |
| `body`        | Text      | Rich text content                        |
| `path`        | Text      | Wagtail tree path                        |
| `depth`       | Integer   | Tree depth                               |
| `numchild`    | Integer   | Number of children                       |
| `url_path`    | Text      | Full URL path                            |
| `seo_title`   | Text      | SEO title                                |
| `search_description` | Text | Meta description                         |
| `go_live_at`  | Timestamp | Publication date                         |
| `expire_at`   | Timestamp | Expiration date                          |
| `expired`     | Bool      | Expired flag                             |
| `content_type_id` | UUID (FK) | → `django_content_type.id`               |
| `live`        | Bool      | Published status                         |
| `has_unpublished_changes` | Bool | Draft changes flag                       |
| `owner_id`    | UUID (FK) | → `auth_user.id`                         |
| `latest_revision_created_at` | Timestamp | Last revision time                   |
| `first_published_at` | Timestamp | First publication time                   |
| `last_published_at` | Timestamp | Last publication time                    |
| `live_revision_id` | UUID (FK) | → `wagtailcore_revision.id`              |

#### `events_staged` table (for public submissions)

| Column                    | Type      | Notes                                    |
| ------------------------- | --------- | ---------------------------------------- |
| `id`                      | UUID      | Primary key                              |
| `title`                   | Text      | Event title                              |
| `description`             | Text      | Long description                         |
| `start_date`              | Date      | Start date                               |
| `end_date`                | Date      | Optional end date                        |
| `start_time`              | Time      | Optional start time                      |
| `end_time`                | Time      | Optional end time                        |
| `location_id`             | UUID (FK) | → `locations.id`                         |
| `organization_id`         | UUID (FK) | → `organizations.id`                     |
| `email`                   | Text      | Contact email                            |
| `website`                 | Text      | Event website URL                        |
| `registration_link`       | Text      | Registration page URL                    |
| `primary_tag_id`          | UUID (FK) | → `tags.id`                              |
| `secondary_tag_id`        | UUID (FK) | → `tags.id`                              |
| `image_id`                | UUID (FK) | → `wagtailimages_image.id`               |
| `external_image_url`      | Text      | External image URL                       |
| `featured`                | Bool      | Featured event flag                      |
| `parent_event_id`         | UUID (FK) | → `events_staged.id` (self-referencing)  |
| `exclude_from_calendar`   | Bool      | Hide from calendar display               |
| `google_calendar_event_id`| Text      | Google Calendar sync ID                  |
| `registration`            | Bool      | Registration required flag               |
| `cost`                    | Text      | Event cost/fee                           |
| `status`                  | Text      | 'pending', 'approved', 'duplicate', 'archived' |
| `updated_at`              | Timestamp | Auto-updated timestamp                   |
| `details_outdated_checked_at` | Timestamp | Last outdated check time             |
| `source_id`               | UUID (FK) | → `source_site.id`                       |
| `submitted_at`            | Timestamp | Submission timestamp                     |

### Key Relationships

- **Events** → **Locations** (many-to-one)
- **Events** → **Organizations** (many-to-one)  
- **Events** → **Tags** (many-to-one, primary & secondary)
- **Events** → **Events** (self-referencing for parent/child events)
- **Locations** → **Locations** (self-referencing for parent/child locations)
- **Organizations** → **Organizations** (self-referencing for parent/child orgs)
- **Organizations** → **Locations** (many-to-one)
- **CommunityAnnouncements** → **Organizations** (many-to-one)
- **SourceSites** → **Organizations** (many-to-one)
- **SourceSites** → **Tags** (many-to-one)
- **ScrapeLogs** → **SourceSites** (many-to-one)

### Status Values

- **Event/Location/Organization Status**: `'pending'`, `'approved'`, `'duplicate'`, `'archived'`
- **SourceSite Import Frequency**: `'hourly'`, `'daily'`, `'weekly'`, `'manual'`

---

## 6. 🔐 Auth + Security

* Supabase Auth with RLS
* User roles defined via `public.users_metadata.role`
* RLS on `events`:

  * Admins can read/write all
  * Others read-only (or scoped)

* RLS on `events_staged`:
  * Public can insert
  * Admins can read/write all

---

## 7. 🗂️ Storage

* **Bucket**: `event-assets`
* Public access for logos, photos
* Private bucket for `.ics` or source documents
* Signed URLs exposed through API

---

## 8. 🧪 Python Tooling

### Scripts

* `parse_ics.py`: Convert `.ics` files to `Event` Pydantic model → POST to Supabase
* `summarize_events.py`: Call OpenAI to summarize missing descriptions
* `scrape_events.py`: Parse web HTML or email feeds for new events

### Scheduled via:

```yaml
on:
  schedule:
    - cron: "0 2 * * *"  # Run nightly
```

---

## 9. 🧪 Testing & Deployment

* Astro preview via `npx astro dev`
* Deploy via `vercel deploy` or `netlify deploy`
* Python scripts tested locally or in GitHub CI
* Supabase access via `.env` secrets

## 9.5 🚀 Development & Preview Environments

### Local Development Environment
* **Astro Dev Server**: `npx astro dev` for local development
* **Supabase Local**: `supabase start` for local database and auth
* **Hot Reload**: Automatic browser refresh on file changes
* **Environment Variables**: Local `.env` file for development secrets
* **Database Seeding**: Local data for development and testing

### Remote Preview Environments
* **Staging Environment**: Deployed to staging subdomain (e.g., `staging.dertown.org`)
* **Preview Deployments**: Automatic preview deployments for pull requests
* **Environment Isolation**: Separate databases and storage for staging
* **Integration Testing**: Full integration testing with external services
* **Performance Testing**: Load testing and performance validation

### Environment Management
* **Environment-Specific Configs**: Separate configs for dev/staging/prod
* **Database Migrations**: Safe migration testing in staging
* **Feature Flags**: Environment-specific feature toggles
* **Monitoring**: Environment-specific logging and monitoring
* **Backup & Recovery**: Staging environment backup procedures

### Preview Deployment Workflow
1. **Pull Request**: Creates automatic preview deployment
2. **Staging Testing**: Full testing in staging environment
3. **Integration Validation**: Test with real external services
4. **Performance Validation**: Load testing and performance checks
5. **Approval Process**: Manual approval before production deployment

## 10. 📚 Documentation & Administrative Processes

### Development Documentation
* `DEVELOPING.md` - Complete developer guide including:
  * Initial setup and environment configuration
  * Development workflow and coding standards
  * Testing procedures and deployment processes
  * **Administrative processes and chores** (see below)

### Administrative Processes & Chores
All administrative and operational procedures must be documented in `DEVELOPING.md`:

#### Initial Setup Procedures
* Development environment setup (Node.js, Python, Supabase CLI)
* Project initialization and first-time configuration
* Environment variable setup across all environments
* Database setup, seeding, and initial data migration
* Local development server configuration

#### Ongoing Administrative Tasks
* Database migrations and schema updates
* Environment variable management and rotation
* Dependency updates and security patch management
* Backup and recovery procedures
* Monitoring, logging, and alerting setup
* Performance optimization and maintenance
* Security audits and vulnerability assessments
* SSL certificate management and renewal
* Domain and DNS configuration
* CDN and caching management
* Storage bucket maintenance and cleanup
* User account and permission management
* API key rotation and management
* Scheduled task management (GitHub Actions, cron jobs)
* Content moderation and spam prevention
* Data import/export procedures
* System health monitoring and diagnostics

#### Documentation Standards
Each administrative process must include:
* Step-by-step procedures with commands and configurations
* Required permissions and access levels
* Frequency and scheduling information
* Rollback procedures where applicable
* Contact information for escalation
* Troubleshooting guides for common issues
* Success criteria and verification steps

## 11. 📦 Optional Future Enhancements

* Tagging & categorization system
* Calendar subscription export (reverse `.ics`)
* Public event submission form (done)
* Google Calendar or Eventbrite sync
* SMS or email alerts (via Supabase Edge Functions)
