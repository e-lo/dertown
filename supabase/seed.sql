-- Seed initial data for the Der Town platform

-- Insert default tags/categories
INSERT INTO tags (name, calendar_id, share_id) VALUES
('Community Event', NULL, NULL),
('Music', NULL, NULL),
('Art', NULL, NULL),
('Food & Drink', NULL, NULL),
('Sports & Recreation', NULL, NULL),
('Education', NULL, NULL),
('Business', NULL, NULL),
('Family', NULL, NULL),
('Technology', NULL, NULL),
('Health & Wellness', NULL, NULL),
('Volunteer', NULL, NULL),
('Fundraiser', NULL, NULL),
('Workshop', NULL, NULL),
('Meeting', NULL, NULL),
('Performance', NULL, NULL),
('Exhibition', NULL, NULL),
('Festival', NULL, NULL),
('Conference', NULL, NULL),
('Tour', NULL, NULL),
('Other', NULL, NULL)
ON CONFLICT (name) DO NOTHING;

-- Insert sample locations
INSERT INTO locations (name, address, website, phone, latitude, longitude, status) VALUES
('Derry Public Library', '64 E Broadway, Derry, NH 03038', 'https://derrypl.org', '(603) 432-6140', 42.8806, -71.3273, 'approved'),
('Derry Opera House', '29 W Broadway, Derry, NH 03038', 'https://derryoperahouse.org', '(603) 437-0505', 42.8807, -71.3278, 'approved'),
('Hood Park', 'Hood Park Dr, Derry, NH 03038', NULL, NULL, 42.8812, -71.3256, 'approved'),
('Derry Community Center', '15 Manning St, Derry, NH 03038', NULL, '(603) 432-6136', 42.8815, -71.3268, 'approved'),
('Downtown Derry', 'Broadway, Derry, NH 03038', NULL, NULL, 42.8806, -71.3273, 'approved')
ON CONFLICT DO NOTHING;

-- Insert sample organizations
INSERT INTO organizations (name, description, website, phone, email, location_id, status) VALUES
('Derry Public Library', 'The public library serving the Derry community with books, programs, and resources.', 'https://derrypl.org', '(603) 432-6140', 'info@derrypl.org', (SELECT id FROM locations WHERE name = 'Derry Public Library'), 'approved'),
('Derry Opera House', 'Historic performing arts venue in downtown Derry.', 'https://derryoperahouse.org', '(603) 437-0505', 'info@derryoperahouse.org', (SELECT id FROM locations WHERE name = 'Derry Opera House'), 'approved'),
('Derry Parks & Recreation', 'Town department managing parks, recreation programs, and community events.', NULL, '(603) 432-6136', 'parks@derrynh.gov', (SELECT id FROM locations WHERE name = 'Derry Community Center'), 'approved'),
('Derry Chamber of Commerce', 'Business organization promoting economic development in Derry.', NULL, NULL, 'info@derrychamber.org', (SELECT id FROM locations WHERE name = 'Downtown Derry'), 'approved')
ON CONFLICT DO NOTHING;

-- Insert sample announcements
INSERT INTO announcements (title, message, link, email, organization_id, author, status, show_at) VALUES
('Welcome to Der Town!', 'Discover all the amazing events happening in Derry, NH. From community gatherings to cultural performances, find your next adventure right here.', 'https://dertown.org', 'info@dertown.org', NULL, 'Der Town Team', 'published', NOW()),
('Library Summer Reading Program', 'Join us for our annual summer reading program with activities for all ages. Registration opens June 1st.', 'https://derrypl.org/summer-reading', 'info@derrypl.org', (SELECT id FROM organizations WHERE name = 'Derry Public Library'), 'Library Staff', 'published', NOW()),
('Opera House Season Tickets', 'Get your season tickets for the 2024-2025 season at the historic Derry Opera House. Amazing performances coming your way!', 'https://derryoperahouse.org/tickets', 'tickets@derryoperahouse.org', (SELECT id FROM organizations WHERE name = 'Derry Opera House'), 'Box Office', 'published', NOW())
ON CONFLICT DO NOTHING;

-- Insert sample events
INSERT INTO events (title, description, start_date, end_date, start_time, end_time, location_id, organization_id, email, website, primary_tag_id, featured, status) VALUES
('Derry Farmers Market', 'Weekly farmers market featuring local produce, crafts, and food vendors. Rain or shine!', '2024-06-15', '2024-06-15', '09:00:00', '13:00:00', (SELECT id FROM locations WHERE name = 'Downtown Derry'), (SELECT id FROM organizations WHERE name = 'Derry Chamber of Commerce'), 'market@derrychamber.org', 'https://derrychamber.org/farmers-market', (SELECT id FROM tags WHERE name = 'Community Event'), true, 'approved'),
('Summer Concert Series', 'Free outdoor concerts in Hood Park every Thursday evening. Bring a blanket and enjoy live music under the stars.', '2024-06-20', '2024-06-20', '18:00:00', '20:00:00', (SELECT id FROM locations WHERE name = 'Hood Park'), (SELECT id FROM organizations WHERE name = 'Derry Parks & Recreation'), 'concerts@derrynh.gov', NULL, (SELECT id FROM tags WHERE name = 'Music'), true, 'approved'),
('Library Book Club', 'Monthly book discussion group. This month we''re reading "The Midnight Library" by Matt Haig. New members welcome!', '2024-06-25', '2024-06-25', '19:00:00', '20:30:00', (SELECT id FROM locations WHERE name = 'Derry Public Library'), (SELECT id FROM organizations WHERE name = 'Derry Public Library'), 'bookclub@derrypl.org', 'https://derrypl.org/book-club', (SELECT id FROM tags WHERE name = 'Education'), false, 'approved'),
('Art in the Park', 'Local artists showcase their work in Hood Park. Meet the artists, view their creations, and enjoy a day of creativity.', '2024-07-06', '2024-07-06', '10:00:00', '16:00:00', (SELECT id FROM locations WHERE name = 'Hood Park'), (SELECT id FROM organizations WHERE name = 'Derry Parks & Recreation'), 'arts@derrynh.gov', NULL, (SELECT id FROM tags WHERE name = 'Art'), false, 'approved'),
('Opera House Comedy Night', 'An evening of laughter with local comedians. Cash bar available. 21+ event.', '2024-07-12', '2024-07-12', '20:00:00', '22:00:00', (SELECT id FROM locations WHERE name = 'Derry Opera House'), (SELECT id FROM organizations WHERE name = 'Derry Opera House'), 'comedy@derryoperahouse.org', 'https://derryoperahouse.org/comedy', (SELECT id FROM tags WHERE name = 'Performance'), false, 'approved')
ON CONFLICT DO NOTHING; 