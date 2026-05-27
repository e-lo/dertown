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
  FOR ALL USING ((select email from auth.users where id = auth.uid()) IN ('dertown@gmail.com'));

-- RLS policies for org_users (super admin can see all, org editors see their own)
CREATE POLICY "super_admin_view_all" ON public.org_users
  FOR SELECT USING ((select email from auth.users where id = auth.uid()) IN ('dertown@gmail.com'));

CREATE POLICY "org_editor_view_own" ON public.org_users
  FOR SELECT USING (
    user_id = auth.uid()
    OR (select email from auth.users where id = auth.uid()) IN ('dertown@gmail.com')
  );

CREATE POLICY "super_admin_manage_all" ON public.org_users
  FOR ALL USING ((select email from auth.users where id = auth.uid()) IN ('dertown@gmail.com'));

-- Create indexes for performance
CREATE INDEX idx_allowlisted_org_emails_organization_id ON public.allowlisted_org_emails(organization_id);
CREATE INDEX idx_allowlisted_org_emails_email ON public.allowlisted_org_emails(email);
CREATE INDEX idx_org_users_user_id ON public.org_users(user_id);
CREATE INDEX idx_org_users_organization_id ON public.org_users(organization_id);
