-- Replace hardcoded-email RLS policies on allowlisted_org_emails and org_users
-- with has_admin_access() / has_org_access() so all super_admins in user_permissions
-- are respected, not just the original dertown@gmail.com address.
--
-- The original policies in 20260430000000 used:
--   auth.jwt() ->> 'email' IN ('dertownleavenworth@gmail.com')
-- which silently excludes any super_admin added via user_permissions.

-- ── allowlisted_org_emails ────────────────────────────────────────────────────

-- Drop old hardcoded-email policies
DROP POLICY IF EXISTS "super_admin_all_access" ON public.allowlisted_org_emails;
DROP POLICY IF EXISTS "org_editor_view_own_allowlist" ON public.allowlisted_org_emails;

-- Super admins can do everything
CREATE POLICY "admin_all_access" ON public.allowlisted_org_emails
  FOR ALL
  USING (has_admin_access())
  WITH CHECK (has_admin_access());

-- Org editors can view entries for their organizations only
CREATE POLICY "org_editor_view_own" ON public.allowlisted_org_emails
  FOR SELECT
  USING (has_org_access(organization_id));

-- ── org_users ─────────────────────────────────────────────────────────────────

-- Drop old hardcoded-email policies
DROP POLICY IF EXISTS "super_admin_view_all" ON public.org_users;
DROP POLICY IF EXISTS "super_admin_manage_all" ON public.org_users;
DROP POLICY IF EXISTS "org_editor_view_own" ON public.org_users;

-- Super admins can do everything
CREATE POLICY "admin_all_access" ON public.org_users
  FOR ALL
  USING (has_admin_access())
  WITH CHECK (has_admin_access());

-- Org editors can view their own memberships
CREATE POLICY "org_editor_view_own" ON public.org_users
  FOR SELECT
  USING (user_id = auth.uid());
