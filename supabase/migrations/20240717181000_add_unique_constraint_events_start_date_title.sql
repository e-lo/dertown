-- Migration: Enforce unique (start_date, title) in events table
ALTER TABLE events
ADD CONSTRAINT events_start_date_title_unique UNIQUE (start_date, title); 