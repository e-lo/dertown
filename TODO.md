# 📋 Der Town Implementation Plan

## Overview

This document outlines a phased approach to implementing the Der Town community events platform, transitioning from the existing Django/Wagtail implementation to a modern Astro + Supabase architecture as specified in `PROJECT_REQUIREMENTS.md`.

## 🎯 Implementation Philosophy

### Pragmatic, Development-First Approach

This implementation follows a **pragmatic, development-first approach** that prioritizes:

1. **Rapid iteration** - Get working features quickly
2. **Essential QoL tools** - Automate repetitive development tasks
3. **DRY principles** - Build shared components as the codebase grows
4. **Real usage patterns** - Build sophisticated tools based on actual needs

### What to Build Early (Weeks 1-6)

**Essential Development Tools:**
- Basic Makefile commands (`make dev`, `make db-reset`, `make build`)
- Minimal Python utilities for database management
- Shared UI components and validation schemas
- TypeScript interfaces for type safety

**Why These Help Immediately:**
- Faster iteration cycles (reset DB in seconds)
- Consistent test data across team members
- Type safety to catch errors at compile time
- Reusable components reduce duplication

### What to Avoid Early

**Complex Infrastructure (Build Later):**
- Advanced duplicate detection (start with exact matches only)
- Comprehensive data validation (basic field validation is enough)
- Complex testing frameworks (manual testing is fine for MVP)
- Production monitoring (can add after launch)
- Advanced admin features (Supabase dashboard is sufficient)

**Why Avoid These Early:**
- Over-engineering solutions to problems you haven't encountered
- Slowing down development velocity
- Adding complexity without proportional benefit
- Building tools that may not be needed

### When to Add Sophisticated Tools

**Post-Launch (Based on Real Usage):**
- Fuzzy matching for duplicates (when you see actual duplicate patterns)
- Advanced data validation (when you encounter data quality issues)
- Automated ingestion pipelines (when you have real data sources)
- Comprehensive monitoring (when you need production insights)

## 🎯 Implementation Phases

### Phase 1: Foundation & Infrastructure (Week 1-2)
**Goal**: Set up the core development environment and essential QoL tools for rapid iteration

#### 1.1 Project Setup
- [x] Initialize Astro project with TypeScript
- [x] Configure Tailwind CSS with custom theme (based on reference `theme.css`)
- [x] Set up Tailwind CSS v4 integration with Astro
- [ ] Set up Shoelace Web Components
- [x] Configure ESLint, Prettier, and TypeScript
- [ ] Set up GitHub Actions for CI/CD
- [x] Create development documentation (`DEVELOPING.md`, `README.md`)
- [x] Document initial setup procedures in `DEVELOPING.md`
- [x] Create environment variable templates and documentation
- [x] **VALIDATION**: Run `npm run lint`, `npm run format:check`, `npm run build`, `npm run dev`
- [x] **TESTING**: Verify development server starts, Tailwind works, linting passes

#### 1.2 Essential Development Tools (High Priority)

- [x] Create basic Makefile with essential commands:
  - [x] `make dev` - Start development server
  - [x] `make db-reset` - Reset local database with sample data
  - [x] `make db-seed` - Seed with test data
  - [x] `make build` - Build for production
  - [x] `make preview` - Build and preview production locally
  - [x] `make format` - Format code with Prettier
  - [x] `make lint` - Run ESLint
  - [x] `make test` - Run tests
  - [x] `make clean` - Clean build artifacts
- [x] Create minimal Python development utilities (`scripts/dev_utils.py`):
  - [x] Database reset with sample data
  - [x] Basic CSV validation (required fields only)
  - [x] Test data generation
  - [x] Simple environment setup
- [x] **VALIDATION**: Test all Makefile commands locally
- [x] **TESTING**: Verify database reset, sample data seeding, formatting, linting, build
- [x] Update DEVELOPING.md to document these tools

#### 1.3 Supabase Setup

- [x] Create Supabase project
- [x] Implement database schema (all tables from requirements)
- [x] Set up Row Level Security (RLS) policies
- [x] Configure authentication with email/password
- [x] Set up storage buckets (`event-assets`) *(API works, UI listing is a known local issue)*
- [x] Create database migration scripts
- [x] Document database setup and maintenance procedures in `DEVELOPING.md`
- [x] Create backup and recovery documentation
- [x] **VALIDATION**: Run `supabase db reset`, verify schema, test RLS policies
- [x] **TESTING**: Test authentication, storage uploads (API), database connections
- [ ] **TODO**: Test public insert to `events_staged` in remote Supabase

#### 1.4 Core Dependencies

- [x] Install and configure FullCalendar.js (client-only, browser-safe)
- [x] Set up basic Pydantic models for data validation
- [x] Configure environment variables and secrets
- [x] Set up development and production environments
- [x] Document dependency management procedures in `DEVELOPING.md`
- [x] **VALIDATION**: Run `npm run test`, `python -m pytest`, verify all imports work
- [x] **TESTING**: Test FullCalendar integration, Pydantic model validation

