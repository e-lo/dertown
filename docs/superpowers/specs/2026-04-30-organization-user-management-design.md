# Organization User Management Feature Design

**Date:** 2026-04-30  
**Feature:** Add organization-level user accounts with email-based access control, registration, password recovery, and role-based content filtering.

## Overview

Currently, all authenticated users are treated as super admins. This feature introduces organization editors—users who can manage content (events, series, locations, announcements) for specific organizations they're assigned to.

**Scope:** Full feature end-to-end, then test with real organization.

---

## Data Model

### New Tables

#### `allowlisted_org_emails`
Maps email addresses to organizations they're allowed to access. Populated by super admin before user registration.

```sql
CREATE TABLE allowlisted_org_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  created_at timestamp DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE(email, organization_id)
);
```

**Purpose:** Validation gate during registration. When user registers, we check if their email exists in this table to determine which org(s) they can access.

#### `org_users`
Links authenticated Supabase users to organizations they can manage. Created automatically after email verification, or manually by admin.

```sql
CREATE TABLE org_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  created_at timestamp DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(user_id, organization_id)
);
```

**Purpose:** Runtime access control. Used in RLS policies to determine what content a user can see/edit.

### Relationship

- One user → many orgs (many-to-many via `org_users`)
- One org → many users (many-to-many via `org_users`)
- Before a user can register, their email must be in `allowlisted_org_emails`
- On successful email verification, auto-create `org_users` row(s) for all orgs that email is allowlisted for

---

## Authentication & Authorization

### Current State
- Session via Supabase auth (access/refresh tokens in httpOnly cookies)
- `checkAdminAccess()` returns `isAdmin: true` for all authenticated users
- No role distinction

### Changes

#### Session Management (session.ts)
Update `checkAdminAccess()` to return:
- `role: 'super_admin'` if super admin (hardcoded list or special flag in auth.users metadata)
- `role: 'org_editor'` if user has entries in `org_users`
- `organizationIds: []` if org editor (list of org IDs they manage)

#### Registration Flow (`/register`)
1. User enters email + password
2. Validate email exists in `allowlisted_org_emails`
3. If not, reject with "This email is not registered for any organization. Email dertown@gmail.com to request access."
4. If yes, call Supabase `signUp()` with email + password
5. Supabase sends verification email
6. User clicks link in email
7. On email verified, webhook or post-verify logic auto-creates `org_users` row(s)

**Email Verification:** Use Supabase's built-in email verification. Update `env.d.ts` with Supabase project URL to enable email sending.

#### Login Flow (`/login`)
- No changes. Existing login works for org editors too.
- Password recovery: use Supabase's built-in reset link via email

#### Super Admin Identification
Two options:
- A) Hardcode list of super admin emails in env var (simplest for small team)
- B) Add `is_super_admin` boolean flag to auth.users metadata

**Recommendation:** Option A for MVP. List: `['dertown@gmail.com', ...]`

---

## Access Control (RLS Policies)

### Update Existing Policies

All content tables (`events`, `series`, `locations`, `announcements`) need updated RLS:

**For super admin:**
- Can SELECT/INSERT/UPDATE/DELETE everything

