"""
Python Supabase client for data ingestion scripts.
"""

import os
from supabase import create_client, Client
from typing import Optional


def get_supabase_client() -> Client:
    """Get Supabase client instance."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables must be set")
    
    return create_client(url, key) 