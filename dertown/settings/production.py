from .base import *

DEBUG = False
ALLOWED_HOSTS = ['.onrender.com']

# Set SECRET_KEY from environment variable
import os
SECRET_KEY = os.environ.get('SECRET_KEY', 'unsafe-default')

# Static files
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATIC_URL = '/static/'

# Media files
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'