#### 1.5 Preview Environment Setup
- [x] Configure staging environment (staging.dertown.org) *(manual: user must set up DNS/hosting)*
- [x] Create environment-specific configuration files
- [x] Set up staging database and storage buckets
- [x] **VALIDATION**: Test staging environment deployment
- [x] **TESTING**: Test staging environment functionality

### Phase 2: DRY Foundation & Shared Components (Week 3-4)

**Goal**: Establish shared patterns and components as the codebase grows

#### 2.1 Shared Components & Utilities

- [x] Create centralized database client (`lib/supabase.js`)
- [x] Create simple form validation schemas (`lib/validation.js`)
- [x] Create reusable UI components:
  - [x] `EventCard.astro` - Reusable event display component
  - [x] `EventForm.astro` - Reusable event submission form
  - [x] `CalendarView.astro` - Calendar interface component
- [x] Create TypeScript interfaces (`types/database.ts`)
- [x] **VALIDATION**: Test all shared components and utilities
- [x] **TESTING**: Verify component reusability, type safety, validation

#### 2.2 Enhanced Development Tools

- [x] Add iteration tools to Makefile:
  - [x] `make db-migrate` - Run database migrations
  - [x] `make db-backup` - Backup current state
  - [x] `make test-data` - Generate realistic test data
  - [x] `make validate-all` - Run all validations
- [x] Create better Python scripts (`scripts/data_manager.py`):
  - [x] CSV validation with error reporting
  - [x] Realistic test data generation
  - [x] Safe backup/restore operations
  - [x] Basic duplicate detection (exact matches only)
- [x] **VALIDATION**: Test enhanced development tools
- [x] **TESTING**: Verify data management, validation, backup operations

#### 2.3 Database-First Validation Setup

- [x] Add SQL constraints for data validation (field lengths, required fields, etc.)
- [x] Enhance RLS policies for business rule validation
- [x] Create simple Python validation functions for CSV imports
- [x] Update form validation to use simple Zod schemas
- [x] **VALIDATION**: Test database constraints and RLS policies
- [x] **TESTING**: Verify validation works at database level

### Phase 3: Core Data Models & API (Week 5-6)

**Goal**: Implement the foundational data layer and essential API endpoints

#### 3.1 Database Models & Types

- [x] Create TypeScript interfaces for all database models
- [x] Implement Pydantic models for Python scripts
- [x] Create data validation utilities
- [x] **VALIDATION**: Run TypeScript compilation, Pydantic validation tests
- [x] **TESTING**: Test model serialization/deserialization

#### 3.2 Essential API Routes

- [x] `/api/events/submit` - Public event submission endpoint (public insert to `events_staged`)
- [x] `/api/calendar/events` - Calendar data for client-side rendering
- [x] `/api/events/search` - Event search and filtering
- [x] **VALIDATION**: Run API tests, verify all endpoints respond correctly
- [x] **TESTING**: Test form submission, calendar data, search functionality

#### 3.3 Authentication & Authorization

- [x] Implement Supabase Auth integration for admin access
- [x] Create admin-only middleware
- [x] Set up user role management via Supabase Auth
- [x] Implement protected API routes (minimal)
- [x] **VALIDATION**: Test authentication flows, verify middleware protection
- [x] **TESTING**: Test login/logout, role-based access, protected routes

#### 3.4 Public Event Submission & Moderation

- [x] Create `events_staged` table for public submissions
- [x] Allow public insert to `events_staged` (RLS)
- [x] Admin review workflow: move from `events_staged` to `events` via Supabase dashboard
- [x] **VALIDATION**: Test public submission, admin review, and promotion
- [x] **TESTING**: Test spam protection, moderation, and event publishing

### Phase 4: Public-Facing UI Components (Week 7-8)

**Goal**: Build the core user interface components

#### 4.1 Layout & Navigation

- [x] Create responsive base layout
- [x] Implement navigation component
- [x] Design mobile-friendly navigation
- [x] Add breadcrumb navigation
- [x] **VALIDATION**: Run accessibility tests, responsive design checks
- [x] **TESTING**: Test navigation on mobile/desktop, verify breadcrumbs work

#### 4.2 Event Components

- [x] Event card component (carousel item)
- [x] Event list component with filtering
- [x] Event form component (for submissions)
- [x] **VALIDATION**: Run component tests, verify props and events
- [x] **TESTING**: Test component rendering, form validation, filtering

#### 4.3 Calendar Interface

- [x] FullCalendar.js integration
- [x] Week/Day/Month view components
- [x] Calendar filtering system
- [x] Event detail modal/popup
- [x] **VALIDATION**: Test calendar rendering, verify all views work
- [x] **TESTING**: Test calendar navigation, event display, export functions

#### 4.4 Announcement System

- [x] Announcement marquee component
- [x] **VALIDATION**: Test announcement display, verify marquee animation
- [x] **TESTING**: Test announcement rendering, pagination, accessibility

### Phase 5: Public Pages & Features (Week 9-10)

**Goal**: Implement all public-facing pages and functionality

#### 5.1 Home Page

