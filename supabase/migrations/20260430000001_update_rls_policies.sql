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
