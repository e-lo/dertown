#!/usr/bin/env python3
"""
Transform CSV data to match our data model and upload to Supabase.

This script reads CSV files from seed_data/, transforms them to match our Pydantic models,
and uploads them to the Supabase database.
"""

import csv
import os
import sys
from datetime import datetime, date, time
from pathlib import Path
from typing import Dict, List, Optional, Any
import uuid

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from scripts.models import (
    Location,
    Organization,
    Tag,
    Event,
    Announcement,
    EventStatus,
    AnnouncementStatus,
)
from src.lib.supabase import get_supabase_client

# Configure logging
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_max_id(supabase, table_name: str) -> int:
    """Get the maximum ID from a table."""
    try:
        result = supabase.table(table_name).select('id').order('id', desc=True).limit(1).execute()
        if result.data:
            return int(result.data[0]['id'])
        return 0
    except Exception as e:
        logger.warning(f"Could not get max ID from {table_name}: {e}")
        return 0


def transform_locations(csv_path: Path, start_id: int) -> tuple[List[Dict[str, Any]], Dict[str, str]]:
    """Transform locations CSV to match our model."""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    locations = []
    id_mapping = {}
    
    # Add null mappings
    id_mapping["location:\\N"] = None
    id_mapping["location:"] = None  # For empty strings
    
    for i, row in enumerate(rows, 1):
        row = dict(row)
        original_id = row.get('id', str(i))
        final_id = str(start_id + i)
        row['id'] = final_id
        id_mapping[f"location:{original_id}"] = final_id
        
        try:
            location = Location(**row)
            locations.append(location.model_dump())
        except Exception as e:
            logger.error(f"Invalid location data: {e}")
            continue
    
    return locations, id_mapping


def transform_organizations(csv_path: Path, start_id: int) -> tuple[List[Dict[str, Any]], Dict[str, str]]:
    """Transform organizations CSV to match our model."""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    organizations = []
    id_mapping = {}
    
    # Add null mappings
    id_mapping["organization:\\N"] = None
    id_mapping["organization:"] = None  # For empty strings
    
    for i, row in enumerate(rows, 1):
        row = dict(row)
        original_id = row.get('id', str(i))
        final_id = str(start_id + i)
        row['id'] = final_id
        id_mapping[f"organization:{original_id}"] = final_id
        
        try:
            organization = Organization(**row)
            organizations.append(organization.model_dump())
        except Exception as e:
            logger.error(f"Invalid organization data: {e}")
            continue
    
    return organizations, id_mapping


def transform_tags(csv_path: Path, start_id: int) -> tuple[List[Dict[str, Any]], Dict[str, str]]:
    """Transform tags CSV to match our model."""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    tags = []
    id_mapping = {}
    
    # Add null mappings
    id_mapping["tag:\\N"] = None
    id_mapping["tag:"] = None  # For empty strings
    
    for i, row in enumerate(rows, 1):
        row = dict(row)
        original_id = row.get('id', str(i))
        final_id = str(start_id + i)
        row['id'] = final_id
        id_mapping[f"tag:{original_id}"] = final_id
        
        try:
            tag = Tag(**row)
            tags.append(tag.model_dump())
        except Exception as e:
            logger.error(f"Invalid tag data: {e}")
            continue
    
    return tags, id_mapping


def transform_events(csv_path: Path, location_id_mapping: Dict[str, str], 
                    organization_id_mapping: Dict[str, str], 
                    tag_id_mapping: Dict[str, str], start_id: int) -> tuple[List[Dict[str, Any]], Dict[str, str]]:
    """Transform events CSV to match our model."""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    events = []
    id_mapping = {}
    
    # Add null mappings
    id_mapping["event:\\N"] = None
    id_mapping["event:"] = None  # For empty strings
    
    for i, row in enumerate(rows, 1):
        row = dict(row)
        original_id = row.get('id', str(i))
        final_id = str(start_id + i)
        row['id'] = final_id
        id_mapping[f"event:{original_id}"] = final_id
        
        # Map foreign keys to final IDs (handle empty strings)
        row['location_id'] = location_id_mapping.get(f"location:{row.get('location_id') or ''}")
        row['organization_id'] = organization_id_mapping.get(f"organization:{row.get('organization_id') or ''}")
        row['primary_tag_id'] = tag_id_mapping.get(f"tag:{row.get('primary_tag_id') or ''}")
        row['secondary_tag_id'] = tag_id_mapping.get(f"tag:{row.get('secondary_tag_id') or ''}")
        
        try:
            event = Event(**row)
            events.append(event.model_dump())
        except Exception as e:
            logger.error(f"Invalid event data: {e}")
            continue
    
    return events, id_mapping


