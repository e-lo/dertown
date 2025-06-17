#!/usr/bin/env python3
"""
Script to extract data from PostgreSQL binary dump by parsing the data files directly.
This approach reads the toc.dat file to understand the dump structure,
then extracts data from the individual .dat files.
"""

import csv
import os
import struct
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

def parse_toc_file(toc_path: Path) -> Dict[str, Any]:
    """Parse the toc.dat file to understand the dump structure."""
    toc_info = {
        'tables': {},
        'data_files': {}
    }
    
    try:
        with open(toc_path, 'rb') as f:
            # Read header
            header = f.read(8)
            if header != b'PGDMP':
                print("Not a valid PostgreSQL dump file")
                return toc_info
            
            # Skip version and other header info
            f.seek(24)
            
            # Read entries
            while True:
                try:
                    # Read entry header
                    entry_data = f.read(8)
                    if not entry_data or len(entry_data) < 8:
                        break
                    
                    # Parse entry (simplified - this is complex binary format)
                    # For now, just try to find table entries
                    pass
                    
                except Exception:
                    break
    
    except Exception as e:
        print(f"Error parsing toc file: {e}")
    
    return toc_info

def extract_data_from_files(dump_dir: Path) -> Dict[str, List[Dict]]:
    """Extract data from individual .dat files by parsing them as text."""
    tables = {}
    
    # Map file numbers to table names based on scan results
    file_mapping = {
        '4164': 'events_event',      # 26 fields - events
        '4160': 'events_location',   # 9 fields - locations  
        '4158': 'events_tag',        # 4 fields - tags
        '4156': 'events_organization', # 9 fields - organizations (Cascade School District, etc.)
        '4162': 'events_communityannouncement', # 10 fields - announcements (Community Cupboard, etc.)
        '4186': 'events_sourcesite', # 10 fields - source sites (Leavenworth.org, etc.)
    }
    
    for dat_file in dump_dir.glob("*.dat"):
        if dat_file.name == 'toc.dat':
            continue
            
        file_number = dat_file.stem
        print(f"Processing {dat_file.name} ({dat_file.stat().st_size} bytes)")
        
        # Check if this file is mapped to a table
        if file_number in file_mapping:
            table_name = file_mapping[file_number]
            print(f"  Mapped to {table_name}")
            
            try:
                with open(dat_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                data = parse_table_data(content, table_name)
                if data:
                    if table_name not in tables:
                        tables[table_name] = []
                    tables[table_name].extend(data)
                    print(f"  Extracted {len(data)} rows")
                else:
                    print(f"  No valid data found for {table_name}")
            
            except Exception as e:
                print(f"  Error processing {dat_file.name}: {e}")
        else:
            print(f"  No mapping found for {dat_file.name}")
    
    return tables

def convert_postgres_null(value: str) -> Optional[str]:
    r"""Convert PostgreSQL \N to Python None."""
    if value == '\\N':
        return None
    return value

def parse_table_data(content: str, table_name: str) -> List[Dict]:
    """Parse table data from PostgreSQL dump content."""
    data = []
    lines = content.strip().split('\n')
    
    for line in lines:
        if not line.strip():
            continue
            
        # Split by tab character
        fields = line.split('\t')
        
        if table_name == 'events_event' and len(fields) == 26:
            row_data = {
                'id': convert_postgres_null(fields[0]),
                'title': convert_postgres_null(fields[1]),
                'description': convert_postgres_null(fields[2]),
                'start_date': convert_postgres_null(fields[3]),
                'end_date': convert_postgres_null(fields[4]),
                'start_time': convert_postgres_null(fields[5]),
                'end_time': convert_postgres_null(fields[6]),
                'location_id': convert_postgres_null(fields[7]),
                'organization_id': convert_postgres_null(fields[8]),
                'email': convert_postgres_null(fields[9]),
                'website': convert_postgres_null(fields[10]),
                'registration_link': convert_postgres_null(fields[11]),
                'primary_tag_id': convert_postgres_null(fields[12]),
                'secondary_tag_id': convert_postgres_null(fields[13]),
                'image_id': convert_postgres_null(fields[14]),
                'external_image_url': convert_postgres_null(fields[15]),
                'featured': convert_postgres_null(fields[16]),
                'parent_event_id': convert_postgres_null(fields[17]),
                'exclude_from_calendar': convert_postgres_null(fields[18]),
                'google_calendar_event_id': convert_postgres_null(fields[19]),
                'registration_required': convert_postgres_null(fields[20]),
                'fee': convert_postgres_null(fields[21]),
                'status': convert_postgres_null(fields[22]),
                'updated_at': convert_postgres_null(fields[23]),
                'details_outdated_cached': convert_postgres_null(fields[24]),
                'details_outdated_checked_at': convert_postgres_null(fields[25]),
            }
        elif table_name == 'events_tag' and len(fields) == 4:
            row_data = {
                'id': convert_postgres_null(fields[0]),
                'name': convert_postgres_null(fields[1]),
                'calendar_id': convert_postgres_null(fields[2]),
                'share_id': convert_postgres_null(fields[3]),
            }
        elif table_name == 'events_location' and len(fields) == 9:
            row_data = {
                'id': convert_postgres_null(fields[0]),
                'name': convert_postgres_null(fields[1]),
                'address': convert_postgres_null(fields[2]),
                'website': convert_postgres_null(fields[3]),
                'phone': convert_postgres_null(fields[4]),
                'latitude': convert_postgres_null(fields[5]),
                'longitude': convert_postgres_null(fields[6]),
                'parent_location_id': convert_postgres_null(fields[7]),
                'status': convert_postgres_null(fields[8]),
            }
        elif table_name == 'events_organization' and len(fields) == 9:
            row_data = {
                'id': convert_postgres_null(fields[0]),
                'name': convert_postgres_null(fields[1]),
                'description': convert_postgres_null(fields[2]),
                'website': convert_postgres_null(fields[3]),
                'email': convert_postgres_null(fields[4]),
                'phone': convert_postgres_null(fields[5]),
                'address': convert_postgres_null(fields[6]),
                'logo_url': convert_postgres_null(fields[7]),
                'status': convert_postgres_null(fields[8]),
            }
        elif table_name == 'events_communityannouncement' and len(fields) == 10:
            row_data = {
                'id': convert_postgres_null(fields[0]),
                'title': convert_postgres_null(fields[1]),
                'message': convert_postgres_null(fields[2]),
                'link': convert_postgres_null(fields[3]),
                'active': convert_postgres_null(fields[4]),
                'created_at': convert_postgres_null(fields[5]),
                'expires_at': convert_postgres_null(fields[6]),
                'author': convert_postgres_null(fields[7]),
                'email': convert_postgres_null(fields[8]),
                'organization_id': convert_postgres_null(fields[9]),
            }
        elif table_name == 'events_sourcesite' and len(fields) == 10:
            row_data = {
                'id': convert_postgres_null(fields[0]),
                'name': convert_postgres_null(fields[1]),
                'url': convert_postgres_null(fields[2]),
                'description': convert_postgres_null(fields[3]),
                'frequency': convert_postgres_null(fields[4]),
                'organization_id': convert_postgres_null(fields[5]),
                'location_id': convert_postgres_null(fields[6]),
                'extraction_function': convert_postgres_null(fields[7]),
                'active': convert_postgres_null(fields[8]),
                'last_scraped': convert_postgres_null(fields[9]),
            }
        else:
            continue
            
        if row_data and any(v is not None for v in row_data.values()):
            data.append(row_data)
    return data

def filter_future_events(events: List[Dict]) -> List[Dict]:
    """Filter events to only include future dates."""
    future_events = []
    today = datetime.now().date()
    
    for event in events:
        try:
            if event.get('start_date'):
                # Parse the date string
                if isinstance(event['start_date'], str):
                    # Handle different date formats
                    if 'T' in event['start_date']:
                        # ISO format with time
                        event_date = datetime.fromisoformat(event['start_date'].replace('Z', '+00:00')).date()
                    else:
                        # Just date
                        event_date = datetime.strptime(event['start_date'], '%Y-%m-%d').date()
                    
                    if event_date >= today:
                        future_events.append(event)
        except Exception as e:
            print(f"Error parsing date for event {event.get('id', 'unknown')}: {e}")
            # Include events with unparseable dates for manual review
            future_events.append(event)
    
    return future_events

def write_csv_files(tables: Dict[str, List[Dict]], output_dir: Path):
    """Write table data to CSV files."""
    output_dir.mkdir(exist_ok=True)
    
    # Map table names to CSV filenames
    csv_mapping = {
        'events_event': 'events.csv',
        'events_tag': 'tags.csv', 
        'events_location': 'locations.csv',
        'events_organization': 'organizations.csv',
        'events_communityannouncement': 'community_announcements.csv',
        'events_sourcesite': 'source_sites.csv'
    }
    
    for table_name, data in tables.items():
        if table_name in csv_mapping and data:
            csv_filename = csv_mapping[table_name]
            csv_path = output_dir / csv_filename
            
            # Filter events if this is the events table
            if table_name == 'events_event':
                data = filter_future_events(data)
                print(f"Filtered to {len(data)} future events")
            
            if data:
                # Get column names from first row
                columns = list(data[0].keys())
                
                with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=columns)
                    writer.writeheader()
                    writer.writerows(data)
                
                print(f"Wrote {len(data)} rows to {csv_filename}")
            else:
                print(f"No data to write for {table_name}")

