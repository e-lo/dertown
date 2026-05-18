-- =============================================================================
-- email_allowlist: controls which email addresses are permitted to create
-- accounts via the self-service /register page.
--
-- The super admin manages this list from /admin/users.
-- Entries are also added automatically when the admin invites a user.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.email_allowlist (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Enforce lowercase storage
CREATE UNIQUE INDEX IF NOT EXISTS email_allowlist_email_lower_idx
  ON public.email_allowlist (lower(email));

ALTER TABLE public.email_allowlist ENABLE ROW LEVEL SECURITY;

-- Only super admins can read or write the allowlist
CREATE POLICY "email_allowlist_super_admin"
  ON public.email_allowlist
  FOR ALL
  USING (has_admin_access())
  WITH CHECK (has_admin_access());

-- The register API uses the service role key (supabaseAdmin) which bypasses
-- RLS, so it can check the allowlist without an authenticated session.
