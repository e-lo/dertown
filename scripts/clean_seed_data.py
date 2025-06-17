#!/usr/bin/env python3
"""
Clean seed data CSV files by replacing PostgreSQL \\N values with empty strings.
"""

import csv
import os
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
seed_data_dir = project_root / "seed_data"


def clean_csv_file(file_path: Path):
    """Clean a CSV file by replacing \\N with empty strings."""
    print(f"Cleaning {file_path.name}...")
    
    # Read the original file
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
    
    # Clean the data
    cleaned_rows = []
    for row in rows:
        cleaned_row = [cell.replace('\\N', '') if cell == '\\N' else cell for cell in row]
        cleaned_rows.append(cleaned_row)
    
    # Write back to the file
    with open(file_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(cleaned_rows)
    
    print(f"  ✓ Cleaned {len(rows)} rows")


def main():
    """Clean all CSV files in the seed_data directory."""
    print("Cleaning seed data CSV files...")
    
    # List of CSV files to clean
    csv_files = [
        "locations.csv",
        "organizations.csv", 
        "tags.csv",
        "events.csv",
        "community_announcements.csv"
    ]
    
    for filename in csv_files:
        file_path = seed_data_dir / filename
        if file_path.exists():
            clean_csv_file(file_path)
        else:
            print(f"  ⚠️  File not found: {filename}")
    
    print("\n✅ Seed data cleaning completed!")


if __name__ == "__main__":
    main() 