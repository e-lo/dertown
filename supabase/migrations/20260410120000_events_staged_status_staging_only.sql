-- Staged rows are never "published". Only public.events uses status = approved.
-- Normalize mistaken values (e.g. admin modal used to write approved on events_staged),
-- then forbid approved/published and any other non-staging status at the database level.
UPDATE public.events_staged
SET status = 'pending'
WHERE status IS NULL
   OR status NOT IN ('pending', 'duplicate', 'archived', 'cancelled');

ALTER TABLE public.events_staged
  ADD CONSTRAINT events_staged_status_staging_only
  CHECK (status IN ('pending', 'duplicate', 'archived', 'cancelled'));

COMMENT ON CONSTRAINT events_staged_status_staging_only ON public.events_staged IS
  'Staged workflow only: pending (queue), duplicate/archived/cancelled (rejected). Never approved — that lives on public.events.';
