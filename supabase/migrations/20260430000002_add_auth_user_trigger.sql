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
