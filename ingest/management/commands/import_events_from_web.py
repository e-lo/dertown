import inspect
import re
import traceback
from datetime import timedelta

import requests
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from django.utils import timezone
from rapidfuzz import fuzz

from events.models import Event, Location, Organization
from ingest.html_utils import EXTRACTION_FUNCTIONS, USER_AGENT_HEADERS
from ingest.models import ScrapeLog, SourceSite

FIELDS_TO_NOT_UPDATE = ["title"]

# Fuzzy match helpers


def find_existing_location(name, threshold=85):
    candidates = Location.objects.all()
    best_score = 0
    best_location = None
    for loc in candidates:
        score = fuzz.token_sort_ratio(name, loc.name)
        if score > best_score:
            best_score = score
            best_location = loc
    if best_score >= threshold:
        return best_location
    return None


def find_existing_organization(name, threshold=85):
    candidates = Organization.objects.all()
    best_score = 0
    best_org = None
    for org in candidates:
        score = fuzz.token_sort_ratio(name, org.name)
        if score > best_score:
            best_score = score
            best_org = org
    if best_score >= threshold:
        return best_org
    return None


def is_due_for_import(source):
    if source.import_frequency == "manual":
        return False
    if not source.last_scraped:
        return True
    now = timezone.now()
    if source.import_frequency == "hourly":
        return now - source.last_scraped >= timedelta(hours=1)
    if source.import_frequency == "daily":
        return now - source.last_scraped >= timedelta(days=1)
    if source.import_frequency == "weekly":
        return now - source.last_scraped >= timedelta(weeks=1)
    return False


# Placeholder for your LLM extraction function
# Should take HTML and return a list of event dicts
# Each dict: {title, start_date, start_time, end_date, end_time, location, description, link, tags}
def extract_events_from_html(html):
    # TODO: Implement LLM call here
    # For now, return an empty list
    return []


def find_existing_event(title, start_date, threshold=85):
    """
    Fuzzy match event by title and exact start_date. Returns the best match or None.
    """
    candidates = Event.objects.filter(start_date=start_date)
    best_score = 0
    best_event = None
    for event in candidates:
        score = fuzz.token_sort_ratio(title, event.title)
        if score > best_score:
            best_score = score
            best_event = event
    if best_score >= threshold:
        return best_event
    return None


