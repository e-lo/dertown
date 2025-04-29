from .base import *

# TEMPORARY FOR DEBUGGING - REMOVE AFTER FIXING THE ISSUE
DEBUG = False
ALLOWED_HOSTS = ['.onrender.com']

# Set SECRET_KEY from environment variable
import os
import dj_database_url

SECRET_KEY = os.environ['SECRET_KEY']

# Database
# Use DATABASE_URL environment variable for database configuration
DATABASES = {
    'default': dj_database_url.config(
        default='sqlite:///db.sqlite3',
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# Static files
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATIC_URL = '/static/'

# Media files
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'