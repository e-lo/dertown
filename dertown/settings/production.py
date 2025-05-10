# ruff: noqa: F403, F405
import os

import dj_database_url

from .base import *

# TEMPORARY FOR DEBUGGING - REMOVE AFTER FIXING THE ISSUE
DEBUG = False
ALLOWED_HOSTS = [".onrender.com"]

# Set SECRET_KEY from environment variable
SECRET_KEY = os.environ["SECRET_KEY"]

# Database
# Use DATABASE_URL environment variable for database configuration
DATABASES = {
    "default": dj_database_url.config(
        default="sqlite:///db.sqlite3",
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# Static files
STATIC_ROOT = BASE_DIR / "staticfiles"
STATIC_URL = "/static/"

# Media files
MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"

# Wagtail settings
WAGTAILADMIN_BASE_URL = "https://dertown.onrender.com"

# Google Calendar settings
GOOGLE_SERVICE_ACCOUNT_FILE = os.environ.get(
    "GOOGLE_SERVICE_ACCOUNT_FILE", BASE_DIR / "google-service-account.json"
)