def transform_announcements(csv_path: Path, organization_id_mapping: Dict[str, str], start_id: int) -> List[Dict[str, Any]]:
    """Transform announcements CSV to match our model."""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    announcements = []
    
    for i, row in enumerate(rows, 1):
        row = dict(row)
        final_id = str(start_id + i)
        row['id'] = final_id
        
        # Map organization ID to final ID (handle empty strings)
        row['organization_id'] = organization_id_mapping.get(f"organization:{row.get('organization_id') or ''}")
        
        # Handle status
        row['status'] = 'published' if row.get('active') == 't' else 'pending'
        
        # Set show_at to current time if not provided
        row['show_at'] = row.get('show_at', datetime.now())
        
        try:
            announcement = Announcement(**row)
            announcements.append(announcement.model_dump())
        except Exception as e:
            logger.error(f"Invalid announcement data: {e}")
            continue
    
    return announcements


def upload_to_supabase(table_name: str, data: List[Dict[str, Any]], supabase) -> bool:
    """Upload data to Supabase."""
    if not data:
        logger.warning(f"No data to upload for {table_name}")
        return False
    
    try:
        result = supabase.table(table_name).insert(data).execute()
        
        if result.data:
            logger.info(f"Successfully uploaded {len(result.data)} rows to {table_name}")
            return True
        else:
            logger.error(f"No data returned from {table_name} upload")
            return False
            
    except Exception as e:
        logger.error(f"Error uploading to {table_name}: {e}")
        return False


def main():
    """Main function to transform and upload all data."""
    logger.info("Starting data transformation and upload...")
    
    # Get Supabase client
    supabase = get_supabase_client()
    
    # Define paths
    seed_data_dir = project_root / "seed_data"
    
    try:
        # Get current max IDs from all tables
        locations_max_id = get_max_id(supabase, 'locations')
        organizations_max_id = get_max_id(supabase, 'organizations')
        tags_max_id = get_max_id(supabase, 'tags')
        events_max_id = get_max_id(supabase, 'events')
        announcements_max_id = get_max_id(supabase, 'announcements')
        
        # Transform and upload in order (respecting foreign key constraints)
        
        # 1. Upload locations
        logger.info("Transforming and uploading locations...")
        locations, location_id_mapping = transform_locations(seed_data_dir / "locations.csv", locations_max_id)
        if not upload_to_supabase('locations', locations, supabase):
            raise Exception("Failed to upload locations")
        
        # 2. Upload organizations
        logger.info("Transforming and uploading organizations...")
        organizations, organization_id_mapping = transform_organizations(seed_data_dir / "organizations.csv", organizations_max_id)
        if not upload_to_supabase('organizations', organizations, supabase):
            raise Exception("Failed to upload organizations")
        
        # 3. Upload tags
        logger.info("Transforming and uploading tags...")
        tags, tag_id_mapping = transform_tags(seed_data_dir / "tags.csv", tags_max_id)
        if not upload_to_supabase('tags', tags, supabase):
            raise Exception("Failed to upload tags")
        
        # 4. Upload events
        logger.info("Transforming and uploading events...")
        events, event_id_mapping = transform_events(seed_data_dir / "events.csv", location_id_mapping, 
                                                   organization_id_mapping, tag_id_mapping, events_max_id)
        if not upload_to_supabase('events', events, supabase):
            raise Exception("Failed to upload events")
        
        # 5. Upload announcements
        logger.info("Transforming and uploading announcements...")
        announcements = transform_announcements(seed_data_dir / "community_announcements.csv", 
                                              organization_id_mapping, announcements_max_id)
        if not upload_to_supabase('announcements', announcements, supabase):
            raise Exception("Failed to upload announcements")
        
        logger.info("Data transformation and upload completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during transformation and upload: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 