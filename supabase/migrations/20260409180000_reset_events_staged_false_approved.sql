-- Fix rows where the admin edit modal set events_staged.status = 'approved' without inserting
-- into public.events. Those rows disappeared from the review queue (pending-only fetch) but
-- never became real events. Reset them to pending so they show again and can be approved properly.
UPDATE public.events_staged
SET status = 'pending'
WHERE status = 'approved';
