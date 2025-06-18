-- Enhance RLS policies with business rule validation
-- This provides additional validation at the database level

-- Drop existing policies to recreate with enhanced validation
DROP POLICY IF EXISTS "Enable read access for all users" ON events;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON events;
DROP POLICY IF EXISTS "Enable update for users based on email" ON events;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON events;

DROP POLICY IF EXISTS "Enable read access for all users" ON events_staged;
DROP POLICY IF EXISTS "Enable insert for all users" ON events_staged;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON events_staged;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON events_staged;

-- Enhanced events policies with business validation
CREATE POLICY "Enable read access for all users" ON events
FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON events
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    is_admin() AND
    -- Business rules
    title IS NOT NULL AND length(title) > 0 AND
    start_date IS NOT NULL AND start_date >= CURRENT_DATE AND
    (end_date IS NULL OR end_date >= start_date) AND
    (status IS NULL OR status IN ('pending', 'approved', 'duplicate', 'archived'))
);

CREATE POLICY "Enable update for authenticated users only" ON events
FOR UPDATE USING (
    auth.role() = 'authenticated' AND is_admin()
) WITH CHECK (
    -- Business rules
    title IS NOT NULL AND length(title) > 0 AND
    start_date IS NOT NULL AND start_date >= CURRENT_DATE AND
    (end_date IS NULL OR end_date >= start_date) AND
    (status IS NULL OR status IN ('pending', 'approved', 'duplicate', 'archived'))
);

CREATE POLICY "Enable delete for authenticated users only" ON events
FOR DELETE USING (
    auth.role() = 'authenticated' AND is_admin()
);

-- Enhanced events_staged policies with business validation
CREATE POLICY "Enable read access for all users" ON events_staged
FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON events_staged
FOR INSERT WITH CHECK (
    -- Business rules for public submissions
    title IS NOT NULL AND length(title) > 0 AND
    start_date IS NOT NULL AND start_date >= CURRENT_DATE AND
    (end_date IS NULL OR end_date >= start_date) AND
    (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$') AND
    (website IS NULL OR website ~* '^https?://') AND
    (registration_link IS NULL OR registration_link ~* '^https?://')
);

CREATE POLICY "Enable update for authenticated users only" ON events_staged
FOR UPDATE USING (
    auth.role() = 'authenticated' AND is_admin()
) WITH CHECK (
    -- Business rules
    title IS NOT NULL AND length(title) > 0 AND
    start_date IS NOT NULL AND start_date >= CURRENT_DATE AND
    (end_date IS NULL OR end_date >= start_date) AND
    (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$') AND
    (website IS NULL OR website ~* '^https?://') AND
    (registration_link IS NULL OR registration_link ~* '^https?://')
);

CREATE POLICY "Enable delete for authenticated users only" ON events_staged
FOR DELETE USING (
    auth.role() = 'authenticated' AND is_admin()
);

-- Enhanced locations policies
DROP POLICY IF EXISTS "Enable read access for all users" ON locations;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON locations;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON locations;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON locations;

CREATE POLICY "Enable read access for all users" ON locations
FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON locations
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND is_admin() AND
    name IS NOT NULL AND length(name) > 0 AND
    (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)) AND
    (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

CREATE POLICY "Enable update for authenticated users only" ON locations
FOR UPDATE USING (
    auth.role() = 'authenticated' AND is_admin()
) WITH CHECK (
    name IS NOT NULL AND length(name) > 0 AND
    (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)) AND
    (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

CREATE POLICY "Enable delete for authenticated users only" ON locations
FOR DELETE USING (
    auth.role() = 'authenticated' AND is_admin()
);

-- Enhanced organizations policies
DROP POLICY IF EXISTS "Enable read access for all users" ON organizations;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON organizations;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON organizations;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON organizations;

CREATE POLICY "Enable read access for all users" ON organizations
FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON organizations
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND is_admin() AND
    name IS NOT NULL AND length(name) > 0 AND
    (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$')
);

CREATE POLICY "Enable update for authenticated users only" ON organizations
FOR UPDATE USING (
    auth.role() = 'authenticated' AND is_admin()
) WITH CHECK (
    name IS NOT NULL AND length(name) > 0 AND
    (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$')
);

CREATE POLICY "Enable delete for authenticated users only" ON organizations
FOR DELETE USING (
    auth.role() = 'authenticated' AND is_admin()
);

-- Enhanced announcements policies
DROP POLICY IF EXISTS "Enable read access for all users" ON announcements;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON announcements;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON announcements;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON announcements;

CREATE POLICY "Enable read access for all users" ON announcements
FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON announcements
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND is_admin() AND
    title IS NOT NULL AND length(title) > 0 AND
    message IS NOT NULL AND length(message) > 0 AND
    show_at >= CURRENT_TIMESTAMP AND
    (expires_at IS NULL OR expires_at > show_at)
);

CREATE POLICY "Enable update for authenticated users only" ON announcements
FOR UPDATE USING (
    auth.role() = 'authenticated' AND is_admin()
) WITH CHECK (
    title IS NOT NULL AND length(title) > 0 AND
    message IS NOT NULL AND length(message) > 0 AND
    show_at >= CURRENT_TIMESTAMP AND
    (expires_at IS NULL OR expires_at > show_at)
);

CREATE POLICY "Enable delete for authenticated users only" ON announcements
FOR DELETE USING (
    auth.role() = 'authenticated' AND is_admin()
); 