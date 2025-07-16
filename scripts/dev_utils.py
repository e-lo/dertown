#!/usr/bin/env python3
"""
Der Town Development Utilities
Minimal Python utilities for rapid development iteration
"""

import os
import sys
import csv
from pathlib import Path
from typing import Dict, List, Any
import json

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from supabase import create_client, Client
    from scripts.models import Event, Organization, Location, Tag, Announcement
except ImportError as e:
    print(f"Import error: {e}")
    print("Please install required dependencies: pip install supabase pydantic")
    sys.exit(1)


def get_supabase_client() -> Client:
    """Get Supabase client for database operations."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_KEY environment variables required")
        print("Please check your .env file")
        sys.exit(1)
    
    return create_client(url, key)


def reset_dev_db():
    """Reset local database with sample data."""
    print("Resetting development database...")
    
    # This would typically call supabase db reset
    # For now, we'll just clear existing data and seed
    client = get_supabase_client()
    
    try:
        # Clear existing data (in reverse dependency order)
        client.table("events").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        client.table("announcements").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        client.table("organizations").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        client.table("locations").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        client.table("tags").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        
        print("Database reset complete")
        
    except Exception as e:
        print(f"Error resetting database: {e}")
        sys.exit(1)


def seed_test_data():
    """Seed database with test data for development."""
    print("Seeding database with test data...")
    
    client = get_supabase_client()
    
    try:
        # Create sample tags
        tags_data = [
            {"name": "Community", "calendar_id": "community_calendar_id", "share_id": "community_share_id"},
            {"name": "Arts & Culture", "calendar_id": "arts_calendar_id", "share_id": "arts_share_id"},
            {"name": "Sports & Recreation", "calendar_id": "sports_calendar_id", "share_id": "sports_share_id"},
            {"name": "Education", "calendar_id": "education_calendar_id", "share_id": "education_share_id"},
        ]
        
        for tag_data in tags_data:
            client.table("tags").insert(tag_data).execute()
        
        # Create sample locations
        locations_data = [
            {
                "name": "Community Center",
                "address": "123 Main St, Der Town, WA 98826",
                "website": "https://communitycenter.example.com",
                "phone": "(509) 555-0100",
                "latitude": 47.6062,
                "longitude": -122.3321,
                "status": "approved"
            },
            {
                "name": "Public Library",
                "address": "456 Oak Ave, Der Town, WA 98826",
                "website": "https://library.example.com",
                "phone": "(509) 555-0200",
                "latitude": 47.6063,
                "longitude": -122.3322,
                "status": "approved"
            },
        ]
        
        for location_data in locations_data:
            client.table("locations").insert(location_data).execute()
        
        # Create sample organizations
        organizations_data = [
            {
                "name": "Der Town Community Association",
                "description": "Local community organization promoting events and activities",
                "website": "https://dertown.org",
                "phone": "(509) 555-0300",
                "email": "info@dertown.org",
                "status": "approved"
            },
            {
                "name": "Arts Council",
                "description": "Promoting arts and culture in Der Town",
                "website": "https://arts.dertown.org",
                "phone": "(509) 555-0400",
                "email": "arts@dertown.org",
                "status": "approved"
            },
        ]
        
        for org_data in organizations_data:
            client.table("organizations").insert(org_data).execute()
        
        # Create sample events
        events_data = [
            {
                "title": "Community Picnic",
                "description": "Annual community picnic in the park",
                "start_date": "2024-07-15",
                "end_date": "2024-07-15",
                "start_time": "12:00:00",
                "end_time": "16:00:00",
                "email": "picnic@dertown.org",
                "website": "https://picnic.dertown.org",
                "featured": True,
                "registration": False,
                "cost": "Free",
                "status": "approved"
            },
            {
                "title": "Art Walk",
                "description": "Monthly art walk featuring local artists",
                "start_date": "2024-06-20",
                "end_date": "2024-06-20",
                "start_time": "18:00:00",
                "end_time": "21:00:00",
                "email": "artwalk@dertown.org",
                "website": "https://artwalk.dertown.org",
                "featured": True,
                "registration": False,
                "cost": "Free",
                "status": "approved"
            },
        ]
        
        for event_data in events_data:
            client.table("events").insert(event_data).execute()
        
        # Create sample announcements
        announcements_data = [
            {
                "title": "Welcome to Der Town Events",
                "message": "Find all the latest community events and activities here!",
                "status": "published",
                "show_at": "2024-01-01T00:00:00Z"
            },
            {
                "title": "New Event Submission Feature",
                "message": "Community members can now submit events for review",
                "status": "published",
                "show_at": "2024-01-01T00:00:00Z"
            },
        ]
        
        for announcement_data in announcements_data:
            client.table("announcements").insert(announcement_data).execute()
        
        print("Test data seeding complete")
        
    except Exception as e:
        print(f"Error seeding test data: {e}")
        sys.exit(1)


def validate_csv(file_path: str) -> bool:
    """Basic CSV validation - check required fields."""
    print(f"Validating CSV file: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found")
        return False
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            
            if not headers:
                print("Error: CSV file has no headers")
                return False
            
            # Basic validation - check for required fields based on file type
            filename = os.path.basename(file_path).lower()
            
            if 'events' in filename:
                required_fields = ['title', 'start_date']
            elif 'organizations' in filename:
                required_fields = ['name']
            elif 'locations' in filename:
                required_fields = ['name', 'address']
            else:
                required_fields = []
            
            missing_fields = [field for field in required_fields if field not in headers]
            
            if missing_fields:
                print(f"Error: Missing required fields: {missing_fields}")
                return False
            
            # Check for empty rows
            row_count = 0
            for row in reader:
                row_count += 1
                if not any(row.values()):  # Empty row
                    print(f"Warning: Empty row at line {row_count + 1}")
            
            print(f"CSV validation complete: {row_count} rows processed")
            return True
            
    except Exception as e:
        print(f"Error validating CSV: {e}")
        return False


def main():
    """Main entry point for development utilities."""
    if len(sys.argv) < 2:
        print("Usage: python scripts/dev_utils.py <command>")
        print("Commands:")
        print("  reset    - Reset database with sample data")
        print("  seed     - Seed database with test data")
        print("  validate <file> - Validate CSV file")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "reset":
        reset_dev_db()
        seed_test_data()
    elif command == "seed":
        seed_test_data()
    elif command == "validate":
        if len(sys.argv) < 3:
            print("Error: validate command requires a file path")
            sys.exit(1)
        file_path = sys.argv[2]
        success = validate_csv(file_path)
        sys.exit(0 if success else 1)
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main() 