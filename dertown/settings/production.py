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

GS_BUCKET_NAME = "der-town-media"
GS_PROJECT_ID = "der-town"

GS_CREDENTIALS = service_account.Credentials.from_service_account_file(
    "/etc/secrets/gcp-der-town-media.json"
)
GS_LOCATION = ""
# https://django-storages.readthedocs.io/en/latest/backends/gcloud.html
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.gcloud.GoogleCloudStorage",
        "OPTIONS": {
            "bucket_name": GS_BUCKET_NAME,
            "project_id": GS_PROJECT_ID,
            "credentials": GS_CREDENTIALS,
            "location": GS_LOCATION,
        },
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

# Wagtail settings
WAGTAILADMIN_BASE_URL = "https://dertown.org"
SITE_ID = 1
