INSTALLED_APPS = [
    # ... existing apps ...
    "django_crontab",
    # ... rest of your apps ...
]

CRONJOBS = [
    ("0 * * * *", "django.core.management.call_command", ["import_events_from_web", "--due-only"])
]
