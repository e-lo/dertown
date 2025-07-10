import csv
from datetime import datetime, timedelta
import random
import os
import psycopg2

# Config: adjust as needed for your local setup
DB_HOST = os.environ.get('PGHOST', 'localhost')
DB_PORT = os.environ.get('PGPORT', '54322')
DB_NAME = os.environ.get('PGDATABASE', 'postgres')
DB_USER = os.environ.get('PGUSER', 'postgres')
DB_PASS = os.environ.get('PGPASSWORD', 'postgres')

CSV_PATH = os.path.join(os.path.dirname(__file__), '../seed_data/events_local.csv')

# Read events from CSV
with open(CSV_PATH, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    events = list(reader)

print(f"Loaded {len(events)} events from {CSV_PATH}")
if events:
    print(f"First event: {events[0]}")

# Update dates to be in the next 2 weeks
today = datetime.today()
for i, event in enumerate(events):
    days_ahead = random.randint(1, 14)
    start = today + timedelta(days=days_ahead)
    end = start + timedelta(hours=2)
    event['start_date'] = start.strftime('%Y-%m-%d')
    event['end_date'] = end.strftime('%Y-%m-%d')
    event['start_time'] = start.strftime('%H:%M:%S')
    event['end_time'] = end.strftime('%H:%M:%S')

# Connect to local Postgres
conn = psycopg2.connect(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASS
)
cur = conn.cursor()

# Optional: Clear existing events (for local dev only!)
cur.execute('DELETE FROM events;')

# Insert updated events
for event in events:
    cur.execute('''
        INSERT INTO events (title, description, start_date, start_time, end_time, end_date, external_image_url, registration_link, website, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        event['title'],
        event['description'],
        event['start_date'],
        event['start_time'],
        event['end_time'],
        event['end_date'],
        event['external_image_url'],
        event['registration_link'],
        event['website'],
        event['status'],
    ))

conn.commit()
cur.close()
conn.close()

print(f"Seeded {len(events)} local events with upcoming dates!") 