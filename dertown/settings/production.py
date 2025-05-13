# ruff: noqa: F403, F405
import os

import dj_database_url
from google.oauth2 import service_account

from .base import *

# TEMPORARY FOR DEBUGGING - REMOVE AFTER FIXING THE ISSUE
DEBUG = False
ALLOWED_HOSTS = [".onrender.com", "dertown.org", "www.dertown.org", "localhost", "127.0.0.1"]

INSTALLED_APPS += ["storages"]

# Set SECRET_KEY from environment variable
SECRET_KEY = os.environ["SECRET_KEY"]

# Database
# Use DATABASE_URL environment variable for database configuration
DATABASES = {
    "default": dj_database_url.config(
        default="postgresql://dertown_db_0s1g_user:M5KsORvJxezvEHlfZdshbbb3pEuKQvEJ@dpg-d0giu53uibrs73flv6h0-a/dertown_db_0s1g",
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# Tell Django to copy static assets into a path called `staticfiles` (this is specific to Render)
STATIC_ROOT = BASE_DIR / "staticfiles"

# Enable the WhiteNoise storage backend, which compresses static files to reduce disk use
# and renames the files with unique names for each version to support long-term caching
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"


# Configure Google Cloud Storage for media files
DEFAULT_FILE_STORAGE = "storages.backends.gcloud.GoogleCloudStorage"
GS_BUCKET_NAME = os.environ["GS_BUCKET_NAME"]

GOOGLE_APPLICATION_CREDENTIALS_JSON = service_account.Credentials.from_service_account_file(
    os.environ["GS_CREDENTIALS_FILE"]
)
MEDIA_URL = f"https://storage.googleapis.com/{GS_BUCKET_NAME}/"

# Wagtail settings
WAGTAILADMIN_BASE_URL = "https://dertown.org"
SITE_ID = 1
