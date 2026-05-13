-- =============================================================================
-- Org-scoped RLS policies for defense-in-depth
-- Replaces the old "any authenticated user = full access" policies.
-- Works alongside the API-layer filtering in withAdminAuth.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- True if the current user has is_admin = true in user_permissions
CREATE OR REPLACE FUNCTION has_admin_access()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND is_admin = true
  );
END;
$$;

-- True if the current user is an org editor with access to the given org
CREATE OR REPLACE FUNCTION has_org_access(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_permissions up
    JOIN public.org_users ou ON ou.user_id = up.user_id
    WHERE up.user_id = auth.uid()
      AND up.org_access_enabled = true
      AND ou.organization_id = org_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- EVENTS
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin full access to events" ON public.events;

CREATE POLICY "events_super_admin"
  ON public.events
  FOR ALL
  USING (has_admin_access())
  WITH CHECK (has_admin_access());

CREATE POLICY "events_org_editor_select"
  ON public.events
  FOR SELECT
  USING (has_org_access(organization_id));

CREATE POLICY "events_org_editor_insert"
  ON public.events
  FOR INSERT
  WITH CHECK (
    has_org_access(organization_id)
    -- Org editors cannot insert already-approved events
    AND status != 'approved'
  );

CREATE POLICY "events_org_editor_update"
  ON public.events
  FOR UPDATE
  USING (has_org_access(organization_id))
  WITH CHECK (
    has_org_access(organization_id)
    -- Org editors cannot approve events
    AND status != 'approved'
  );

-- No DELETE policy for org editors — super admin only via events_super_admin

-- ---------------------------------------------------------------------------
-- ANNOUNCEMENTS
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin full access to announcements" ON public.announcements;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.announcements;

CREATE POLICY "announcements_super_admin"
  ON public.announcements
  FOR ALL
  USING (has_admin_access())
  WITH CHECK (has_admin_access());

CREATE POLICY "announcements_org_editor_select"
  ON public.announcements
  FOR SELECT
  USING (has_org_access(organization_id));

CREATE POLICY "announcements_org_editor_insert"
  ON public.announcements
  FOR INSERT
  WITH CHECK (
    has_org_access(organization_id)
    -- Org editors can only create drafts
    AND status = 'pending'
  );

CREATE POLICY "announcements_org_editor_update"
  ON public.announcements
  FOR UPDATE
  USING (has_org_access(organization_id))
  WITH CHECK (
    has_org_access(organization_id)
    -- Org editors cannot publish
    AND status != 'published'
  );

-- No DELETE policy for org editors — super admin only

-- ---------------------------------------------------------------------------
-- LOCATIONS  (no organization_id — shared reference data)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin full access to locations" ON public.locations;

-- Super admin: full access
CREATE POLICY "locations_super_admin"
  ON public.locations
  FOR ALL
  USING (has_admin_access())
  WITH CHECK (has_admin_access());

-- Org editors: can read/create/update locations (needed to tag their events),
-- but not delete
CREATE POLICY "locations_org_editor_select"
  ON public.locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND org_access_enabled = true
    )
  );

CREATE POLICY "locations_org_editor_insert"
  ON public.locations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND org_access_enabled = true
    )
  );

CREATE POLICY "locations_org_editor_update"
  ON public.locations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND org_access_enabled = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND org_access_enabled = true
    )
  );

-- ---------------------------------------------------------------------------
-- ORGANIZATIONS
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin full access to organizations" ON public.organizations;

-- Super admin: full access
CREATE POLICY "organizations_super_admin"
  ON public.organizations
  FOR ALL
  USING (has_admin_access())
  WITH CHECK (has_admin_access());

-- Org editors: can read and update their own organization only; cannot create or delete
CREATE POLICY "organizations_org_editor_select"
  ON public.organizations
  FOR SELECT
  USING (has_org_access(id));

CREATE POLICY "organizations_org_editor_update"
  ON public.organizations
  FOR UPDATE
  USING (has_org_access(id))
  WITH CHECK (has_org_access(id));
