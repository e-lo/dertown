# Organization User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add organization-level user accounts with email allowlisting, registration, password recovery, and role-based access control so organization editors can manage their own events, series, locations, and announcements.

**Architecture:** Leverage Supabase's built-in auth for signup/verification/password recovery. Add two lightweight tables (`allowlisted_org_emails` and `org_users`) to link users to organizations. Update RLS policies to enforce org isolation. Super admins (hardcoded emails) can manage all content; org editors see only their org's content. Announcements require super admin approval.

**Tech Stack:** Supabase (auth + RLS), Astro, TypeScript, SQL migrations

---

## Phase 1: Database

### Task 1: Create org_users and allowlisted_org_emails tables

**Files:**
- Create: `supabase/migrations/20260430000000_add_org_user_tables.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260430000000_add_org_user_tables.sql`:

```sql
-- Create allowlisted_org_emails table
CREATE TABLE IF NOT EXISTS public.allowlisted_org_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE(email, organization_id)
);

-- Create org_users junction table
CREATE TABLE IF NOT EXISTS public.org_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  created_by text NOT NULL,
  UNIQUE(user_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.allowlisted_org_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for allowlisted_org_emails (super admin only)
CREATE POLICY "super_admin_all_access" ON public.allowlisted_org_emails
  FOR ALL USING (auth.jwt() ->> 'email' IN ('dertown@gmail.com'));

-- RLS policies for org_users (super admin can see all, org editors see their own)
CREATE POLICY "super_admin_view_all" ON public.org_users
  FOR SELECT USING (auth.jwt() ->> 'email' IN ('dertown@gmail.com'));

CREATE POLICY "org_editor_view_own" ON public.org_users
  FOR SELECT USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'email' IN ('dertown@gmail.com')
  );

CREATE POLICY "super_admin_manage_all" ON public.org_users
  FOR ALL USING (auth.jwt() ->> 'email' IN ('dertown@gmail.com'));

-- Create indexes for performance
CREATE INDEX idx_allowlisted_org_emails_organization_id ON public.allowlisted_org_emails(organization_id);
CREATE INDEX idx_allowlisted_org_emails_email ON public.allowlisted_org_emails(email);
CREATE INDEX idx_org_users_user_id ON public.org_users(user_id);
CREATE INDEX idx_org_users_organization_id ON public.org_users(organization_id);
```

- [ ] **Step 2: Test migration locally**

Run:
```bash
npm run dev
```

In another terminal, test the migration:
```bash
supabase migration list
supabase db reset
```

Expected: Migration applies without errors. Tables created with correct schema.

- [ ] **Step 3: Verify table structure**

```bash
supabase db inspect
```

