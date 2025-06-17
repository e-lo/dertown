#!/usr/bin/env python3
"""
Test script to verify PostgreSQL null validators work correctly in Pydantic models.
"""

import sys
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from scripts.models import Location, Organization, Event, Announcement


def test_postgres_null_validators():
    """Test that PostgreSQL null values are properly converted to None."""
    
    print("Testing PostgreSQL null validators...")
    
    # Test Location model
    print("\n1. Testing Location model:")
    location_data = {
        'name': 'Test Location',
        'address': '\\N',  # PostgreSQL null
        'phone': '',  # Empty string
        'website': None,  # Python None
        'parent_location_id': '\\N',  # PostgreSQL null
    }
    
    try:
        location = Location(**location_data)
        print(f"  ✓ Location created successfully")
        print(f"  - address: {location.address} (should be None)")
        print(f"  - phone: {location.phone} (should be None)")
        print(f"  - website: {location.website} (should be None)")
        print(f"  - parent_location_id: {location.parent_location_id} (should be None)")
    except Exception as e:
        print(f"  ✗ Location creation failed: {e}")
    
    # Test Organization model
    print("\n2. Testing Organization model:")
    org_data = {
        'name': 'Test Organization',
        'description': '\\N',  # PostgreSQL null
        'email': '',  # Empty string
        'phone': None,  # Python None
        'location_id': '\\N',  # PostgreSQL null
    }
    
    try:
        org = Organization(**org_data)
        print(f"  ✓ Organization created successfully")
        print(f"  - description: {org.description} (should be None)")
        print(f"  - email: {org.email} (should be None)")
        print(f"  - phone: {org.phone} (should be None)")
        print(f"  - location_id: {org.location_id} (should be None)")
    except Exception as e:
        print(f"  ✗ Organization creation failed: {e}")
    
    # Test Event model
    print("\n3. Testing Event model:")
    event_data = {
        'title': 'Test Event',
        'start_date': '2024-01-01',
        'description': '\\N',  # PostgreSQL null
        'email': '',  # Empty string
        'website': None,  # Python None
        'location_id': '\\N',  # PostgreSQL null
    }
    
    try:
        event = Event(**event_data)
        print(f"  ✓ Event created successfully")
        print(f"  - description: {event.description} (should be None)")
        print(f"  - email: {event.email} (should be None)")
        print(f"  - website: {event.website} (should be None)")
        print(f"  - location_id: {event.location_id} (should be None)")
    except Exception as e:
        print(f"  ✗ Event creation failed: {e}")
    
    # Test Announcement model
    print("\n4. Testing Announcement model:")
    announcement_data = {
        'title': 'Test Announcement',
        'message': 'Test message',
        'link': '\\N',  # PostgreSQL null
        'email': '',  # Empty string
        'author': None,  # Python None
    }
    
    try:
        announcement = Announcement(**announcement_data)
        print(f"  ✓ Announcement created successfully")
        print(f"  - link: {announcement.link} (should be None)")
        print(f"  - email: {announcement.email} (should be None)")
        print(f"  - author: {announcement.author} (should be None)")
    except Exception as e:
        print(f"  ✗ Announcement creation failed: {e}")
    
    # Test with valid values
    print("\n5. Testing with valid values:")
    valid_location_data = {
        'name': 'Valid Location',
        'address': '123 Main St',
        'phone': '+1-555-123-4567',
        'website': 'https://example.com',
        'parent_location_id': 'some-uuid-here',
    }
    
    try:
        valid_location = Location(**valid_location_data)
        print(f"  ✓ Valid location created successfully")
        print(f"  - address: {valid_location.address} (should be '123 Main St')")
        print(f"  - phone: {valid_location.phone} (should be '+1-555-123-4567')")
        print(f"  - website: {valid_location.website} (should be URL)")
        print(f"  - parent_location_id: {valid_location.parent_location_id} (should be 'some-uuid-here')")
    except Exception as e:
        print(f"  ✗ Valid location creation failed: {e}")
    
    print("\n✅ PostgreSQL null validator tests completed!")


if __name__ == "__main__":
    test_postgres_null_validators() 