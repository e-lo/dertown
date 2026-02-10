-- Add cancelled status to event_status enum
-- NOTE: Must be in a separate migration - PostgreSQL does not allow using
-- a newly added enum value in the same transaction (SQLSTATE 55P04)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'cancelled'
      AND enumtypid = 'public.event_status'::regtype
  ) THEN
    ALTER TYPE public.event_status ADD VALUE 'cancelled';
  END IF;
END $$;