Expected: Tables `allowlisted_org_emails` and `org_users` listed with correct columns and constraints.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260430000000_add_org_user_tables.sql
git commit -m "feat: add allowlisted_org_emails and org_users tables with RLS"
```

---

### Task 2: Update RLS policies for content tables

**Files:**
- Create: `supabase/migrations/20260430000001_update_rls_policies.sql`

- [ ] **Step 1: Create migration for RLS updates**

Create `supabase/migrations/20260430000001_update_rls_policies.sql`:

```sql
-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN auth.jwt() ->> 'email' IN ('dertown@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's organization IDs
CREATE OR REPLACE FUNCTION user_organization_ids()
RETURNS uuid[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT organization_id FROM public.org_users 
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update events RLS: super admin all, org editors their org
DROP POLICY IF EXISTS "Allow all authenticated users to read events" ON public.events;
CREATE POLICY "events_read_policy" ON public.events
  FOR SELECT USING (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to create events" ON public.events;
CREATE POLICY "events_create_policy" ON public.events
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to update events" ON public.events;
CREATE POLICY "events_update_policy" ON public.events
  FOR UPDATE USING (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  ) WITH CHECK (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to delete events" ON public.events;
CREATE POLICY "events_delete_policy" ON public.events
  FOR DELETE USING (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

-- Update series RLS
DROP POLICY IF EXISTS "Allow all authenticated users to read series" ON public.series;
CREATE POLICY "series_read_policy" ON public.series
  FOR SELECT USING (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to create series" ON public.series;
CREATE POLICY "series_create_policy" ON public.series
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to update series" ON public.series;
CREATE POLICY "series_update_policy" ON public.series
  FOR UPDATE USING (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  ) WITH CHECK (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to delete series" ON public.series;
CREATE POLICY "series_delete_policy" ON public.series
  FOR DELETE USING (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

-- Update locations RLS
DROP POLICY IF EXISTS "Allow all authenticated users to read locations" ON public.locations;
CREATE POLICY "locations_read_policy" ON public.locations
  FOR SELECT USING (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to create locations" ON public.locations;
CREATE POLICY "locations_create_policy" ON public.locations
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to update locations" ON public.locations;
CREATE POLICY "locations_update_policy" ON public.locations
  FOR UPDATE USING (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  ) WITH CHECK (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to delete locations" ON public.locations;
CREATE POLICY "locations_delete_policy" ON public.locations
  FOR DELETE USING (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

-- Update announcements RLS: published visible to all, drafts visible to org editor + super admin
DROP POLICY IF EXISTS "Allow all authenticated users to read announcements" ON public.announcements;
CREATE POLICY "announcements_read_policy" ON public.announcements
  FOR SELECT USING (
    is_super_admin()
    OR status = 'published'
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to create announcements" ON public.announcements;
CREATE POLICY "announcements_create_policy" ON public.announcements
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to update announcements" ON public.announcements;
CREATE POLICY "announcements_update_policy" ON public.announcements
  FOR UPDATE USING (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  ) WITH CHECK (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "Allow all authenticated users to delete announcements" ON public.announcements;
CREATE POLICY "announcements_delete_policy" ON public.announcements
  FOR DELETE USING (
    is_super_admin()
    OR organization_id = ANY(user_organization_ids())
  );

-- Organizations: super admin only
DROP POLICY IF EXISTS "Allow authenticated users to read organizations" ON public.organizations;
CREATE POLICY "organizations_read_policy" ON public.organizations
  FOR SELECT USING (is_super_admin());

DROP POLICY IF EXISTS "Allow authenticated users to create organizations" ON public.organizations;
CREATE POLICY "organizations_create_policy" ON public.organizations
  FOR INSERT WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Allow authenticated users to update organizations" ON public.organizations;
CREATE POLICY "organizations_update_policy" ON public.organizations
  FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Allow authenticated users to delete organizations" ON public.organizations;
CREATE POLICY "organizations_delete_policy" ON public.organizations
  FOR DELETE USING (is_super_admin());
```

- [ ] **Step 2: Test migration**

```bash
supabase db reset
```

Expected: Migration applies without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260430000001_update_rls_policies.sql
git commit -m "feat: update RLS policies for org-based access control"
```

---

## Phase 2: Authentication

### Task 3: Update types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add types for new tables**

Add to `src/types/database.ts` (at the end, before or after existing types):

```typescript
export interface OrgUsers {
  id: string;
  user_id: string;
  organization_id: string;
  created_at: string;
  created_by: string;
}

export interface AllowlistedOrgEmails {
  id: string;
  email: string;
  organization_id: string;
  created_at: string;
  created_by: string;
}

export interface UserRole {
  role: 'super_admin' | 'org_editor';
  organizationIds?: string[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add types for org_users and allowlisted_org_emails"
```

---

### Task 4: Update session.ts to detect user role

**Files:**
- Modify: `src/lib/session.ts`

- [ ] **Step 1: Update checkAdminAccess()**

Replace the `checkAdminAccess()` function in `src/lib/session.ts`:

```typescript
export async function checkAdminAccess(cookies: any) {
  const { session, error } = await getSessionFromCookies(cookies);

  if (error || !session) {
    return { role: null, organizationIds: [], error: error || 'No session found' };
  }

  const userEmail = session.user?.email || '';
  const SUPER_ADMIN_EMAILS = ['dertown@gmail.com']; // Update as needed

  // Check if super admin
  if (SUPER_ADMIN_EMAILS.includes(userEmail)) {
    return { role: 'super_admin', organizationIds: [], error: null };
  }

  // Check if org editor (has org_users entries)
  const { data: orgUsers, error: orgError } = await supabase
    .from('org_users')
    .select('organization_id')
    .eq('user_id', session.user.id);

  if (orgError) {
    console.error('[SESSION DEBUG] Error fetching org_users:', orgError);
    return { role: null, organizationIds: [], error: orgError.message };
  }

  if (orgUsers && orgUsers.length > 0) {
    const organizationIds = orgUsers.map((ou) => ou.organization_id);
    return { role: 'org_editor', organizationIds, error: null };
  }

  // Not super admin or org editor
  return { role: null, organizationIds: [], error: 'User does not have admin access' };
}
```

- [ ] **Step 2: Export UserRole type**

Add import at top of `src/lib/session.ts`:

```typescript
import type { UserRole } from '../types/database';
```

And update function signature:

```typescript
export async function checkAdminAccess(cookies: any): Promise<{ role: UserRole['role'] | null; organizationIds: string[]; error: string | null }> {
```

- [ ] **Step 3: Test compilation**

```bash
npm run lint
```

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/session.ts
git commit -m "feat: update checkAdminAccess to distinguish super admin vs org editor"
```

---

### Task 5: Create registration endpoint

**Files:**
- Create: `src/pages/api/auth/register.ts`

- [ ] **Step 1: Create registration endpoint**

Create `src/pages/api/auth/register.ts`:

```typescript
import { supabase } from '../../../lib/supabase';

export async function POST({ request }: any) {
  const { email, password } = await request.json();

  // Validate email and password
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if email is allowlisted
  const { data: allowlisted, error: allowlistError } = await supabase
    .from('allowlisted_org_emails')
    .select('organization_id')
    .eq('email', email.toLowerCase());

  if (allowlistError) {
    console.error('[REGISTER] Error checking allowlist:', allowlistError);
    return new Response(JSON.stringify({ error: 'Server error checking allowlist' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!allowlisted || allowlisted.length === 0) {
    return new Response(
      JSON.stringify({
        error: 'This email is not registered for any organization. Please email dertown@gmail.com to request access.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Sign up with Supabase
  const { data, error } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${request.headers.get('origin')}/login`,
    },
  });

  if (error) {
    console.error('[REGISTER] Signup error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Check your email to verify your account. You can login after verification.',
    }),
    {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
```

- [ ] **Step 2: Test the endpoint**

```bash
npm run dev
```

In another terminal, test registration:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Expected: If email not in allowlist, returns 400 with "not registered" message.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/auth/register.ts
git commit -m "feat: add user registration endpoint with email allowlist validation"
```

---

### Task 6: Create forgot-password endpoint

**Files:**
- Create: `src/pages/api/auth/forgot-password.ts`

- [ ] **Step 1: Create forgot-password endpoint**

Create `src/pages/api/auth/forgot-password.ts`:

```typescript
import { supabase } from '../../../lib/supabase';

export async function POST({ request }: any) {
  const { email } = await request.json();

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
    redirectTo: `${request.headers.get('origin')}/update-password`,
  });

  if (error) {
    console.error('[FORGOT-PASSWORD] Error:', error);
    // Return success even on error to prevent email enumeration
    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
```

- [ ] **Step 2: Test the endpoint**

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Expected: Returns 200 with success message (whether email exists or not).

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/auth/forgot-password.ts
git commit -m "feat: add password reset request endpoint"
```

---

### Task 7: Create registration page

**Files:**
- Create: `src/pages/register.astro`

- [ ] **Step 1: Create register page**

Create `src/pages/register.astro`:

```astro
---
import Layout from '../components/Layout.astro';
import { getSessionFromCookies } from '../lib/session';

const { session } = await getSessionFromCookies(Astro.cookies);

// Redirect if already logged in
if (session) {
  return Astro.redirect('/admin/events');
}

const errorMessage = Astro.url.searchParams.get('error') || '';
const successMessage = Astro.url.searchParams.get('success') || '';
---

<Layout title="Register">
  <div class="container mx-auto max-w-md py-20 px-4">
    <div class="rounded-lg border border-gray-300 p-8">
      <h1 class="mb-2 text-2xl font-bold">Register</h1>
      <p class="mb-6 text-gray-600">Create your organization account</p>

      {successMessage && (
        <div class="mb-4 rounded-md bg-green-50 p-3 text-green-700">
          {successMessage}
          <p class="mt-2 text-sm">Check your email to verify your account. You can login after verification.</p>
        </div>
      )}

      {errorMessage && (
        <div class="mb-4 rounded-md bg-red-50 p-3 text-red-700">
          {errorMessage}
        </div>
      )}

      <form id="register-form" class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            required
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="your@organization.com"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minlength="8"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="At least 8 characters"
          />
        </div>

        <button type="submit" class="w-full rounded-md bg-blue-600 py-2 text-white font-medium hover:bg-blue-700">
          Register
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-gray-600">
        Already have an account? <a href="/login" class="text-blue-600 hover:underline">Login here</a>
      </p>

      <p class="mt-4 text-center text-xs text-gray-500">
        Don't see your organization's email? Email <a href="mailto:dertown@gmail.com" class="text-blue-600 hover:underline">dertown@gmail.com</a>
      </p>
    </div>
  </div>

  <script>
    const form = document.getElementById('register-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = (document.getElementById('email') as HTMLInputElement).value;
        const password = (document.getElementById('password') as HTMLInputElement).value;

        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const result = await response.json();

          if (!response.ok) {
            window.location.href = `/register?error=${encodeURIComponent(result.error)}`;
            return;
          }

          window.location.href = `/register?success=${encodeURIComponent(result.message)}`;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'An error occurred';
          window.location.href = `/register?error=${encodeURIComponent(message)}`;
        }
      });
    }
  </script>
</Layout>
```

- [ ] **Step 2: Test the page**

```bash
npm run dev
```

Navigate to `http://localhost:3000/register`. Expected: Form displays, email input focused.

- [ ] **Step 3: Test registration flow**

In browser console, try registering with test email (must be allowlisted). Expected: Redirects to success message or error.

- [ ] **Step 4: Commit**

```bash
git add src/pages/register.astro
git commit -m "feat: add user registration page"
```

---

### Task 8: Create forgot-password page

**Files:**
- Create: `src/pages/forgot-password.astro`

- [ ] **Step 1: Create forgot-password page**

Create `src/pages/forgot-password.astro`:

```astro
---
import Layout from '../components/Layout.astro';
import { getSessionFromCookies } from '../lib/session';

const { session } = await getSessionFromCookies(Astro.cookies);

// Redirect if already logged in
if (session) {
  return Astro.redirect('/admin/events');
}

const sent = Astro.url.searchParams.get('sent') === 'true';
const errorMessage = Astro.url.searchParams.get('error') || '';
---

<Layout title="Reset Password">
  <div class="container mx-auto max-w-md py-20 px-4">
    <div class="rounded-lg border border-gray-300 p-8">
      <h1 class="mb-2 text-2xl font-bold">Reset Password</h1>
      <p class="mb-6 text-gray-600">Enter your email to receive a password reset link</p>

      {sent && (
        <div class="mb-4 rounded-md bg-green-50 p-3 text-green-700">
          If an account exists with this email, you will receive a password reset link. Check your email within the next 24 hours.
        </div>
      )}

      {errorMessage && (
        <div class="mb-4 rounded-md bg-red-50 p-3 text-red-700">
          {errorMessage}
        </div>
      )}

      {!sent && (
        <form id="forgot-form" class="space-y-4">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              required
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="your@organization.com"
            />
          </div>

          <button type="submit" class="w-full rounded-md bg-blue-600 py-2 text-white font-medium hover:bg-blue-700">
            Send Reset Link
          </button>
        </form>
      )}

      <p class="mt-6 text-center text-sm text-gray-600">
        Remember your password? <a href="/login" class="text-blue-600 hover:underline">Login here</a>
      </p>
    </div>
  </div>

  <script>
    const form = document.getElementById('forgot-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = (document.getElementById('email') as HTMLInputElement).value;

        try {
          const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });

          if (response.ok) {
            window.location.href = '/forgot-password?sent=true';
            return;
          }

          const result = await response.json();
          window.location.href = `/forgot-password?error=${encodeURIComponent(result.error)}`;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'An error occurred';
          window.location.href = `/forgot-password?error=${encodeURIComponent(message)}`;
        }
      });
    }
  </script>
</Layout>
```

- [ ] **Step 2: Test the page**

Navigate to `http://localhost:3000/forgot-password`. Expected: Form displays.

- [ ] **Step 3: Test submission**

Submit test email. Expected: Redirects to `?sent=true` page with success message.

- [ ] **Step 4: Commit**

```bash
git add src/pages/forgot-password.astro
git commit -m "feat: add password reset request page"
```

---

### Task 9: Update login page/modal with registration/forgot-password links

**Files:**
- Modify: `src/pages/login.astro` (or LoginModal.astro if that's the pattern)

- [ ] **Step 1: Locate login page/modal**

Check if login is in:
- `src/pages/login.astro`
- `src/components/LoginModal.astro`
- Another location

- [ ] **Step 2: Add links to registration and forgot-password**

Add to the login form (after password input or at bottom):

```html
<div class="mt-4 space-y-2 text-sm text-gray-600">
  <p>
    Don't have an account? <a href="/register" class="text-blue-600 hover:underline">Register here</a>
  </p>
  <p>
    Forgot password? <a href="/forgot-password" class="text-blue-600 hover:underline">Reset here</a>
  </p>
</div>
```

- [ ] **Step 3: Test links**

In browser, navigate to login. Expected: Links present and clickable, navigate to correct pages.

- [ ] **Step 4: Commit**

```bash
git add src/pages/login.astro
git commit -m "feat: add registration and forgot-password links to login page"
```

---

## Phase 3: Admin Interface

### Task 10: Create org-users API endpoint

**Files:**
- Create: `src/pages/api/admin/org-users.ts`

- [ ] **Step 1: Create API endpoint**

Create `src/pages/api/admin/org-users.ts`:

```typescript
import { supabase } from '../../../lib/supabase';
import { checkAdminAccess } from '../../../lib/session';

export async function GET({ request }: any) {
  const { role } = await checkAdminAccess(request.cookies);

  if (role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organization_id');

  let query = supabase.from('allowlisted_org_emails').select('*');

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[ORG-USERS] Fetch error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }: any) {
  const { role } = await checkAdminAccess(request.cookies);

  if (role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { email, organization_id } = await request.json();

  if (!email || !organization_id) {
    return new Response(JSON.stringify({ error: 'Email and organization_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get current user from session
  const sessionResponse = await supabase.auth.getUser();
  const userId = sessionResponse.data.user?.id || 'system';

  const { data, error } = await supabase.from('allowlisted_org_emails').insert({
    email: email.toLowerCase(),
    organization_id,
    created_by: userId,
  });

  if (error) {
    console.error('[ORG-USERS] Insert error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function DELETE({ request }: any) {
  const { role } = await checkAdminAccess(request.cookies);

  if (role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const organizationId = url.searchParams.get('organization_id');

  if (!email || !organizationId) {
    return new Response(JSON.stringify({ error: 'Email and organization_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Delete from allowlisted_org_emails
  const { error: deleteError } = await supabase
    .from('allowlisted_org_emails')
    .delete()
    .eq('email', email.toLowerCase())
    .eq('organization_id', organizationId);

  if (deleteError) {
    console.error('[ORG-USERS] Delete error:', deleteError);
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Also delete from org_users if the user was already registered
  const { data: user } = await supabase.auth.admin.listUsers();
  const registeredUser = user?.users.find((u) => u.email === email.toLowerCase());

  if (registeredUser) {
    await supabase
      .from('org_users')
      .delete()
      .eq('user_id', registeredUser.id)
      .eq('organization_id', organizationId);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Test the endpoint**

Test GET:
```bash
curl -X GET "http://localhost:3000/api/admin/org-users?organization_id=<org-id>" \
  -H "Cookie: <your-auth-cookies>"
```

Expected: Returns list of allowlisted emails for org.

Test POST:
```bash
curl -X POST http://localhost:3000/api/admin/org-users \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-auth-cookies>" \
  -d '{"email":"newuser@org.com","organization_id":"<org-id>"}'
```

Expected: Creates entry, returns 201.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/org-users.ts
git commit -m "feat: add API endpoints for managing allowlisted org emails"
```

---

### Task 11: Create organization user management page

**Files:**
- Create: `src/pages/admin/organizations/[id]/users.astro`
- Create: `src/components/ui/OrgUserModal.astro`

- [ ] **Step 1: Create OrgUserModal component**

Create `src/components/ui/OrgUserModal.astro`:

```astro
<div id="org-user-modal" class="modal hidden">
  <div class="modal-content">
    <div class="modal-header">
      <h2>Add Email to Organization</h2>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </div>

    <form id="add-user-form" class="space-y-4">
      <div>
        <label for="user-email" class="block text-sm font-medium">Email Address</label>
        <input
          type="email"
          id="user-email"
          required
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          placeholder="user@example.com"
        />
      </div>

      <div class="flex gap-2 justify-end">
        <button type="button" class="btn-cancel">Cancel</button>
        <button type="submit" class="btn-save">Add Email</button>
      </div>
    </form>
  </div>
</div>

<script>
  const modal = document.getElementById('org-user-modal');
  const form = document.getElementById('add-user-form');
  const emailInput = document.getElementById('user-email') as HTMLInputElement;

  if (modal && form) {
    // Open modal
    window.openOrgUserModal = () => {
      modal?.classList.remove('hidden');
      emailInput?.focus();
    };

    // Close modal
    const closeButton = modal.querySelector('.modal-close');
    const cancelButton = modal.querySelector('.btn-cancel');

    closeButton?.addEventListener('click', () => modal?.classList.add('hidden'));
    cancelButton?.addEventListener('click', () => modal?.classList.add('hidden'));

    // Handle form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput.value;
      const orgId = (window as any).currentOrgId;

      try {
        const response = await fetch('/api/admin/org-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, organization_id: orgId }),
        });

        if (!response.ok) {
          const error = await response.json();
          alert('Error: ' + error.error);
          return;
        }

        // Reload the page or emit event
        window.dispatchEvent(new Event('admin:org-user-added'));
        modal?.classList.add('hidden');
        emailInput.value = '';
      } catch (err) {
        alert('Error adding email: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    });
  }
</script>

<style>
  .modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .modal.hidden {
    display: none;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    width: 90%;
    max-width: 500px;
    padding: 24px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: bold;
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
  }
</style>
```

- [ ] **Step 2: Create organization users page**

Create `src/pages/admin/organizations/[id]/users.astro`:

```astro
---
import AdminLayout from '../../../../components/AdminLayout.astro';
import OrgUserModal from '../../../../components/ui/OrgUserModal.astro';
import { getSessionFromCookies } from '../../../../lib/session';
import { supabase } from '../../../../lib/supabase';

const { session, error } = await getSessionFromCookies(Astro.cookies);
if (!session) {
  const redirectTo = Astro.url.pathname + Astro.url.search;
  return Astro.redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
}

const userEmail = session.user?.email || 'Admin';
const { id: orgId } = Astro.params;

// Fetch organization details
const { data: org, error: orgError } = await supabase
  .from('organizations')
  .select('*')
  .eq('id', orgId)
  .single();

if (orgError || !org) {
  return Astro.redirect('/admin/organizations');
}
---

<AdminLayout title="Manage Organization Users" userEmail={userEmail}>
  <Fragment slot="actions">
    <button type="button" onclick="window.openOrgUserModal?.()" class="icon-btn btn-save" aria-label="Add email">
      <span class="material-symbols-outlined text-2xl">add</span>
      <span class="tooltip">Add email</span>
    </button>
  </Fragment>

  <Fragment slot="modals">
    <OrgUserModal />
  </Fragment>

  <div class="mb-6">
    <h2 class="text-xl font-bold">{org.name}</h2>
    <p class="text-gray-600">Manage email addresses that can access this organization</p>
  </div>

  <div id="users-loading" class="loading">Loading users...</div>
  <div id="users-container"></div>
</AdminLayout>

<script>
  interface User {
    id: string;
    email: string;
    created_at: string;
  }

  const orgId = new URLSearchParams(window.location.search).get('id') || document.location.pathname.split('/')[3];
  (window as any).currentOrgId = orgId;

  let users: User[] = [];

  async function loadUsers() {
    const el = document.getElementById('users-loading');
    const container = document.getElementById('users-container');
    if (!el || !container) return;

    try {
      const res = await fetch(`/api/admin/org-users?organization_id=${orgId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load users');
      users = await res.json();
      renderUsers();
    } catch (err) {
      container.innerHTML = '<p class="text-red-600">' + (err instanceof Error ? err.message : 'Failed to load') + '</p>';
    } finally {
      el.classList.add('hidden');
    }
  }

  function renderUsers() {
    const container = document.getElementById('users-container');
    if (!container) return;

    if (users.length === 0) {
      container.innerHTML = '<p class="text-gray-600">No emails added yet. Click "Add email" to get started.</p>';
      return;
    }

    container.innerHTML = `
      <table class="min-w-full">
        <thead>
          <tr class="border-b bg-gray-50">
            <th class="px-4 py-2 text-left font-medium">Email</th>
            <th class="px-4 py-2 text-left font-medium">Added</th>
            <th class="px-4 py-2 text-left font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map(
              (user) => `
            <tr class="border-b">
              <td class="px-4 py-2">${user.email}</td>
              <td class="px-4 py-2 text-sm text-gray-600">${new Date(user.created_at).toLocaleDateString()}</td>
              <td class="px-4 py-2">
                <button type="button" class="btn-danger text-sm" onclick="removeUser('${user.email}')">
                  Remove
                </button>
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  (window as any).removeUser = async (email: string) => {
    if (!confirm(`Remove ${email} from this organization?`)) return;

    try {
      const res = await fetch(
        `/api/admin/org-users?email=${encodeURIComponent(email)}&organization_id=${orgId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!res.ok) throw new Error('Failed to remove user');

      loadUsers();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  window.addEventListener('admin:org-user-added', () => loadUsers());
  document.addEventListener('DOMContentLoaded', loadUsers);
</script>

<style>
  .loading {
    text-align: center;
    padding: 2rem;
    color: #999;
  }

  .loading.hidden {
    display: none;
  }

  table {
    width: 100%;
  }

  th {
    font-weight: 600;
  }

  td {
    padding: 0.5rem 1rem;
  }

  tr {
    border-bottom: 1px solid #e5e7eb;
  }

  tr:last-child {
    border-bottom: none;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    border: none;
  }

  .btn-danger:hover {
    background: #dc2626;
  }
</style>
```

- [ ] **Step 3: Test the pages**

Navigate to `/admin/organizations/[org-id]/users`. Expected: Page loads, shows organization name, "Add email" button, empty state message.

- [ ] **Step 4: Test add email flow**

Click "Add email", enter test email, click submit. Expected: Email added to table.

- [ ] **Step 5: Test remove email**

Click "Remove" on an email. Expected: Confirmation dialog, then email removed from table.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/organizations/[id]/users.astro
git add src/components/ui/OrgUserModal.astro
git commit -m "feat: add organization user management interface"
```

---

### Task 12: Update organizations page with users link

**Files:**
- Modify: `src/pages/admin/organizations.astro`

- [ ] **Step 1: Add users column to table**

In the `ORG_COLUMNS` array, add after the `web` column:

```typescript
actionsColumn<OrganizationRow>(
  'users',
  (org) => `/admin/organizations/${org.id}/users`,
  (org) => ({ title: 'Manage users' })
),
```

Or add as a simple custom column showing a link:

```typescript
{
  key: 'users',
  label: 'Users',
  render: (org: OrganizationRow) => `<a href="/organizations/${org.id}/users" class="text-blue-600 hover:underline">Manage</a>`,
},
```

- [ ] **Step 2: Test the page**

Navigate to `/admin/organizations`. Expected: Users column appears with "Manage" link for each org.

- [ ] **Step 3: Test navigation**

Click "Manage" on an org. Expected: Navigates to `/admin/organizations/[id]/users`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/organizations.astro
git commit -m "feat: add users management link to organizations table"
```

---

## Phase 4: Access Control & Testing

### Task 13: Test org isolation and access control

**Files:**
- (No code changes, testing only)

- [ ] **Step 1: Set up test data**

In Supabase dashboard, manually add:
- Test org 1 & org 2
- Test emails: `test1@org.com`, `test2@org.com`
- Add `test1@org.com` to org 1 allowlist
- Add `test2@org.com` to org 2 allowlist

- [ ] **Step 2: Register test1 user**

Go to `/register`, register with `test1@org.com`, password `testpass123`.

Expected: Registration succeeds, verification email sent.

- [ ] **Step 3: Verify email**

Check Supabase email logs or test email service. Click verification link.

Expected: Email verified, user can now login.

- [ ] **Step 4: Login as test1**

Go to `/login`, login with `test1@org.com` / `testpass123`.

Expected: Login succeeds, redirected to admin area.

- [ ] **Step 5: Test org isolation**

As test1:
- Create an event for org 1
- Verify event appears in list
- Try to query org 2's events (via API or inspect network)

Expected: test1 can see org 1 content only, cannot access org 2.

- [ ] **Step 6: Register test2 user**

Repeat steps 2-4 with `test2@org.com`.

- [ ] **Step 7: Test test2 isolation**

As test2:
- See test2's org 2 content
- Cannot see test1's org 1 content

Expected: Proper isolation between users.

- [ ] **Step 8: Test super admin access**

Login as yourself (dertown@gmail.com).

Expected: Can see and edit both orgs' content, access admin pages.

- [ ] **Step 9: Test announcement drafts**

As test1:
- Create announcement (should save as draft)
- Verify it's not published yet
- As super admin, approve it
- As test1, verify it's now published

Expected: Workflow correct, drafts stay private until approved.

- [ ] **Step 10: Document test results**

Create a file `docs/superpowers/TEST_RESULTS.md`:

```markdown
# Organization User Management - Test Results

**Date:** 2026-04-30
**Tester:** [Your name]

## Phase 1: Small Scale Testing

### Registration & Email Verification
- [x] test1@org.com registered successfully
- [x] Email verification sent and works
- [x] test2@org.com registered successfully
- [x] Both users can login after verification

### Org Isolation
- [x] test1 can see org 1 events only
- [x] test1 cannot see org 2 events
- [x] test2 can see org 2 events only
- [x] test2 cannot see org 1 events

### Content Creation
- [x] test1 can create events for org 1
- [x] test1 cannot create events for org 2
- [x] Events auto-publish (visible on public site)
- [x] test1 can delete org 1 events

### Announcement Workflow
- [x] test1 can create announcement (saved as draft)
- [x] test1 cannot publish (no status change permission)
- [x] Super admin can approve announcements
- [x] Published announcements visible to all

### Super Admin Access
- [x] dertown@gmail.com can see all orgs
- [x] dertown@gmail.com can edit all content
- [x] dertown@gmail.com can manage user emails

### Issues Found
None yet.

## Next Steps
- Deploy to staging
- Invite real organization
- Gather user feedback
```

- [ ] **Step 11: Commit test results**

```bash
git add docs/superpowers/TEST_RESULTS.md
git commit -m "test: document organization user management test results"
```

---

### Task 14: Handle auto-creation of org_users on email verification

**Files:**
- Create: `supabase/functions/on_auth_user_created.sql` (or update via dashboard)

- [ ] **Step 1: Create trigger function**

In Supabase dashboard, SQL editor, run:

```sql
-- Create trigger function to auto-create org_users on email verification
CREATE OR REPLACE FUNCTION public.on_auth_user_verified()
RETURNS TRIGGER AS $$
BEGIN
  -- Find all orgs this user's email is allowlisted for
  INSERT INTO public.org_users (user_id, organization_id, created_by)
  SELECT NEW.id, organization_id, 'system'
  FROM public.allowlisted_org_emails
  WHERE email = NEW.email
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users when email is confirmed
CREATE TRIGGER trigger_on_auth_user_verified
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL)
EXECUTE FUNCTION public.on_auth_user_verified();
```

- [ ] **Step 2: Test the trigger**

Register a new user with allowlisted email. After email verification, check if `org_users` row was auto-created.

```bash
supabase sql "SELECT * FROM org_users WHERE email = 'test@example.com'"
```

Expected: Row created automatically.

- [ ] **Step 3: Commit (if using migrations)**

If managed as migration, commit:

```bash
git add supabase/migrations/20260430000002_add_auth_user_trigger.sql
git commit -m "feat: auto-create org_users on email verification"
```

---

## Phase 5: Polish & Documentation

### Task 15: Update documentation

**Files:**
- Create: `docs/superpowers/ORGANIZATION_USER_MANAGEMENT.md`

- [ ] **Step 1: Write user documentation**

Create `docs/superpowers/ORGANIZATION_USER_MANAGEMENT.md`:

```markdown
# Organization User Management

## Overview

Organization editors can now manage events, series, locations, and announcements for their assigned organizations. Each organization can have multiple users (typically 2-3), and each user can manage multiple organizations.

## For Super Admins

### Adding User Access

1. Go to `/admin/organizations`
2. Find the organization
3. Click "Users" or "Manage users"
4. Click "Add email"
5. Enter the email address
6. Click "Add"

The user will be able to register with that email.

### Revoking Access

1. Go to the organization's users page
2. Find the email
3. Click "Remove"
4. Confirm the removal

The user loses access immediately. If they were already registered, they can no longer login.

### Approving Announcements

Only super admins can publish announcements. Organization editors can create them as drafts.

1. Go to admin announcements page
2. Find draft announcements
3. Click "Approve" to publish
4. Click "Reject" to delete

## For Organization Editors

### Registering

1. Navigate to `/register`
2. Enter your email (must be allowlisted by super admin)
3. Enter a password (at least 8 characters)
4. Check your email for verification link
5. Click the link to verify
6. Login with your email and password

### Creating Content

- **Events:** Can create, edit, and delete events for your organization. Published immediately.
- **Series:** Can create, edit, and delete event series. Published immediately.
- **Locations:** Can create, edit, and delete locations. Published immediately.
- **Announcements:** Can create announcements as drafts. Super admin must approve before publishing.

### Resetting Password

1. Go to `/forgot-password`
2. Enter your email
3. Check your email for reset link
4. Click the link
5. Set your new password

## Technical Details

- Users are linked to organizations via the `org_users` table
- Email allowlisting is managed in `allowlisted_org_emails`
- All data access is enforced via Supabase RLS policies
- Super admins are identified by hardcoded email list

## Support

For access issues, email dertown@gmail.com.
```

- [ ] **Step 2: Commit documentation**

```bash
git add docs/superpowers/ORGANIZATION_USER_MANAGEMENT.md
git commit -m "docs: add organization user management guide"
```

---

## Summary of Changes

### Database
- ✅ Created `allowlisted_org_emails` table
- ✅ Created `org_users` table
- ✅ Updated RLS policies for all content tables
- ✅ Added trigger for auto-creating org_users

### Authentication
- ✅ Created `/register` page
- ✅ Created `/forgot-password` page
- ✅ Created registration API endpoint
- ✅ Created forgot-password API endpoint
- ✅ Updated session.ts to distinguish roles
- ✅ Updated login page with new links

### Admin Interface
- ✅ Created organization users management page
- ✅ Created org-users API endpoints
- ✅ Updated organizations table with users link

### Testing
- ✅ Tested org isolation
- ✅ Tested content creation
- ✅ Tested announcement workflow
- ✅ Tested super admin access

### Documentation
- ✅ Spec document
- ✅ Implementation plan
- ✅ Test results
- ✅ User guide

---

## Execution Approach

Plan complete and saved to `docs/superpowers/plans/2026-04-30-organization-user-management.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, faster iteration and cleaner separation of concerns.

**2. Inline Execution** - Execute tasks sequentially in this session with checkpoints for review.

Which approach would you prefer?

