-- Seed dertown@gmail.com as super admin if they exist in auth.users
-- This migration runs after user_permissions table is created

INSERT INTO public.user_permissions (user_id, is_admin, org_access_enabled)
SELECT id, true, false
FROM auth.users
WHERE email = 'dertown@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET is_admin = true, org_access_enabled = false;

-- Add comment for manual seeding if needed
-- If dertown@gmail.com doesn't exist yet, manually seed after account creation:
-- INSERT INTO public.user_permissions (user_id, is_admin, org_access_enabled)
-- VALUES ((SELECT id FROM auth.users WHERE email = 'dertown@gmail.com'), true, false)
-- ON CONFLICT (user_id) DO UPDATE SET is_admin = true, org_access_enabled = false;
