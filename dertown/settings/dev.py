import os

# ruff: noqa: F403, F405
from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-development-key")

# SECURITY WARNING: define the correct hosts in production!
ALLOWED_HOSTS = ["*"]

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

GOOGLE_CALENDAR_IDS = {
    "arts": "f47affb9fedd8a8d106d69f049fff890867e74ac6d68003c60cab8bb77a5408d\
        @group.calendar.google.com",
    "civic": "40f02cad4c95ca800dff99cf1c4340b90c4a1df343a344e3a45f13f9ff87821f\
        @group.calendar.google.com",
    "family": "1ebac52063ac6832c74581da2a3352362a70b07907a860979a29db95194003a1\
        @group.calendar.google.com",
    "nature": "607e698d5321b61ec67de8a44567957881a209fead76faaa4fb891ae53b55ef6\
        @group.calendar.google.com",
    "outdoors": "fbce9806f2cc562b9ced160ddac15f0714ad3aa0acb43a73c7bbae7e3bca1edb\
        @group.calendar.google.com",
    "sports": "256bd4027be7f2166562c8bf06e1e07bca864a22283e9c6692add0b251a838f6\
        @group.calendar.google.com",
    "town": "20c476a152fcc4210d07caa4eed509d97a637e1118dcd4987f7c494b2a1248d9\
        @group.calendar.google.com",
}

# Remove 'django.contrib.sites' from INSTALLED_APPS here since it's now in base.py

SITE_ID = 1
