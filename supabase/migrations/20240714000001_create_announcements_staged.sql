-- Migration: Create announcements_staged table
CREATE TABLE IF NOT EXISTS announcements_staged (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  email text,
  organization text,
  author text,
  show_at timestamptz,
  expires_at timestamptz,
  status text,
  created_at timestamptz DEFAULT now()
);
-- Enable RLS
ALTER TABLE announcements_staged ENABLE ROW LEVEL SECURITY;

-- Remove all existing policies first (idempotent)
DROP POLICY IF EXISTS "Public insert access for announcements_staged" ON announcements_staged;
DROP POLICY IF EXISTS "Enable insert for all users" ON announcements_staged;
DROP POLICY IF EXISTS "Enable read access for all users" ON announcements_staged;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON announcements_staged;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON announcements_staged;
DROP POLICY IF EXISTS "Admin full access to announcements_staged" ON announcements_staged;

-- Public can insert
CREATE POLICY "Public insert access for announcements_staged" ON announcements_staged
    FOR INSERT WITH CHECK (true);

-- Only authenticated users (admins) can read/update/delete
CREATE POLICY "Admin read access to announcements_staged" ON announcements_staged
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin update access to announcements_staged" ON announcements_staged
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete access to announcements_staged" ON announcements_staged
    FOR DELETE USING (auth.role() = 'authenticated');

-- Only authenticated users (admins) can do everything else
CREATE POLICY "Admin full access to announcements_staged" ON announcements_staged
    FOR ALL USING (auth.role() = 'authenticated'); 