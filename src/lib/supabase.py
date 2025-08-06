"""
Python Supabase client for data ingestion scripts.
"""

import os
from supabase import create_client, Client
from typing import Optional


def get_supabase_client() -> Client:
    """Get Supabase client instance."""
    url = os.environ.get("PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    # Use service role key if available, otherwise use anon key
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("PUBLIC_SUPABASE_KEY") or os.environ.get("SUPABASE_KEY")
    
    if not url or not key:
        raise ValueError("PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY environment variables must be set")
    
    return create_client(url, key) 