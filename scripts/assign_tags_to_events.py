#!/usr/bin/env python3
"""
Assign tags to events for testing the filtering functionality.
"""

import sys
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.lib.supabase import get_supabase_client

def assign_tags_to_events():
    """Assign tags to some events for testing."""
    supabase = get_supabase_client()
    
    # Get all tags
    tags_result = supabase.table('tags').select('id, name').execute()
    if not tags_result.data:
        print("No tags found in database")
        return
    
    tags = {tag['name']: tag['id'] for tag in tags_result.data}
    print(f"Available tags: {list(tags.keys())}")
    
    # Get all events
    events_result = supabase.table('events').select('id, title').eq('status', 'approved').execute()
    if not events_result.data:
        print("No events found in database")
        return
    
    events = events_result.data
    print(f"Found {len(events)} events")
    
    # Assign tags based on event titles (simple keyword matching)
    tag_assignments = []
    
    for event in events:
        title = event['title'].lower()
        
        # Simple keyword-based tag assignment
        if any(word in title for word in ['music', 'concert', 'band', 'festival']):
            if 'Arts+Culture' in tags:
                tag_assignments.append({
                    'id': event['id'],
                    'primary_tag_id': tags['Arts+Culture']
                })
        elif any(word in title for word in ['sports', 'ride', 'marathon']):
            if 'Sports' in tags:
                tag_assignments.append({
                    'id': event['id'],
                    'primary_tag_id': tags['Sports']
                })
        elif any(word in title for word in ['family', 'kids', 'children']):
            if 'Family' in tags:
                tag_assignments.append({
                    'id': event['id'],
                    'primary_tag_id': tags['Family']
                })
        elif any(word in title for word in ['nature', 'outdoor', 'trail']):
            if 'Nature' in tags:
                tag_assignments.append({
                    'id': event['id'],
                    'primary_tag_id': tags['Nature']
                })
        elif any(word in title for word in ['school', 'library', 'education']):
            if 'School' in tags:
                tag_assignments.append({
                    'id': event['id'],
                    'primary_tag_id': tags['School']
                })
        elif any(word in title for word in ['town', 'community', 'market']):
            if 'Town' in tags:
                tag_assignments.append({
                    'id': event['id'],
                    'primary_tag_id': tags['Town']
                })
        elif any(word in title for word in ['civic', 'committee', 'advisory']):
            if 'Civic' in tags:
                tag_assignments.append({
                    'id': event['id'],
                    'primary_tag_id': tags['Civic']
                })
    
    # Update events with tag assignments
    for assignment in tag_assignments:
        try:
            result = supabase.table('events').update({
                'primary_tag_id': assignment['primary_tag_id']
            }).eq('id', assignment['id']).execute()
            
            if result.data:
                print(f"Assigned tag to event: {assignment['id']}")
            else:
                print(f"Failed to assign tag to event: {assignment['id']}")
        except Exception as e:
            print(f"Error assigning tag to event {assignment['id']}: {e}")
    
    print(f"Assigned tags to {len(tag_assignments)} events")

if __name__ == "__main__":
    assign_tags_to_events() 