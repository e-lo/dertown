-- Replace is_super_admin() with has_admin_access() that checks user_permissions table
CREATE OR REPLACE FUNCTION has_admin_access()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old is_super_admin function
DROP FUNCTION IF EXISTS is_super_admin();

-- Update user_organization_ids() to check for admin status first
CREATE OR REPLACE FUNCTION user_organization_ids()
RETURNS uuid[] AS $$
BEGIN
  -- If user is admin, they can access all orgs (return empty array for full access)
  IF has_admin_access() THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  -- Otherwise, return orgs where user has explicit access via org_users
  RETURN ARRAY(
    SELECT organization_id FROM public.org_users
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update events RLS: admin access OR org membership
DROP POLICY IF EXISTS "events_read_policy" ON public.events;
CREATE POLICY "events_read_policy" ON public.events
  FOR SELECT USING (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "events_create_policy" ON public.events;
CREATE POLICY "events_create_policy" ON public.events
  FOR INSERT WITH CHECK (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "events_update_policy" ON public.events;
CREATE POLICY "events_update_policy" ON public.events
  FOR UPDATE USING (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  ) WITH CHECK (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "events_delete_policy" ON public.events;
CREATE POLICY "events_delete_policy" ON public.events
  FOR DELETE USING (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  );

-- Update locations RLS
DROP POLICY IF EXISTS "locations_read_policy" ON public.locations;
CREATE POLICY "locations_read_policy" ON public.locations
  FOR SELECT USING (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "locations_create_policy" ON public.locations;
CREATE POLICY "locations_create_policy" ON public.locations
  FOR INSERT WITH CHECK (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "locations_update_policy" ON public.locations;
CREATE POLICY "locations_update_policy" ON public.locations
  FOR UPDATE USING (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  ) WITH CHECK (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "locations_delete_policy" ON public.locations;
CREATE POLICY "locations_delete_policy" ON public.locations
  FOR DELETE USING (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  );

-- Update announcements RLS: admin access, published visible to all, drafts visible to org editor
DROP POLICY IF EXISTS "announcements_read_policy" ON public.announcements;
CREATE POLICY "announcements_read_policy" ON public.announcements
  FOR SELECT USING (
    has_admin_access()
    OR status = 'published'
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "announcements_create_policy" ON public.announcements;
CREATE POLICY "announcements_create_policy" ON public.announcements
  FOR INSERT WITH CHECK (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "announcements_update_policy" ON public.announcements;
CREATE POLICY "announcements_update_policy" ON public.announcements
  FOR UPDATE USING (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  ) WITH CHECK (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  );

DROP POLICY IF EXISTS "announcements_delete_policy" ON public.announcements;
CREATE POLICY "announcements_delete_policy" ON public.announcements
  FOR DELETE USING (
    has_admin_access()
    OR organization_id = ANY(user_organization_ids())
  );

-- Update organizations RLS: admin only
DROP POLICY IF EXISTS "organizations_read_policy" ON public.organizations;
CREATE POLICY "organizations_read_policy" ON public.organizations
  FOR SELECT USING (has_admin_access());

DROP POLICY IF EXISTS "organizations_create_policy" ON public.organizations;
CREATE POLICY "organizations_create_policy" ON public.organizations
  FOR INSERT WITH CHECK (has_admin_access());

DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
CREATE POLICY "organizations_update_policy" ON public.organizations
  FOR UPDATE USING (has_admin_access()) WITH CHECK (has_admin_access());

DROP POLICY IF EXISTS "organizations_delete_policy" ON public.organizations;
CREATE POLICY "organizations_delete_policy" ON public.organizations
  FOR DELETE USING (has_admin_access());