def scan_files_for_structure(dump_dir: Path):
    print("\n--- File Structure Scan ---")
    for dat_file in dump_dir.glob("*.dat"):
        if dat_file.name == 'toc.dat':
            continue
        field_counts = {}
        sample_lines = []
        with open(dat_file, 'r', encoding='utf-8', errors='ignore') as f:
            for i, line in enumerate(f):
                line = line.strip()
                if not line or line.startswith('\\') or line.startswith(r'\.'):
                    continue
                fields = line.split('\t')
                count = len(fields)
                field_counts[count] = field_counts.get(count, 0) + 1
                if len(sample_lines) < 3:
                    sample_lines.append(line)
                if i > 100:
                    break
        if field_counts:
            most_common = max(field_counts.items(), key=lambda x: x[1])
            print(f"{dat_file.name}: Most common field count: {most_common[0]} (occurs {most_common[1]} times)")
            for sample in sample_lines:
                print(f"  Sample: {sample}")
        else:
            print(f"{dat_file.name}: No tab-separated data detected.")

def main():
    """Main function to extract data from PostgreSQL dump."""
    dump_dir = Path("reference/dertown_db_0s1g")
    output_dir = Path("seed_data")
    
    if not dump_dir.exists():
        print(f"Dump directory not found: {dump_dir}")
        sys.exit(1)
    
    scan_files_for_structure(dump_dir)
    print("\n--- End of Scan ---\n")
    
    print("Extracting data from dump files...")
    tables = extract_data_from_files(dump_dir)
    
    if not tables:
        print("No table data found")
        sys.exit(1)
    
    print(f"Found {len(tables)} tables")
    for table_name, data in tables.items():
        print(f"  {table_name}: {len(data)} rows")
    
    print("Writing CSV files...")
    write_csv_files(tables, output_dir)
    
    print("Data extraction complete!")

if __name__ == "__main__":
    main() 