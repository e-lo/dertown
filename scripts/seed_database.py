#!/usr/bin/env python3
"""
Database seeding script for Der Town events platform.
Reads data from CSV files and inserts into Supabase database.
"""

import csv
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from scripts.models import (
    Announcement,
    Event,
    Location,
    Organization,
    Tag,
)
from scripts.validation import validate_csv_data
from src.lib.supabase import get_supabase_client

# Configure logging
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_admin_supabase_client():
    """Get Supabase client with service role key for admin operations."""
    import os
    from supabase import create_client, Client
    
    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set")
    
    return create_client(url, service_key)


def read_csv_data(file_path: Path) -> List[Dict]:
    """Read data from a CSV file and return as a list of dictionaries."""
    if not file_path.exists():
        logger.warning(f"CSV file not found: {file_path}")
        return []
    
    data = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Convert empty strings and \N to None for optional fields
                cleaned_row = {}
                for key, value in row.items():
                    if value == '' or value == '\\N':
                        cleaned_row[key] = None
                    else:
                        cleaned_row[key] = value
                data.append(cleaned_row)
        
        logger.info(f"Read {len(data)} rows from {file_path}")
        return data
    except Exception as e:
        logger.error(f"Error reading CSV file {file_path}: {e}")
        return []


def seed_tags(supabase) -> Dict[int, str]:
    """Seed tags and return a mapping of old IDs to new UUIDs."""
    csv_path = Path("seed_data/tags.csv")
    data = read_csv_data(csv_path)
    
    if not data:
        logger.warning("No tag data found")
        return {}
    
    # Validate data with Pydantic
    validated_tags = []
    for row in data:
        try:
            tag = Tag(
                name=row['name'],
                calendar_id=row.get('calendar_id'),
                share_id=row.get('share_id')
            )
            validated_tags.append(tag)
        except Exception as e:
            logger.error(f"Validation error for tag {row.get('name', 'unknown')}: {e}")
            continue
    
    # Insert into database
    id_mapping = {}
    for i, tag in enumerate(validated_tags):
        try:
            result = supabase.table('tags').insert({
                'name': tag.name,
                'calendar_id': tag.calendar_id,
                'share_id': tag.share_id
            }).execute()
            
            # Debug: Log the full result
            logger.info(f"Tag insert result: {result}")
            
            if result.data and len(result.data) > 0:
                try:
                    new_id = result.data[0]['id']
                    old_id = int(data[i]['id'])
                    id_mapping[old_id] = new_id
                    logger.info(f"Inserted tag: {tag.name} (ID: {new_id})")
                except (KeyError, IndexError) as e:
                    logger.warning(f"Could not extract ID from result for tag {tag.name}: {e}")
                    logger.warning(f"Result data: {result.data}")
            else:
                logger.warning(f"No data returned for tag {tag.name}")
            
        except Exception as e:
            logger.error(f"Error inserting tag {tag.name}: {e}")
            # Log more details about the error
            logger.error(f"Tag data: {tag.dict()}")
            logger.error(f"Exception type: {type(e)}")
    
    return id_mapping


def seed_locations(supabase) -> Dict[int, str]:
    """Seed locations and return a mapping of old IDs to new UUIDs."""
    csv_path = Path("seed_data/locations.csv")
    data = read_csv_data(csv_path)
    
    if not data:
        logger.warning("No location data found")
        return {}
    
    # Validate data with Pydantic
    validated_locations = []
    for row in data:
        try:
            location = Location(
                name=row['name'],
                address=row.get('address'),
                website=row.get('website'),
                phone=row.get('phone'),
                latitude=float(row['latitude']) if row.get('latitude') else None,
                longitude=float(row['longitude']) if row.get('longitude') else None,
                parent_location_id=row.get('parent_location_id'),
                status=row.get('status', 'approved')
            )
            validated_locations.append(location)
        except Exception as e:
            logger.error(f"Validation error for location {row.get('name', 'unknown')}: {e}")
            continue
    
    # Insert into database
    id_mapping = {}
    for i, location in enumerate(validated_locations):
        try:
            result = supabase.table('locations').insert({
                'name': location.name,
                'address': location.address,
                'website': str(location.website) if location.website else None,
                'phone': location.phone,
                'latitude': location.latitude,
                'longitude': location.longitude,
                'parent_location_id': location.parent_location_id,
                'status': location.status
            }).execute()
            
            # Debug: Log the full result
            logger.info(f"Location insert result: {result}")
            
            if result.data and len(result.data) > 0:
                try:
                    new_id = result.data[0]['id']
                    old_id = int(data[i]['id'])
                    id_mapping[old_id] = new_id
                    logger.info(f"Inserted location: {location.name} (ID: {new_id})")
                except (KeyError, IndexError) as e:
                    logger.warning(f"Could not extract ID from result for location {location.name}: {e}")
                    logger.warning(f"Result data: {result.data}")
            else:
                logger.warning(f"No data returned for location {location.name}")
            
        except Exception as e:
            logger.error(f"Error inserting location {location.name}: {e}")
            # Log more details about the error
            logger.error(f"Location data: {location.dict()}")
            logger.error(f"Exception type: {type(e)}")
    
    return id_mapping


