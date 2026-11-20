-- Real signup dates for winter teams, so /families/sports only says
-- "Sign up now" where registration is actually open (Nov 2026), plus the
-- new Cascade Youth Wrestling program.

-- Plain Valley Nordic and Leavenworth Nordic: winter 2026–27 signups are open
UPDATE activities SET registration_opens = '2026-11-01'
WHERE id IN (
  'c71d16f6-d9da-481a-b992-08b217058e5d', -- Plain Valley Nordic Team - Winter 2027
  '5868f101-7851-4723-9852-7c7e5a92d3fd'  -- Leavenworth Nordic Team - 2027
);

-- Leavenworth Youth Basketball: signups ran Sep–Oct
INSERT INTO activities (
  name, activity_hierarchy_type, parent_activity_id, activity_type, status,
  is_winter, registration_opens, registration_closes
) VALUES (
  'Leavenworth Youth Basketball - 2026/27', 'SESSION',
  'bbc0f6ee-97fe-4420-ae44-6d1ad554f6e0', 'sports', 'approved',
  true, '2026-09-01', '2026-10-31'
);

-- Cascade Youth Wrestling (Leavenworth): K–5, season Jan 11 – Mar 17 2027,
-- sign up now through January
WITH program AS (
  INSERT INTO activities (
    name, activity_hierarchy_type, activity_type, sport, status, is_winter,
    min_grade, max_grade, min_age, max_age, cost, description, website, registration_link, email,
    start_datetime, end_datetime
  ) VALUES (
    'Cascade Youth Wrestling', 'PROGRAM', 'sports', 'Wrestling', 'approved', true,
    'K', '5', 5, 11, '$75 (includes team T-shirt)',
    'Youth wrestling for kindergarten through 5th grade. Beginners welcome. Sign up online or at the first practice.',
    'https://sites.google.com/view/cascade-youth-wrestling/home',
    'https://sites.google.com/view/cascade-youth-wrestling/registration-forms',
    'kodiakyouthwrestling@gmail.com',
    '2027-01-11', '2027-03-17'
  )
  RETURNING id
)
INSERT INTO activities (
  name, activity_hierarchy_type, parent_activity_id, activity_type, status,
  is_winter, registration_opens, registration_closes, start_datetime, end_datetime
)
SELECT
  'Cascade Youth Wrestling - Winter 2027', 'SESSION', id, 'sports', 'approved',
  true, '2026-11-01', '2027-01-31', '2027-01-11', '2027-03-17'
FROM program;
