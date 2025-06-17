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

### Development-First Approach

The Python tooling follows a pragmatic, phased approach that prioritizes development velocity and essential QoL improvements over complex infrastructure:

#### Phase 1: Essential Development Tools (Week 1-2)
**Goal**: Enable rapid development iteration with minimal overhead

**Core Makefile Commands:**
```bash
make dev              # Start development server
make db-reset         # Reset local database with sample data
make db-seed          # Seed with test data
make build            # Build for production
make deploy-staging   # Deploy to staging
```

**Minimal Python Scripts:**
- **Development Utilities** (`scripts/dev_utils.py`):
  - Database reset with sample data
  - Basic CSV validation (required fields only)
  - Test data generation
  - Simple environment setup

**Why These Help Immediately:**
- Faster iteration cycles (reset DB in seconds)
- Consistent test data across team members
- Simple validation to catch obvious errors
- One-command deployment to reduce friction

#### Phase 2: DRY Foundation (Week 3-4)
**Goal**: Establish shared patterns and components as the codebase grows

**Shared Components & Utilities:**
- Centralized database client (`lib/supabase.js`)
- Shared validation schemas (`lib/validation.js`)
- Reusable UI components (`components/EventCard.astro`)
- TypeScript interfaces (`types/database.ts`)

**Why These Help During Development:**
- Consistent UI across the application
- Type safety to catch errors at compile time
- Shared validation rules across forms
- Easier refactoring (change once, updates everywhere)

#### Phase 3: Iteration Tools (Week 5-6)
**Goal**: Add tools when development friction is encountered

**Enhanced Development Tools:**
```bash
make db-migrate       # Run database migrations
make db-backup        # Backup current state
make test-data        # Generate realistic test data
make validate-all     # Run all validations
```

**Better Python Scripts:**
- **Data Manager** (`scripts/data_manager.py`):
  - CSV validation with error reporting
  - Realistic test data generation
  - Safe backup/restore operations
  - Basic duplicate detection (exact matches only)

#### Phase 4: Production Tools (Post-Launch)
**Goal**: Build sophisticated tools based on real usage patterns

**Advanced Data Management:**
```bash
make ingest-ics       # Import calendar files
make process-deduplicate  # Remove duplicates
make admin-backup     # Production backups
make health-check     # System diagnostics
```

**Comprehensive Python Infrastructure:**
- Fuzzy matching for duplicates
- Advanced data validation
- Automated ingestion pipelines
- Health monitoring and audit logging

### Key Principles

1. **Build tools when you need them** - Don't anticipate problems
2. **Start simple, iterate fast** - Complex tools can wait
3. **Focus on developer experience** - What slows you down daily?
4. **DRY for shared patterns** - Components, validation, types
5. **Automate repetitive tasks** - Database resets, deployments

### What to Avoid Early

- **Complex duplicate detection** - Start with exact matches only
- **Advanced data validation** - Basic field validation is enough
- **Comprehensive testing** - Manual testing is fine for MVP
- **Production monitoring** - Can add after launch
- **Advanced admin features** - Supabase dashboard is sufficient

### Makefile Integration

All Python modules are called through Makefile commands for consistent interface:

#### Essential Development Commands (Week 1-2)
```bash
# Start with these - they pay immediate dividends
make dev              # Development server
make db-reset         # Quick database reset
make seed             # Sample data
make build            # Production build
```

#### Iteration Commands (Week 3-6)
```bash
# Add these when you hit friction
make db-migrate       # When schema changes
make test-data        # When you need more realistic data
make validate         # When CSV uploads get complex
```

#### Production Commands (Post-Launch)
```bash
# Build these based on real usage patterns
make ingest-*         # Based on actual data sources
make process-*        # Based on real data quality issues
make admin-*          # Based on actual admin workflows
```

### Pydantic Models

All data operations use Pydantic models for validation and type safety:

- **Event Models**: `Event`, `EventStaged` (for public submissions)
- **Organization Models**: `Organization`
- **Location Models**: `Location`
- **Tag Models**: `Tag`
- **Announcement Models**: `Announcement`
- **Source Models**: `SourceSite`, `ScrapeLog`

Each model includes:

- **Field validation**: Data types, required fields, format validation
- **Custom validators**: URL validation, date/time parsing, status enums
- **Database mapping**: Direct mapping to Supabase table columns
- **CSV compatibility**: Handle CSV-specific data formats (empty strings, \N values)

### Error Handling and Logging

- **Comprehensive Logging**: All operations logged with structured data
- **Error Recovery**: Automatic retry mechanisms and rollback procedures
- **Notification System**: Email/Slack notifications for critical failures
- **Audit Trail**: Complete audit trail for all data operations
- **Performance Monitoring**: Track operation performance and resource usage

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

## 9.6 🗄️ Database Management & Seeding

### Makefile-Based Database Operations

The project uses a Makefile to provide clear, consistent database management commands:

#### Core Database Commands