**For org editor:**
- Can SELECT where `organization_id` IN (user's org_ids)
- Can INSERT/UPDATE/DELETE only where `organization_id` IN (user's org_ids)

**For announcements specifically:**
- Can SELECT where `status = 'published'` OR (`status = 'draft'` AND `organization_id` IN user's org_ids)
- Can INSERT/UPDATE only with `status = 'draft'`
- Cannot UPDATE `status` (only super admin can approve)

### Org Editor Constraints
- Cannot create/edit/delete organizations
- Cannot see admin pages
- Cannot manage other users

---

## UI / Pages

### New Pages

#### `/register`
- Email input
- Password input
- Submit button
- Error states:
  - "Email not found in allowlist. Email dertown@gmail.com to request access."
  - "Email already registered"
  - Network errors
- On success: "Check your email to verify your account. You'll be able to login once verified."

#### `/forgot-password`
- Email input
- "Reset password" button
- Supabase handles the rest (sends reset email)
- On success: "Check your email for password reset instructions"

### Modified Pages

#### `/login`
- Add link: "Don't have an account? [Register here](/register)"
- Add link: "Forgot password? [Reset here](/forgot-password)"

#### `/admin/organizations` (existing)
- Add column: "Users" with count badge
- Add action: "Manage users" button → `/admin/organizations/[id]/users`

#### `/admin/organizations/[id]/users` (new)
- Show organization name
- Table of current users (email, created_at)
- "Add email" button → opens modal
- "Remove" button per row (with confirmation)
- Can paste comma-separated email list or add one at a time

#### `/admin/organization-users` (new, optional)
- Alternative bulk interface
- List all orgs with their user counts
- Click org → edit users (same as above)
- Useful if managing many orgs at once

### Editor Experience

#### Organization Detail Page (if accessible to editors)
- Show org info
- Read-only view (no edit for editors—only super admin can edit org details)
- Or: editors can edit, updates visible to super admin for approval (TBD based on preference)

#### Event/Series/Location Creation (existing)
- No UI changes
- Backend filters by org automatically
- On save, can be published immediately (no approval needed)

#### Announcements
- Draft announcements: saved with `status = 'draft'`
- Editor sees their drafts in a "My drafts" section
- Super admin sees all announcements (published + all drafts) in admin interface
- Approval flow: super admin clicks "Approve" → `status = 'published'`

---

## API Endpoints

### Admin-Only

**POST `/api/admin/org-users`**
- Add email to organization's allowlist
- Body: `{ email, organization_id }`
- Creates `allowlisted_org_emails` row

**DELETE `/api/admin/org-users`**
- Remove email from allowlist / revoke access
- Params: `{ email, organization_id }`
- Deletes from `allowlisted_org_emails` and `org_users`

**GET `/api/admin/org-users`**
- List all org-user mappings
- Optional filter: `?organization_id=xyz`

### Public

**POST `/api/auth/register`**
- Email + password
- Validate email in allowlist
- Call Supabase signUp
- Body: `{ email, password }`
- Returns: `{ success, message }`

**POST `/api/auth/forgot-password`**
- Email input
- Call Supabase resetPasswordForEmail
- Body: `{ email }`
- Returns: `{ success, message }`

---

## Testing Strategy

### Phase 1 (Small Scale)
**Goal:** Verify full flow works end-to-end

1. **Setup:**
   - Add 2-3 test emails to `allowlisted_org_emails` for a test org
   - Set yourself as super admin

2. **Registration:**
   - Register with test email
   - Verify email verification flow works
   - Confirm account activation
   - Login with new account

3. **Content Creation:**
   - Create an event as org editor
   - Verify event appears on public site immediately
   - Edit the event
   - Delete the event

4. **Announcement Workflow:**
   - Create announcement as org editor (saved as draft)
   - Verify editor cannot see it published yet
   - Login as super admin
   - Approve announcement
   - Verify org editor sees it published

5. **Isolation:**
   - Register another org editor for different org
   - Verify they cannot see first org's events/series
   - Verify they can only create content for their org

6. **Password Recovery:**
   - Test forgot-password flow
   - Verify reset email works

### Phase 2 (Real Organization)
**Goal:** Validate UX and workflow with actual users

1. Add 2-3 real user emails from target org
2. Send them invite email (manual) with link to `/register`
3. Observe their registration and initial content creation
4. Gather feedback on UI/clarity

### Success Criteria
- ✓ Registration validates email allowlist
- ✓ Email verification blocks login until confirmed
- ✓ Org editors can only see/edit their org's content
- ✓ Events/series/locations publish immediately
- ✓ Announcements stay as drafts until approved
- ✓ Password recovery works
- ✓ No org isolation breaches (can't access other orgs)

---

## Implementation Phases

### Phase 1: Database & Policies
1. Create `allowlisted_org_emails` table
2. Create `org_users` table
3. Create migrations + seed data for test
4. Update RLS policies on all content tables

### Phase 2: Authentication
1. Create `/register` page
2. Create `/forgot-password` page
3. Update `/login` with links
4. Update session.ts to distinguish super admin vs org editor
5. Create POST `/api/auth/register` endpoint

### Phase 3: Admin Interface
1. Create `/admin/organizations/[id]/users` page
2. Create API endpoints for managing org-user mappings
3. Test add/remove email flows

### Phase 4: Access Control
1. Update existing event/series/location/org pages to enforce org isolation
2. Update announcement page to show only published + own drafts
3. Test RLS policies

### Phase 5: Testing & Polish
1. Small scale testing (Phase 1 above)
2. UI polish, error messages
3. Real org testing (Phase 2 above)

---

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Use Supabase auth for signup/verification/recovery | Built-in, secure, email trusted | 
| Two-table approach (allowlist + org_users) | Decouples allowlist management from account creation; allows pre-staging emails |
| Auto-create org_users on email verify | Simpler than manual admin action; matches workflow |
| Hardcode super admin emails | Simplest for MVP; can upgrade to metadata flag later |
| Org editors cannot edit org details | Prevents accidental changes; keeps org master data super admin only |
| Announcements require approval | Prevents announcement queue spam |
| Events/series/locations auto-publish | Faster workflow; less friction for org editors |

---

## Open Questions / TBD

1. **Organization detail editing:** Can org editors edit org name/description/website, or super admin only?
   - Recommendation: Super admin only (org master data)

2. **Email notification:** When super admin approves announcement, should org editor get notified?
   - Recommendation: Defer to Phase 2, add if feedback suggests

3. **Bulk email import:** Support CSV upload for adding multiple emails at once?
   - Recommendation: Defer; start with manual add

4. **User audit log:** Track who created/revoked each user access?
   - Recommendation: Defer; `created_by` field added, audit report can come later

---

## Success Metrics

- Registration flow is intuitive (no support emails about setup)
- Org editors complete their first event creation in <5 minutes
- No RLS policy breaches during testing
- Announcement approval workflow works as expected
- Super admin can manage users easily