def seed_organizations(supabase, location_id_mapping: Dict[int, str]) -> Dict[int, str]:
    """Seed organizations and return a mapping of old IDs to new UUIDs."""
    csv_path = Path("seed_data/organizations.csv")
    data = read_csv_data(csv_path)
    
    if not data:
        logger.warning("No organization data found")
        return {}
    
    # Validate data with Pydantic
    validated_organizations = []
    for row in data:
        try:
            # Map old location ID to new UUID if it exists
            location_id = None
            if row.get('location_id'):
                old_location_id = int(row['location_id'])
                location_id = location_id_mapping.get(old_location_id)
            
            organization = Organization(
                name=row['name'],
                description=row.get('description'),
                website=row.get('website'),
                phone=row.get('phone'),
                email=row.get('email'),
                location_id=location_id,
                parent_organization_id=row.get('parent_organization_id'),
                status=row.get('status', 'approved')
            )
            validated_organizations.append(organization)
        except Exception as e:
            logger.error(f"Validation error for organization {row.get('name', 'unknown')}: {e}")
            continue
    
    # Insert into database
    id_mapping = {}
    for i, organization in enumerate(validated_organizations):
        try:
            result = supabase.table('organizations').insert({
                'name': organization.name,
                'description': organization.description,
                'website': str(organization.website) if organization.website else None,
                'phone': organization.phone,
                'email': organization.email,
                'location_id': organization.location_id,
                'parent_organization_id': organization.parent_organization_id,
                'status': organization.status
            }).execute()
            
            if result.data and len(result.data) > 0:
                try:
                    new_id = result.data[0]['id']
                    old_id = int(data[i]['id'])
                    id_mapping[old_id] = new_id
                    logger.info(f"Inserted organization: {organization.name} (ID: {new_id})")
                except (KeyError, IndexError) as e:
                    logger.warning(f"Could not extract ID from result for organization {organization.name}: {e}")
                    logger.warning(f"Result data: {result.data}")
            else:
                logger.warning(f"No data returned for organization {organization.name}")
            
        except Exception as e:
            logger.error(f"Error inserting organization {organization.name}: {e}")
    
    return id_mapping


def seed_events(supabase, tag_id_mapping: Dict[int, str], 
                location_id_mapping: Dict[int, str], 
                organization_id_mapping: Dict[int, str]) -> Dict[int, str]:
    """Seed events and return a mapping of old IDs to new UUIDs."""
    csv_path = Path("seed_data/events.csv")
    data = read_csv_data(csv_path)
    
    if not data:
        logger.warning("No event data found")
        return {}
    
    # Validate data with Pydantic
    validated_events = []
    for row in data:
        try:
            # Map old IDs to new UUIDs
            primary_tag_id = None
            if row.get('primary_tag_id'):
                old_tag_id = int(row['primary_tag_id'])
                primary_tag_id = tag_id_mapping.get(old_tag_id)
            
            secondary_tag_id = None
            if row.get('secondary_tag_id'):
                old_tag_id = int(row['secondary_tag_id'])
                secondary_tag_id = tag_id_mapping.get(old_tag_id)
            
            location_id = None
            if row.get('location_id'):
                old_location_id = int(row['location_id'])
                location_id = location_id_mapping.get(old_location_id)
            
            organization_id = None
            if row.get('organization_id'):
                old_org_id = int(row['organization_id'])
                organization_id = organization_id_mapping.get(old_org_id)
            
            parent_event_id = None
            if row.get('parent_event_id'):
                old_event_id = int(row['parent_event_id'])
                # We'll need to handle this after all events are inserted
            
            event = Event(
                title=row['title'],
                description=row.get('description'),
                start_date=datetime.strptime(row['start_date'], '%Y-%m-%d').date(),
                end_date=datetime.strptime(row['end_date'], '%Y-%m-%d').date() if row.get('end_date') else None,
                start_time=datetime.strptime(row['start_time'], '%H:%M:%S').time() if row.get('start_time') else None,
                end_time=datetime.strptime(row['end_time'], '%H:%M:%S').time() if row.get('end_time') else None,
                location_id=location_id,
                organization_id=organization_id,
                email=row.get('email'),
                website=row.get('website'),
                registration_link=row.get('registration_link'),
                primary_tag_id=primary_tag_id,
                secondary_tag_id=secondary_tag_id,
                external_image_url=row.get('external_image_url'),
                featured=row.get('featured', 'false').lower() == 'true',
                exclude_from_calendar=row.get('exclude_from_calendar', 'false').lower() == 'true',
                google_calendar_event_id=row.get('google_calendar_event_id'),
                registration=row.get('registration_required', 'false').lower() == 'true',
                cost=row.get('fee'),
                status=row.get('status', 'approved')
            )
            validated_events.append((event, row.get('parent_event_id')))
        except Exception as e:
            logger.error(f"Validation error for event {row.get('title', 'unknown')}: {e}")
            continue
    
    # Insert into database
    id_mapping = {}
    for i, (event, parent_event_id) in enumerate(validated_events):
        try:
            result = supabase.table('events').insert({
                'title': event.title,
                'description': event.description,
                'start_date': event.start_date.isoformat(),
                'end_date': event.end_date.isoformat() if event.end_date else None,
                'start_time': event.start_time.isoformat() if event.start_time else None,
                'end_time': event.end_time.isoformat() if event.end_time else None,
                'location_id': event.location_id,
                'organization_id': event.organization_id,
                'email': event.email,
                'website': str(event.website) if event.website else None,
                'registration_link': str(event.registration_link) if event.registration_link else None,
                'primary_tag_id': event.primary_tag_id,
                'secondary_tag_id': event.secondary_tag_id,
                'external_image_url': str(event.external_image_url) if event.external_image_url else None,
                'featured': event.featured,
                'exclude_from_calendar': event.exclude_from_calendar,
                'google_calendar_event_id': event.google_calendar_event_id,
                'registration': event.registration,
                'cost': event.cost,
                'status': event.status
            }).execute()
            
            if result.data and len(result.data) > 0:
                try:
                    new_id = result.data[0]['id']
                    old_id = int(data[i]['id'])
                    id_mapping[old_id] = new_id
                    logger.info(f"Inserted event: {event.title} (ID: {new_id})")
                except (KeyError, IndexError) as e:
                    logger.warning(f"Could not extract ID from result for event {event.title}: {e}")
                    logger.warning(f"Result data: {result.data}")
            else:
                logger.warning(f"No data returned for event {event.title}")
            
        except Exception as e:
            logger.error(f"Error inserting event {event.title}: {e}")
    
    # Update parent_event_id references
    for i, (event, parent_event_id) in enumerate(validated_events):
        if parent_event_id:
            old_parent_id = int(parent_event_id)
            new_parent_id = id_mapping.get(old_parent_id)
            if new_parent_id:
                old_event_id = int(data[i]['id'])
                new_event_id = id_mapping.get(old_event_id)
                if new_event_id:
                    try:
                        supabase.table('events').update({
                            'parent_event_id': new_parent_id
                        }).eq('id', new_event_id).execute()
                        logger.info(f"Updated parent event reference for {event.title}")
                    except Exception as e:
                        logger.error(f"Error updating parent event reference for {event.title}: {e}")
    
    return id_mapping


