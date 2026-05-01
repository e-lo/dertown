-- Fix RLS policy on user_permissions table
-- The current policy creates a circular dependency:
-- - To read user_permissions, you need to be a super admin
-- - But proving you're a super admin requires reading user_permissions
--
-- Solution: Allow users to read their own entry, super admins can manage all

DROP POLICY IF EXISTS "super_admin_manage_permissions" ON public.user_permissions;

-- Users can read their own permission entry
CREATE POLICY "users_read_own_permissions" ON public.user_permissions
  FOR SELECT USING (user_id = auth.uid());

-- Only super admins can insert/update/delete
CREATE POLICY "super_admin_manage_all_permissions" ON public.user_permissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "super_admin_update_permissions" ON public.user_permissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "super_admin_delete_permissions" ON public.user_permissions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );
