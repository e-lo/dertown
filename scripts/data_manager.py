#!/usr/bin/env python3
"""
Enhanced Data Management Script for Der Town
Provides CSV validation, test data generation, backup/restore, and duplicate detection.
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
import random
import uuid

# Add the scripts directory to the path so we can import other modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from supabase import create_client, Client
    from models import Event, Location, Organization, Tag, Announcement
except ImportError as e:
    print(f"Error importing required modules: {e}")
    print("Please install required dependencies: pip install supabase pydantic")
    sys.exit(1)


class DataManager:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL', 'http://127.0.0.1:54321')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY', 'your-anon-key-here')
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Sample data for realistic test data generation
        self.sample_locations = [
            "Derry Public Library", "Derry Community Center", "Derry Town Hall",
            "Derry High School", "Derry Elementary School", "Derry Recreation Center",
            "Derry Historical Society", "Derry Farmers Market", "Derry Town Common",
            "Derry Senior Center", "Derry Fire Station", "Derry Police Station"
        ]
        
        self.sample_organizations = [
            "Derry Community Association", "Derry Historical Society", "Derry Public Library",
            "Derry Recreation Department", "Derry School District", "Derry Chamber of Commerce",
            "Derry Rotary Club", "Derry Lions Club", "Derry Garden Club", "Derry Arts Council",
            "Derry Conservation Commission", "Derry Planning Board"
        ]
        
        self.sample_tags = [
            "Community", "Education", "Entertainment", "Family", "Health & Wellness",
            "History", "Music", "Sports", "Technology", "Volunteer", "Youth", "Senior"
        ]
        
        self.sample_event_titles = [
            "Community Meeting", "Book Club", "Art Workshop", "Fitness Class",
            "Historical Lecture", "Music Concert", "Sports Tournament", "Technology Workshop",
            "Volunteer Day", "Youth Program", "Senior Social", "Garden Tour",
            "Farmers Market", "Holiday Celebration", "Educational Seminar"
        ]

    def validate_csv(self, file_path: str, entity_type: str) -> Dict[str, Any]:
        """Validate CSV file with detailed error reporting."""
        errors = []
        warnings = []
        row_count = 0
        
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                
                # Define required fields for each entity type
                required_fields = {
                    'events': ['title', 'start_date'],
                    'locations': ['name'],
                    'organizations': ['name'],
                    'tags': ['name'],
                    'announcements': ['title', 'message']
                }
                
                required = required_fields.get(entity_type, [])
                
                for row_num, row in enumerate(reader, 1):
                    row_count += 1
                    
                    # Check required fields
                    for field in required:
                        if not row.get(field) or row[field].strip() == '':
                            errors.append(f"Row {row_num}: Missing required field '{field}'")
                    
                    # Validate specific fields based on entity type
                    if entity_type == 'events':
                        self._validate_event_row(row, row_num, errors, warnings)
                    elif entity_type == 'locations':
                        self._validate_location_row(row, row_num, errors, warnings)
                    elif entity_type == 'organizations':
                        self._validate_organization_row(row, row_num, errors, warnings)
                
        except FileNotFoundError:
            errors.append(f"File not found: {file_path}")
        except Exception as e:
            errors.append(f"Error reading file: {str(e)}")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'row_count': row_count
        }

    def _validate_event_row(self, row: Dict[str, str], row_num: int, errors: List[str], warnings: List[str]):
        """Validate event-specific fields."""
        # Validate date format
        if row.get('start_date'):
            try:
                datetime.strptime(row['start_date'], '%Y-%m-%d')
            except ValueError:
                errors.append(f"Row {row_num}: Invalid start_date format '{row['start_date']}'. Use YYYY-MM-DD")
        
        if row.get('end_date'):
            try:
                datetime.strptime(row['end_date'], '%Y-%m-%d')
            except ValueError:
                errors.append(f"Row {row_num}: Invalid end_date format '{row['end_date']}'. Use YYYY-MM-DD")
        
        # Validate time format
        if row.get('start_time'):
            try:
                datetime.strptime(row['start_time'], '%H:%M')
            except ValueError:
                errors.append(f"Row {row_num}: Invalid start_time format '{row['start_time']}'. Use HH:MM")
        
        if row.get('end_time'):
            try:
                datetime.strptime(row['end_time'], '%H:%M')
            except ValueError:
                errors.append(f"Row {row_num}: Invalid end_time format '{row['end_time']}'. Use HH:MM")
        
        # Validate URL fields
        for url_field in ['website', 'registration_link', 'external_image_url']:
            if row.get(url_field) and not row[url_field].startswith(('http://', 'https://')):
                warnings.append(f"Row {row_num}: {url_field} may not be a valid URL: {row[url_field]}")

    def _validate_location_row(self, row: Dict[str, str], row_num: int, errors: List[str], warnings: List[str]):
        """Validate location-specific fields."""
        # Validate coordinates
        for coord_field in ['latitude', 'longitude']:
            if row.get(coord_field):
                try:
                    coord = float(row[coord_field])
                    if coord_field == 'latitude' and (coord < -90 or coord > 90):
                        errors.append(f"Row {row_num}: Invalid latitude value {coord}. Must be between -90 and 90")
                    elif coord_field == 'longitude' and (coord < -180 or coord > 180):
                        errors.append(f"Row {row_num}: Invalid longitude value {coord}. Must be between -180 and 180")
                except ValueError:
                    errors.append(f"Row {row_num}: Invalid {coord_field} value '{row[coord_field]}'. Must be a number")

    def _validate_organization_row(self, row: Dict[str, str], row_num: int, errors: List[str], warnings: List[str]):
        """Validate organization-specific fields."""
        # Validate email format
        if row.get('email') and '@' not in row['email']:
            warnings.append(f"Row {row_num}: email may not be valid: {row['email']}")

    def generate_test_data(self, count: int = 50) -> None:
        """Generate realistic test data."""
        print(f"Generating {count} realistic test events...")
        
        # First, ensure we have some basic data
        self._ensure_basic_data()
        
        # Generate events
        events_created = 0
        for i in range(count):
            try:
                event_data = self._generate_realistic_event()
                result = self.supabase.table('events_staged').insert(event_data).execute()
                if result.data:
                    events_created += 1
                    if events_created % 10 == 0:
                        print(f"Created {events_created} events...")
            except Exception as e:
                print(f"Error creating event {i+1}: {e}")
        
        print(f"Successfully created {events_created} test events in events_staged table")

    def _ensure_basic_data(self) -> None:
        """Ensure basic locations, organizations, and tags exist."""
        # Create sample locations
        for location_name in self.sample_locations[:5]:
            try:
                self.supabase.table('locations').upsert({
                    'name': location_name,
                    'status': 'approved'
                }).execute()
            except Exception:
                pass  # Location might already exist
        
        # Create sample organizations
        for org_name in self.sample_organizations[:5]:
            try:
                self.supabase.table('organizations').upsert({
                    'name': org_name,
                    'status': 'approved'
                }).execute()
            except Exception:
                pass  # Organization might already exist
        
        # Create sample tags
        for tag_name in self.sample_tags[:8]:
            try:
                self.supabase.table('tags').upsert({
                    'name': tag_name
                }).execute()
            except Exception:
                pass  # Tag might already exist

    def _generate_realistic_event(self) -> Dict[str, Any]:
        """Generate a single realistic event."""
        # Get existing data for relationships
        locations = self.supabase.table('locations').select('id').eq('status', 'approved').execute()
        organizations = self.supabase.table('organizations').select('id').eq('status', 'approved').execute()
        tags = self.supabase.table('tags').select('id').execute()
        
        # Generate random dates (next 3 months)
        start_date = datetime.now() + timedelta(days=random.randint(1, 90))
        end_date = start_date + timedelta(days=random.randint(0, 7))
        
        # Generate random times (9 AM to 9 PM)
        start_hour = random.randint(9, 21)
        start_minute = random.choice([0, 15, 30, 45])
        start_time = f"{start_hour:02d}:{start_minute:02d}"
        
        # 50% chance of having an end time
        end_time = None
        if random.choice([True, False]):
            end_hour = min(22, start_hour + random.randint(1, 4))
            end_minute = random.choice([0, 15, 30, 45])
            end_time = f"{end_hour:02d}:{end_minute:02d}"
        
        event_data = {
            'title': f"{random.choice(self.sample_event_titles)} #{random.randint(1, 100)}",
            'description': f"This is a sample event description for testing purposes. Event #{random.randint(1, 1000)}",
            'start_date': start_date.strftime('%Y-%m-%d'),
            'start_time': start_time,
            'end_date': end_date.strftime('%Y-%m-%d') if end_date != start_date else None,
            'end_time': end_time,
            'cost': random.choice(['Free', '$5', '$10', '$15', 'Donation', 'Members Only']),
            'website': f"https://example.com/event-{random.randint(1, 1000)}" if random.choice([True, False]) else None,
            'registration': random.choice([True, False]),
            'registration_link': f"https://example.com/register-{random.randint(1, 1000)}" if random.choice([True, False]) else None,
            'email': f"contact{random.randint(1, 1000)}@example.com" if random.choice([True, False]) else None,
            'external_image_url': f"https://picsum.photos/400/300?random={random.randint(1, 1000)}" if random.choice([True, False]) else None,
            'featured': random.choice([True, False, False, False]),  # 25% chance of being featured
            'status': 'pending',
            'submitted_at': datetime.now().isoformat()
        }
        
        # Add relationships if data exists
        if locations.data:
            event_data['location_id'] = random.choice(locations.data)['id']
        
        if organizations.data:
            event_data['organization_id'] = random.choice(organizations.data)['id']
        
        if tags.data:
            event_data['primary_tag_id'] = random.choice(tags.data)['id']
            if random.choice([True, False]) and len(tags.data) > 1:
                event_data['secondary_tag_id'] = random.choice([t for t in tags.data if t['id'] != event_data['primary_tag_id']])['id']
        
        return event_data

    def backup_database(self, backup_dir: str = "backups") -> str:
        """Create a backup of the current database state."""
        os.makedirs(backup_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(backup_dir, f"db_backup_{timestamp}.sql")
        
        try:
            # This would require Supabase CLI or direct database access
            # For now, we'll create a JSON backup of the data
            backup_data = {
                'timestamp': timestamp,
                'events': self.supabase.table('events').select('*').execute().data,
                'events_staged': self.supabase.table('events_staged').select('*').execute().data,
                'locations': self.supabase.table('locations').select('*').execute().data,
                'organizations': self.supabase.table('organizations').select('*').execute().data,
                'tags': self.supabase.table('tags').select('*').execute().data,
                'announcements': self.supabase.table('announcements').select('*').execute().data,
            }
            
            with open(backup_file.replace('.sql', '.json'), 'w') as f:
                json.dump(backup_data, f, indent=2, default=str)
            
            print(f"Database backup created: {backup_file.replace('.sql', '.json')}")
            return backup_file.replace('.sql', '.json')
            
        except Exception as e:
            print(f"Error creating backup: {e}")
            return ""

    def detect_duplicates(self, entity_type: str = 'events') -> List[Dict[str, Any]]:
        """Detect exact duplicates in the database."""
        duplicates = []
        
        try:
            if entity_type == 'events':
                # Get all events and check for exact title matches
                events = self.supabase.table('events').select('*').execute().data
                staged_events = self.supabase.table('events_staged').select('*').execute().data
                all_events = events + staged_events
                
                title_counts = {}
                for event in all_events:
                    title = event.get('title', '').strip().lower()
                    if title in title_counts:
                        title_counts[title].append(event)
                    else:
                        title_counts[title] = [event]
                
                # Find duplicates
                for title, event_list in title_counts.items():
                    if len(event_list) > 1:
                        duplicates.append({
                            'type': 'title_duplicate',
                            'value': title,
                            'count': len(event_list),
                            'events': event_list
                        })
            
            elif entity_type == 'locations':
                locations = self.supabase.table('locations').select('*').execute().data
                name_counts = {}
                for location in locations:
                    name = location.get('name', '').strip().lower()
                    if name in name_counts:
                        name_counts[name].append(location)
                    else:
                        name_counts[name] = [location]
                
                for name, location_list in name_counts.items():
                    if len(location_list) > 1:
                        duplicates.append({
                            'type': 'name_duplicate',
                            'value': name,
                            'count': len(location_list),
                            'locations': location_list
                        })
            
            elif entity_type == 'organizations':
                organizations = self.supabase.table('organizations').select('*').execute().data
                name_counts = {}
                for org in organizations:
                    name = org.get('name', '').strip().lower()
                    if name in name_counts:
                        name_counts[name].append(org)
                    else:
                        name_counts[name] = [org]
                
                for name, org_list in name_counts.items():
                    if len(org_list) > 1:
                        duplicates.append({
                            'type': 'name_duplicate',
                            'value': name,
                            'count': len(org_list),
                            'organizations': org_list
                        })
        
        except Exception as e:
            print(f"Error detecting duplicates: {e}")
        
        return duplicates

    def cleanup_data(self) -> None:
        """Clean up old or invalid data."""
        print("Cleaning up data...")
        
        try:
            # Remove old staged events (older than 30 days)
            thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
            result = self.supabase.table('events_staged').delete().lt('submitted_at', thirty_days_ago).execute()
            print(f"Removed {len(result.data) if result.data else 0} old staged events")
            
            # Remove expired announcements
            result = self.supabase.table('announcements').delete().lt('expires_at', datetime.now().isoformat()).not_.is_('expires_at', 'null').execute()
            print(f"Removed {len(result.data) if result.data else 0} expired announcements")
            
        except Exception as e:
            print(f"Error during cleanup: {e}")


def main():
    parser = argparse.ArgumentParser(description='Der Town Data Management Tool')
    parser.add_argument('command', choices=[
        'validate-csv', 'generate-test-data', 'backup', 'detect-duplicates', 'cleanup'
    ], help='Command to execute')
    parser.add_argument('--file', help='CSV file to validate (for validate-csv)')
    parser.add_argument('--entity-type', choices=['events', 'locations', 'organizations', 'tags', 'announcements'], 
                       help='Entity type for validation or duplicate detection')
    parser.add_argument('--count', type=int, default=50, help='Number of test events to generate')
    parser.add_argument('--backup-dir', default='backups', help='Backup directory')
    
    args = parser.parse_args()
    
    manager = DataManager()
    
    if args.command == 'validate-csv':
        if not args.file or not args.entity_type:
            print("Error: --file and --entity-type are required for validate-csv")
            sys.exit(1)
        
        result = manager.validate_csv(args.file, args.entity_type)
        if result['valid']:
            print(f"✅ CSV validation passed! {result['row_count']} rows processed.")
            if result['warnings']:
                print("\n⚠️  Warnings:")
                for warning in result['warnings']:
                    print(f"  - {warning}")
        else:
            print(f"❌ CSV validation failed! {len(result['errors'])} errors found.")
            print("\nErrors:")
            for error in result['errors']:
                print(f"  - {error}")
            sys.exit(1)
    
    elif args.command == 'generate-test-data':
        manager.generate_test_data(args.count)
    
    elif args.command == 'backup':
        backup_file = manager.backup_database(args.backup_dir)
        if backup_file:
            print(f"✅ Backup completed: {backup_file}")
        else:
            print("❌ Backup failed")
            sys.exit(1)
    
    elif args.command == 'detect-duplicates':
        if not args.entity_type:
            print("Error: --entity-type is required for detect-duplicates")
            sys.exit(1)
        
        duplicates = manager.detect_duplicates(args.entity_type)
        if duplicates:
            print(f"Found {len(duplicates)} duplicate groups:")
            for dup in duplicates:
                print(f"  - {dup['type']}: '{dup['value']}' ({dup['count']} instances)")
        else:
            print("No duplicates found!")
    
    elif args.command == 'cleanup':
        manager.cleanup_data()


if __name__ == '__main__':
    main() 