- [x] Event carousel with announcements
- [x] Featured events section
- [x] Quick filters and search
- [x] RSS feed links
- [x] Calendar subscription links
- [x] **VALIDATION**: Test page load performance, verify all sections render
- [x] **TESTING**: Test carousel navigation, search functionality, feed links

#### 5.2 Event Pages

- [x] Event detail pages with permalinks
- [x] Event list page with advanced filtering
- [ ] Calendar view pages (week/day/month)
- [ ] Related events suggestions
- [ ] Social sharing functionality
- [ ] **VALIDATION**: Test page routing, verify permalinks work
- [ ] **TESTING**: Test filtering, pagination, social sharing, related events

#### 5.3 RSS & Calendar Feeds

- [ ] RSS feed generation for events
- [ ] iCal feed generation
- [ ] Google Calendar feed
- [ ] Outlook calendar feed
- [ ] Category-specific feeds
- [ ] Calendar export functionality (iCal, Google, Outlook)
- [ ] **VALIDATION**: Test feed generation, verify valid XML/iCal format
- [ ] **TESTING**: Test feed subscriptions, category filtering, calendar imports

#### 5.4 Public Submission Form

- [ ] Event submission form
- [ ] Fuzzy matching for organizations/locations
- [ ] Honeypot/CAPTCHA protection
- [ ] Form validation and error handling
- [ ] Success/confirmation pages
- [ ] **VALIDATION**: Test form validation, verify spam protection
- [ ] **TESTING**: Test form submission, fuzzy matching, error handling

#### 5.5 Additional Event Components

- [ ] Event detail page component
- [ ] Related events component
- [ ] Announcement card component
- [ ] Announcement list page
- [ ] **VALIDATION**: Test component rendering and interactions
- [ ] **TESTING**: Test component functionality and user flows

### Phase 6: Admin Interface (Week 11-12)

**Goal**: Configure administrative tools and interfaces

#### 6.1 Supabase Admin UI (Primary)

- [ ] Configure Supabase dashboard for data management
- [ ] Set up admin user roles and permissions via Supabase Auth
- [ ] Create custom admin views and filters in Supabase dashboard
- [ ] Configure RLS policies for admin access to all tables
- [ ] Set up admin workflow for reviewing `events_staged` → `events`
- [ ] **VALIDATION**: Test admin access, verify role permissions
- [ ] **TESTING**: Test data management operations, user role assignments

#### 6.2 Astro Admin Routes (Optional - Low Priority)

- [ ] Admin dashboard layout (only if Supabase UI insufficient)
- [ ] Event management interface (only if needed)
- [ ] Organization/location management (only if needed)
- [ ] Announcement management (only if needed)
- [ ] Submission review interface (only if needed)
- [ ] **VALIDATION**: Test admin routes, verify authentication protection
- [ ] **TESTING**: Test CRUD operations, bulk actions, submission review

#### 6.3 Admin API Endpoints (Minimal)

- [ ] Bulk import/export functionality (via Supabase dashboard)
- [ ] Data validation and cleanup tools (via Python scripts)
- [ ] Analytics and reporting endpoints (basic only)
- [ ] System health monitoring (basic only)
- [ ] **VALIDATION**: Test bulk operations, verify data integrity
- [ ] **TESTING**: Test import/export, analytics generation, health checks

### Phase 7: Data Ingestion & Automation (Week 13-14)

**Goal**: Implement automated data collection and processing via Makefile commands

#### 7.1 Python Scripts Integration

- [ ] Integrate `parse_ics.py` with `make ingest-ics` command
- [ ] Integrate `scrape_events.py` with `make ingest-scrape` command
- [ ] Integrate `summarize_events.py` with `make ingest-summarize` command
- [ ] Integrate `sync_google_calendar.py` with `make ingest-sync-gcal` command
- [ ] **VALIDATION**: Test all ingestion commands with sample data
- [ ] **TESTING**: Verify data parsing accuracy and error handling

#### 7.2 GitHub Actions Workflows

- [ ] Scheduled ICS import workflow using `make ingest-ics`
- [ ] Web scraping workflow using `make ingest-scrape`
- [ ] Content summarization workflow using `make ingest-summarize`

## Current Status: Phase 6 - Advanced Features & Polish

### ✅ Recently Completed:

- **Tailwind CSS Integration**: Fixed Tailwind CSS v4 setup with proper Astro integration
- **CSS Loading**: Resolved issue where Tailwind CSS wasn't being loaded in the application
- **Build System**: Verified that CSS is properly compiled and linked in production builds

### Next Priority Tasks:

1. **Event Detail Pages** - Create individual event pages with full details (`/events/[id]`)
2. **Search & Filtering** - Implement advanced search with multiple filters
3. **Related Events** - Show similar events on detail pages
4. **Calendar Export** - Add export buttons to event detail pages
5. **Location/Organization Pages** - Create dedicated pages for venues and organizers

### Technical Debt & Improvements:
- [ ] Add comprehensive error handling
- [ ] Implement proper loading states
- [ ] Add form validation feedback
- [ ] Optimize database queries
- [ ] Add caching strategies
- [ ] Implement proper SEO meta tags
- [ ] Add structured data markup
- [ ] Create comprehensive test suite