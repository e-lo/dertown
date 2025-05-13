from datetime import datetime

from django.conf import settings
from django.contrib.sites.models import Site
from django.urls import reverse
from django.utils import timezone
from google.oauth2 import service_account
from googleapiclient.discovery import build

from .models import Tag

SCOPES = ["https://www.googleapis.com/auth/calendar"]


if not settings.GS_CALENDAR_CREDENTIALS_FILE:
    raise RuntimeError(
        "Google service account credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS_FILE \
            environment variable."
    )

if not settings.GS_CALENDAR_CREDENTIALS_FILE.exists():
    raise RuntimeError(
        f"Google service account credentials not found at {settings.GS_CALENDAR_CREDENTIALS_FILE}. \
            Set GOOGLE_APPLICATION_CREDENTIALS_FILE to a valid path."
    )


def get_calendar_id(event_type):
    """Return the Google Calendar ID for the given event type (tag name)."""
    try:
        tag = Tag.objects.get(name=event_type)
        if not tag.google_calendar_id:
            raise ValueError(f"No Google Calendar ID set for tag: {event_type}")
        return tag.google_calendar_id
    except Tag.DoesNotExist:
        raise ValueError(f"No tag found for event type: {event_type}")


def get_calendar_service():
    """Authenticate and return a Google Calendar API service object."""
    credentials = service_account.Credentials.from_service_account_file(
        settings.GS_CALENDAR_CREDENTIALS_FILE, scopes=SCOPES
    )
    service = build("calendar", "v3", credentials=credentials)
    return service


def add_or_update_event(event, calendar_event_id=None):
    """
    Add or update an event in Google Calendar.
    If calendar_event_id is provided, update the event; otherwise, create a new one.
    Returns the Google Calendar event ID.
    """
    service = get_calendar_service()
    calendar_id = get_calendar_id(event.primary_tag.name)

    # Build location string
    location_str = event.location.name if event.location else ""
    if event.location and event.location.address:
        location_str += f", {event.location.address}"

    # Build event link (optional)
    try:
        current_site = Site.objects.get_current()
        event_url = (
            f"https://{current_site.domain}{reverse('events:event_detail', args=[event.id])}"
        )
    except Exception:
        event_url = ""

    # Handle all-day vs timed events
    def to_iso(dt, tm=None):
        if tm:
            return datetime.combine(dt, tm).isoformat()
        return dt.isoformat()

    if event.start_time:
        start = {
            "dateTime": to_iso(event.start_date, event.start_time),
            "timeZone": "America/Los_Angeles",
        }
    else:
        start = {"date": event.start_date.isoformat()}

    if event.end_date:
        end_date = event.end_date
    else:
        end_date = event.start_date
    if event.end_time:
        end = {"dateTime": to_iso(end_date, event.end_time), "timeZone": "America/Los_Angeles"}
    else:
        # For all-day, Google expects the end date to be the day AFTER the event
        end = {"date": (end_date + timezone.timedelta(days=1)).isoformat()}

    # Build description with optional links
    description_parts = [event.description or ""]
    if event.website:
        description_parts.append(f"Website: {event.website}")
    if event.registration_link:
        description_parts.append(f"Register: {event.registration_link}")
    if event_url:
        description_parts.append(f"More info: {event_url}")
    description = "\n\n".join([part for part in description_parts if part])

    event_body = {
        "summary": event.title,
        "description": description,
        "location": location_str,
        "start": start,
        "end": end,
        "source": {"title": "Der Town", "url": event_url} if event_url else None,
    }
    # Remove None values
    event_body = {k: v for k, v in event_body.items() if v}

    if calendar_event_id:
        updated_event = (
            service.events()
            .update(calendarId=calendar_id, eventId=calendar_event_id, body=event_body)
            .execute()
        )
        return updated_event["id"]
    else:
        created_event = service.events().insert(calendarId=calendar_id, body=event_body).execute()
        return created_event["id"]