class Command(BaseCommand):
    help = "Import events from web sources using custom extraction functions"

    def add_arguments(self, parser):
        parser.add_argument(
            "--due-only",
            action="store_true",
            help="Only import from sources that are due for import based on their frequency.",
        )
        parser.add_argument(
            "--source-id",
            type=int,
            help="Import from a specific SourceSite by id (for manual/admin trigger).",
        )

    def handle(self, *args, **options):
        due_only = options.get("due_only")
        source_id = options.get("source_id")
        if source_id:
            sources = SourceSite.objects.filter(id=source_id)
        elif due_only:
            sources = [s for s in SourceSite.objects.all() if is_due_for_import(s)]
        else:
            sources = SourceSite.objects.all()
        for source in sources:
            extraction_func = EXTRACTION_FUNCTIONS.get(source.extraction_function)
            if not extraction_func:
                continue
            try:
                self.stdout.write(f"Requesting source URL: {source.url}")
                resp = requests.get(source.url, headers=USER_AGENT_HEADERS, timeout=10)
                self.stdout.write(f"Received response for: {source.url}")
                resp.raise_for_status()
                if "stdout" in inspect.signature(extraction_func).parameters:
                    events = extraction_func(resp.text, source.url, stdout=self.stdout.write)
                else:
                    events = extraction_func(resp.text, source.url)
                num_found = len(events)
                num_created = 0
                num_updated = 0
                errors = []
                for event_data in events:
                    title = event_data.get("title")
                    start_date = event_data.get("start_date")
                    if not title or not start_date:
                        continue
                    # Map ticket_link to registration_link, info_link to website
                    registration_link = event_data.get("ticket_link")
                    website = event_data.get("info_link")
                    # Sanitize all fields: only allow str or None
                    sanitized_data = {}
                    for k, v in event_data.items():
                        sanitized_data[k] = (
                            str(v) if v is not None and not isinstance(v, str) else v
                        )
                    # Sanitize description field
                    desc = sanitized_data.get("description")
                    if desc and isinstance(desc, str):
                        new_desc = re.sub(r"[\x00-\x1f\x7f]", "", desc)
                        if new_desc != desc:
                            self.stdout.write(
                                f"[DEBUG] Sanitized description for '{title}': {repr(new_desc)}"
                            )
                        sanitized_data["description"] = new_desc
                    # Add mapped fields
                    sanitized_data["registration_link"] = (
                        registration_link
                        if isinstance(registration_link, (str, type(None)))
                        else str(registration_link)
                    )
                    sanitized_data["website"] = (
                        website if isinstance(website, (str, type(None))) else str(website)
                    )
                    # Debug log the sanitized event data
                    self.stdout.write(f"[DEBUG] Event data for '{title}':")
                    for k, v in sanitized_data.items():
                        self.stdout.write(f"    {k} ({type(v)}): {repr(v)}")
                    location_name = sanitized_data.get("location")
                    if location_name:
                        location_obj = find_existing_location(location_name)
                        if not location_obj:
                            location_obj = Location.objects.create(
                                name=location_name, status="pending"
                            )
                    else:
                        location_obj = None
                    # Set default organization for Icicle.org
                    org_name = sanitized_data.get("organization")
                    if "icicle.org" in source.url:
                        org_obj, _ = Organization.objects.get_or_create(
                            name="Icicle Creek Center for the Arts", defaults={"status": "approved"}
                        )
                    elif org_name:
                        org_obj = find_existing_organization(org_name)
                        if not org_obj:
                            org_obj = Organization.objects.create(name=org_name, status="pending")
                    else:
                        org_obj = getattr(source, "default_organization", None)
                    existing_event = find_existing_event(title, start_date)
                    try:
                        if existing_event:
                            for field, value in sanitized_data.items():
                                if field in FIELDS_TO_NOT_UPDATE:
                                    continue
                                if (
                                    hasattr(existing_event, field)
                                    and value is not None
                                    and field != "location"
                                ):
                                    setattr(existing_event, field, value)
                            existing_event.location = location_obj
                            existing_event.organization = org_obj
                            existing_event.status = "pending"
                            existing_event.save()
                            num_updated += 1
                            action = "updated"
                            self.stdout.write(f"Event '{title}' on {start_date}: {action}.")
                        else:
                            Event.objects.create(
                                title=title,
                                start_date=start_date,
                                description=sanitized_data.get("description"),
                                registration_link=sanitized_data.get("registration_link"),
                                fee=sanitized_data.get("fee"),
                                registration_required=sanitized_data.get(
                                    "registration_required", False
                                ),
                                status="pending",
                                location=location_obj,
                                organization=org_obj,
                                website=sanitized_data.get("website"),
                                # Add more fields as needed
                            )
                            num_created += 1
                            action = "created"
                            self.stdout.write(f"Event '{title}' on {start_date}: {action}.")
                    except Exception as e:
                        tb = traceback.format_exc()
                        error_msg = f"Failed to sync event '{title}': {e}\n\
                            Event data: {sanitized_data}\nTraceback:\n{tb}"
                        self.stderr.write(error_msg)
                        errors.append(error_msg)
                        continue
                # Summary reporting
                if num_found == 0:
                    self.stdout.write(self.style.WARNING("No events found for this source."))
                else:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Found {num_found} events. Created: {num_created}, \
                                Updated: {num_updated}."
                        )
                    )
                if errors:
                    self.stderr.write(
                        self.style.ERROR(f"{len(errors)} errors occurred during import.")
                    )
                    for err in errors:
                        self.stderr.write(self.style.ERROR(err))
            except Exception as e:
                self.stderr.write(f"Error processing {source.url}: {e}")

    def process_source(self, source):
        try:
            events_imported = self.scrape_events(source)
            self.log_success(source, events_imported)
        except Exception as e:
            self.log_error(source, e)

    def scrape_events(self, source):
        self.stdout.write(f"Requesting source URL: {source.url}")
        resp = requests.get(source.url, headers=USER_AGENT_HEADERS, timeout=30)
        self.stdout.write(f"Received response for: {source.url}")
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Example: find all event links (customize selector as needed)
        event_links = [a["href"] for a in soup.select("a.event-link") if a.get("href")]

        events_imported = 0
        for link in event_links:
            events_imported += self.process_event_link(source, link)
        return events_imported

    def process_event_link(self, source, link):
        # If link is relative, make it absolute
        if link.startswith("/"):
            link = requests.compat.urljoin(source.url, link)

        self.stdout.write(f"Requesting event detail URL: {link}")
        detail_resp = requests.get(link, headers=USER_AGENT_HEADERS, timeout=30)
        self.stdout.write(f"Received response for event detail: {link}")
        detail_resp.raise_for_status()
        event_html = detail_resp.text

        events_imported = 0
        event_dicts = extract_events_from_html(event_html)
        for event_data in event_dicts:
            if self.create_or_update_event(source, event_data):
                events_imported += 1
        return events_imported

    def create_or_update_event(self, source, event_data):
        # Validate required fields
        if not event_data.get("title") or not event_data.get("start_date"):
            return False

        # Use title+start_date+location as unique key
        Event.objects.update_or_create(
            title=event_data["title"],
            start_date=event_data["start_date"],
            location=event_data.get("location"),
            defaults={
                "description": event_data.get("description", ""),
                "end_date": event_data.get("end_date"),
                "start_time": event_data.get("start_time"),
                "end_time": event_data.get("end_time"),
                "website": event_data.get("link"),
            },
        )
        return True

    def log_success(self, source, events_imported):
        source.last_scraped = timezone.now()
        source.last_status = f"success ({events_imported} events imported)"
        source.last_error = ""
        source.save()

        ScrapeLog.objects.create(source=source, status="success", error_message="")
        self.stdout.write(
            self.style.SUCCESS(f"Imported {events_imported} events from {source.name}")
        )

    def log_error(self, source, error):
        source.last_scraped = timezone.now()
        source.last_status = "error"
        source.last_error = str(error)
        source.save()

        ScrapeLog.objects.create(source=source, status="error", error_message=str(error))
        self.stderr.write(self.style.ERROR(f"Error importing from {source.name}: {error}"))
