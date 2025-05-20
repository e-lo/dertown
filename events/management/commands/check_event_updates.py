"""Check if the website of an event has been updated.
If it has, update the event.

Usage:
python manage.py check_event_updates
"""

from email.utils import parsedate_to_datetime

import requests
from django.utils import timezone

from events.models import Event


def check_event_websites():
    for event in Event.objects.exclude(website__isnull=True).exclude(website=""):
        try:
            resp = requests.head(event.website, timeout=10)
            last_modified = resp.headers.get("Last-Modified")
            if last_modified:
                last_mod_dt = parsedate_to_datetime(last_modified)
                if last_mod_dt.tzinfo is None:
                    last_mod_dt = timezone.make_aware(last_mod_dt)
                if last_mod_dt > event.updated_at:
                    event.details_outdated = True
                else:
                    event.details_outdated = False
                event.save(update_fields=["details_outdated"])
        except Exception:
            # Optionally log or flag unreachable sites
            pass
