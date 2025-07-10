import csv
import os
import psycopg2
import datetime

DB_HOST = os.environ.get('PGHOST', 'localhost')
DB_PORT = os.environ.get('PGPORT', '54322')
DB_NAME = os.environ.get('PGDATABASE', 'postgres')
DB_USER = os.environ.get('PGUSER', 'postgres')
DB_PASS = os.environ.get('PGPASSWORD', 'postgres')

BASE_DIR = os.path.join(os.path.dirname(__file__), '../seed_data')

TABLES = [
    ('locations', 'locations.csv'),
    ('organizations', 'organizations.csv'),
    ('tags', 'tags.csv'),
    ('announcements', 'announcements.csv'),
]

# Define columns that should be NULL when empty for each table
NULLABLE_COLUMNS = {
    'locations': ['latitude', 'longitude', 'address', 'website', 'phone'],
    'organizations': ['description', 'website', 'email', 'phone'],
    'tags': ['calendar_id', 'share_id'],
    'community_announcements': ['link', 'email', 'organization_id', 'author'],
}

def clean_value(value, column_name, table_name):
    """Convert empty strings to None for nullable columns"""
    if value == '' and column_name in NULLABLE_COLUMNS.get(table_name, []):
        return None
    return value

conn = psycopg2.connect(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASS
)
cur = conn.cursor()

# Clear events table first (has foreign keys)
cur.execute('DELETE FROM events;')

for table, csv_file in TABLES:
    csv_path = os.path.join(BASE_DIR, csv_file)
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    # Clear table
    cur.execute(f'DELETE FROM {table};')
    # Insert rows
    if rows:
        columns = rows[0].keys()
        col_str = ','.join(columns)
        val_str = ','.join(['%s'] * len(columns))
        for row in rows:
            # Clean values for nullable columns
            cleaned_values = [clean_value(row[col], col, table) for col in columns]
            cur.execute(
                f'INSERT INTO {table} ({col_str}) VALUES ({val_str})',
                cleaned_values
            )
    print(f'Seeded {len(rows)} rows into {table}')

# --- Seed events table from events_local.csv ---
events_csv_path = os.path.join(BASE_DIR, 'events_local.csv')
if os.path.exists(events_csv_path):
    with open(events_csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        events = list(reader)
    # Find the earliest start_date
    date_format = '%Y-%m-%d'
    today = datetime.date.today()
    event_dates = [datetime.datetime.strptime(e['start_date'], date_format).date() for e in events if e['start_date']]
    if event_dates:
        min_date = min(event_dates)
        days_shift = (today + datetime.timedelta(days=1) - min_date).days
    else:
        days_shift = 0
    # Clear events table
    cur.execute('DELETE FROM events;')
    seeded = 0
    for event in events:
        # Look up foreign key IDs with trimmed values
        location_name = event['location'].strip() if event['location'] else None
        organization_name = event['organization'].strip() if event['organization'] else None
        primary_tag_name = event['primary_tag'].strip() if event['primary_tag'] else None
        
        cur.execute('SELECT id FROM locations WHERE name = %s', (location_name,))
        location_id = cur.fetchone()
        cur.execute('SELECT id FROM organizations WHERE name = %s', (organization_name,))
        organization_id = cur.fetchone()
        cur.execute('SELECT id FROM tags WHERE name = %s', (primary_tag_name,))
        primary_tag_id = cur.fetchone()
        
        # Only insert if all FKs are found
        if not (location_id and organization_id and primary_tag_id):
            print(f"Skipping event '{event['title']}' due to missing FK(s):")
            print(f"  location='{location_name}' -> found: {location_id}")
            print(f"  organization='{organization_name}' -> found: {organization_id}")
            print(f"  primary_tag='{primary_tag_name}' -> found: {primary_tag_id}")
            continue
        # Shift start_date and end_date
        start_date = datetime.datetime.strptime(event['start_date'], date_format).date() + datetime.timedelta(days=days_shift) if event['start_date'] else None
        end_date = datetime.datetime.strptime(event['end_date'], date_format).date() + datetime.timedelta(days=days_shift) if event['end_date'] else None
        # Prepare insert values, mapping CSV fields to DB columns
        cur.execute(
            '''INSERT INTO events (title, description, start_date, start_time, end_time, end_date, external_image_url, registration_link, website, status, location_id, organization_id, primary_tag_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
            [
                event['title'],
                event['description'],
                start_date,
                event['start_time'] or None,
                event['end_time'] or None,
                end_date,
                event['external_image_url'] or None,
                event['registration_link'] or None,
                event['website'] or None,
                event['status'] or 'approved',
                location_id[0],
                organization_id[0],
                primary_tag_id[0],
            ]
        )
        seeded += 1
    print(f'Seeded {seeded} rows into events')

conn.commit()
cur.close()
conn.close() 