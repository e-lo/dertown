import os

# ruff: noqa: F403, F405
from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-development-key")

# SECURITY WARNING: define the correct hosts in production!
ALLOWED_HOSTS = ["*"]
SILENCED_SYSTEM_CHECKS = ["django_recaptcha.recaptcha_test_key_error"]
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

try:
    from .local import *
except ImportError:
    pass

# Use SQLite for local development
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

WAGTAILADMIN_BASE_URL = "http://127.0.0.1:8000"

# Remove 'django.contrib.sites' from INSTALLED_APPS here since it's now in base.py

SITE_ID = 1
