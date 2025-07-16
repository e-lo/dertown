import psycopg2
import os
from datetime import datetime, timedelta
import uuid

conn = psycopg2.connect(os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:54322/postgres'))
cur = conn.cursor()

# Seed events_staged
cur.execute("DELETE FROM events_staged;")
events = [
    (str(uuid.uuid4()), 'Staged Event 1', 'This is a staged event for review.', datetime.now() + timedelta(days=2)),
    (str(uuid.uuid4()), 'Staged Event 2', 'Another staged event for review.', datetime.now() + timedelta(days=5)),
]
for eid, title, desc, start in events:
    cur.execute("INSERT INTO events_staged (id, title, description, start_date, start_time, status) VALUES (%s, %s, %s, %s, %s, %s)",
                (eid, title, desc, start.date(), start.time(), 'pending'))

# Seed announcements_staged
cur.execute("DELETE FROM announcements_staged;")
announcements = [
    (str(uuid.uuid4()), 'Staged Announcement 1', 'This is a staged announcement for review.'),
    (str(uuid.uuid4()), 'Staged Announcement 2', 'Another staged announcement for review.'),
]
for aid, title, msg in announcements:
    cur.execute("INSERT INTO announcements_staged (id, title, message) VALUES (%s, %s, %s)", (aid, title, msg))

conn.commit()
cur.close()
conn.close()
print('Seeded staged events and announcements.') 