```bash
# Reset local database (schema + static data)
make db-reset

# Upload CSV data to specified environment also performs validation and checks for duplicates
make db-upload [staging|production] --events events.csv --organizations organizations.csv

# Validate CSV data without uploading
make db-validate --events events.csv --organizations organizations.csv

# Check for potential duplicates
make db-check-duplicates --events events.csv --organizations organizations.csv

# Database backup and restore
make db-backup [local|staging|production]
make db-restore [local|staging|production] [backup-file]
```

#### Administrative Commands
```bash
# Data ingestion and processing
make ingest-ics [file]           # Import ICS file
make ingest-scrape [source]      # Scrape events from source
make ingest-summarize [content]  # Summarize events that don't have a short description with AI to produce a two sentence summary
make ingest-sync-gcal            # Sync with Google Calendar, making sure updates to db events are updated in google calendar

# Data processing and quality
make process-deduplicate         # Run deduplication on database
make process-clean [specify-files]# Clean and standardize data
make process-validate            # Run quality assurance checks
make process-audit               # Generate audit report

# System administration
make admin-backup [env]          # Create system backup
make admin-health-check          # Run system health checks
make admin-optimize              # Optimize database performance
make admin-cleanup               # Run maintenance tasks
make admin-users [action]        # Manage admin users

# Development and testing
make dev-models                  # Generate/update Pydantic models from database schema
make dev-test-models             # Test Pydantic models with sample data
make dev-validate-csv [file]     # Validate CSV file against Pydantic models
make dev-test-db-connection      # Test database connection and basic operations
make dev-setup-env [env]         # Set up development environment (local/staging)
```

### Scheduled Operations

GitHub Actions workflows call Makefile commands for scheduled operations:

```yaml
# Nightly health checks
- name: Health Check
  run: make admin-health-check

# Weekly website checks for various sources
- name: Update icile.org events
  run: make ingest-source icicle.org
- name: Update leavenworth.org events
  run: make ingest-source leavenworth.org

# Monthly maintenance
- name: System maintenance
  run: make admin-cleanup
```

### Pydantic Models

All data operations use Pydantic models for validation and type safety:

- **Event Models**: `Event`, `EventStaged` (for public submissions)
- **Organization Models**: `Organization`
- **Location Models**: `Location`
- **Tag Models**: `Tag`
- **Announcement Models**: `Announcement`
- **Source Models**: `SourceSite`, `ScrapeLog`

Each model includes:

- **Field validation**: Data types, required fields, format validation
- **Custom validators**: URL validation, date/time parsing, status enums
- **Database mapping**: Direct mapping to Supabase table columns
- **CSV compatibility**: Handle CSV-specific data formats (empty strings, \N values)

### Error Handling and Logging

- **Comprehensive Logging**: All operations logged with structured data
- **Error Recovery**: Automatic retry mechanisms and rollback procedures
- **Notification System**: Email/Slack notifications for critical failures
- **Audit Trail**: Complete audit trail for all data operations
- **Performance Monitoring**: Track operation performance and resource usage

---

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
* **Database seeding and data management via Makefile commands**
* **CSV data validation and duplicate detection**
* **Environment-specific data uploads (staging/production)**
* **Automated data ingestion (ICS, web scraping, content summarization)**
* **Data processing and quality assurance**
* **System health monitoring and maintenance**
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

#### Database Management Procedures
* **Local Development**: `make db-reset` for clean development environment
* **Staging Updates**: `make db-upload staging --events events.csv` for staging data updates
* **Production Updates**: `make db-upload production --events events.csv` for production data updates
* **Data Validation**: `make db-validate` to check CSV data before upload
* **Duplicate Detection**: `make db-check-duplicates` to identify potential conflicts
* **Backup Procedures**: `make db-backup [env]` for automated database backups
* **Restore Procedures**: `make db-restore [env] [backup]` for database restoration

#### Data Ingestion Procedures
* **ICS Import**: `make ingest-ics [file]` for calendar file imports
* **Web Scraping**: `make ingest-scrape [source]` for automated event collection
* **Content Summarization**: `make ingest-summarize [content]` for AI-powered descriptions
* **Google Calendar Sync**: `make ingest-sync-gcal` for bidirectional calendar sync
* **Scheduled Ingestion**: GitHub Actions workflows for automated data collection

#### Data Processing Procedures
* **Deduplication**: `make process-deduplicate` for removing duplicate events
* **Data Cleaning**: `make process-clean` for standardizing data formats
* **Quality Assurance**: `make process-validate` for comprehensive data quality checks
* **Audit Reporting**: `make process-audit` for compliance and debugging reports

#### System Administration Procedures
* **System Backups**: `make admin-backup [env]` for complete system backups
* **Health Monitoring**: `make admin-health-check` for system diagnostics
* **Performance Optimization**: `make admin-optimize` for database and system optimization
* **Maintenance Tasks**: `make admin-cleanup` for routine maintenance operations
* **User Management**: `make admin-users [action]` for admin user administration

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