def seed_community_announcements(supabase, organization_id_mapping: Dict[int, str]):
    """Seed community announcements."""
    csv_path = Path("seed_data/community_announcements.csv")
    data = read_csv_data(csv_path)
    
    if not data:
        logger.warning("No community announcement data found")
        return
    
    # Validate data with Pydantic
    validated_announcements = []
    for row in data:
        try:
            # Map old organization ID to new UUID if it exists
            organization_id = None
            if row.get('organization_id'):
                old_org_id = int(row['organization_id'])
                organization_id = organization_id_mapping.get(old_org_id)
            
            announcement = Announcement(
                title=row['title'],
                message=row['message'],
                link=row.get('link'),
                email=row.get('email'),
                organization_id=organization_id,
                author=row.get('author'),
                active=row.get('active', 'true').lower() == 'true'
            )
            validated_announcements.append(announcement)
        except Exception as e:
            logger.error(f"Validation error for announcement {row.get('title', 'unknown')}: {e}")
            continue
    
    # Insert into database
    for announcement in validated_announcements:
        try:
            result = supabase.table('community_announcements').insert({
                'title': announcement.title,
                'message': announcement.message,
                'link': str(announcement.link) if announcement.link else None,
                'email': announcement.email,
                'organization_id': announcement.organization_id,
                'author': announcement.author,
                'active': announcement.active
            }).execute()
            
            if result.data:
                logger.info(f"Inserted announcement: {announcement.title}")
            
        except Exception as e:
            logger.error(f"Error inserting announcement {announcement.title}: {e}")


def main():
    """Main seeding function."""
    logger.info("Starting database seeding...")
    
    # Get Supabase client
    supabase = get_admin_supabase_client()
    
    try:
        # Seed data in order (respecting foreign key constraints)
        logger.info("Seeding tags...")
        tag_id_mapping = seed_tags(supabase)
        
        logger.info("Seeding locations...")
        location_id_mapping = seed_locations(supabase)
        
        logger.info("Seeding organizations...")
        organization_id_mapping = seed_organizations(supabase, location_id_mapping)
        
        logger.info("Seeding events...")
        event_id_mapping = seed_events(supabase, tag_id_mapping, location_id_mapping, organization_id_mapping)
        
        logger.info("Seeding community announcements...")
        seed_community_announcements(supabase, organization_id_mapping)
        
        logger.info("Database seeding completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during seeding: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 