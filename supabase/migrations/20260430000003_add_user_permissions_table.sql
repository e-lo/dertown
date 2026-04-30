-- Create user_permissions table for database-driven permission management
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean DEFAULT false,
  org_access_enabled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policy: Super admin only read/write
CREATE POLICY "super_admin_manage_permissions" ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Create index for performance
CREATE INDEX idx_user_permissions_user_id ON public.user_permissions(user_id);

-- Seed dertown@gmail.com as super admin
-- Note: This assumes dertown@gmail.com already exists in auth.users
-- The UUID will be populated by the user after migration runs
-- For now, we'll use a placeholder that should be updated:
-- UPDATE user_permissions SET user_id = (SELECT id FROM auth.users WHERE email = 'dertown@gmail.com')
-- WHERE is_admin = true AND user_id IS NULL;

-- We'll insert a placeholder row that will be populated after checking the actual user ID
INSERT INTO public.user_permissions (user_id, is_admin, org_access_enabled)
SELECT id, true, false FROM auth.users WHERE email = 'dertown@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET is_admin = true, org_access_enabled = false;
