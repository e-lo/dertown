import logging
import re
import traceback
from datetime import datetime, time, timedelta
from typing import Annotated, Optional

import requests
from django.core.management.base import BaseCommand
from django.utils import timezone
from pydantic import (
    BaseModel,
    BeforeValidator,
    SkipValidation,
    ValidationError,
    field_validator,
)
from rapidfuzz import fuzz

from events.models import Event, Location, Organization, Tag
from ingest.html_utils import EXTRACTION_FUNCTIONS, USER_AGENT_HEADERS
from ingest.models import SourceSite

# Fields that are not updated
FIELDS_TO_NOT_UPDATE = ["status"]

# Fields that are used to uniquely identify an event and will not be updated
KEY_FIELDS = ["title", "start_date"]


logger = logging.getLogger(__name__)


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


def parse_time(time_input: str | None | datetime | time) -> time | None:
    if not time_input:
        return None
    if isinstance(time_input, time):
        return time_input
    if isinstance(time_input, datetime):
        return time_input.time()

    s = str(time_input).strip().upper().replace(" ", "")
    # Remove any unicode quotes or non-ascii
    s = re.sub(r"[^\x00-\x7F]+", "", s)
    # Try AM/PM with or without space
    for fmt in ("%I:%M%p", "%I:%M %p"):
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    # Try 24-hour
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    logger.error(f"[ERROR] Could not parse time: {time_input!r}")
    return None


def get_location_obj(location_name: str | None) -> Location | None:
    """Find or create a location object.

    If the location already exists, return it.
    If the location does not exist, create a new one and return it.
    If the location name is None, return None.
    """
    if not location_name:
        return None
    existing_location_obj = find_existing_location(location_name)
    if existing_location_obj:
        return existing_location_obj
    return Location.objects.create(name=location_name, status="pending")


def get_organization_obj(org_name: str | None, source: SourceSite) -> Organization | None:
    if not org_name:
        return getattr(source, "default_organization", None)
    existing_org_obj = find_existing_organization(org_name)
    if existing_org_obj:
        return existing_org_obj
    return Organization.objects.create(name=org_name, status="pending")


def get_description(description: str | None) -> str | None:
    if not description:
        return None
    return re.sub(r"[\x00-\x1f\x7f]", "", description)


def clean_title(title: str | None) -> str | None:
    if not title:
        return None
    # Remove specific leading titles that are not needed like "Event:" or "Calendar:"
    title = re.sub(r"^Event: ", "", title)
    title = re.sub(r"^Calendar: ", "", title)
    title = re.sub(r"^Wenatchee Valley:", "", title)

    # Remove specific trailing titles that are not needed like "Calendar" or "Events"
    title = re.sub(r"\s*\(Has reached capacity\)$", "", title)
    title = re.sub(r"\s*\(Full\)$", "", title)
    title = re.sub(r"\s*\(Sold out\)$", "", title)
    # Remove ASCII control characters
    title = re.sub(r"[\x00-\x1F\x7F]", "", title)
    # Remove non-ASCII unicode characters (including curly quotes etc.)
    title = re.sub(r"[^\x00-\x7F]+", "", title)
    # Trim whitespace
    title = title.strip()
    # Remove common trailing punctuation: colon, parenthesis, dash, period, comma
    title = re.sub(r"[:\-.,]+$", "", title)

    return title


LocationField = Annotated[Optional[Location], BeforeValidator(lambda v: get_location_obj(v))]

OrganizationField = Annotated[
    Optional[Organization], BeforeValidator(lambda v: get_organization_obj(v, source=None))
]


class EventData(BaseModel):
    title: str
    start_date: datetime.date
    start_time: Optional[time] = None
    end_date: Optional[datetime.date] = None
    end_time: Optional[time] = None
    registration_link: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    location: LocationField = None
    organization: OrganizationField = None
    primary_tag: SkipValidation[Tag] = None
    fee: Optional[str] = None
    registration_required: Optional[bool] = False
    status: str = "pending"

    def as_create_or_update_dict(self):
        """Format for Event.objects.update_or_create_with_create_only

        Example:

            ```python
            update_or_create_with_create_only(
                lookup = {
                    "title": "Event Title",
                    "start_date": datetime.date(2024, 1, 1),
                },
                defaults={
                    "description": "Event Description",
                },
                create_only={
                    "status": "pending",
                }
            )
            ```
        """
        d = {
            "lookup": {k: v for k, v in self.model_dump().items() if k in KEY_FIELDS},
            "defaults": self.model_dump(exclude=FIELDS_TO_NOT_UPDATE + KEY_FIELDS),
            "create_only": {
                k: v for k, v in self.model_dump().items() if k in FIELDS_TO_NOT_UPDATE
            },
        }
        return d

    @field_validator("title", mode="before")
    @classmethod
    def clean_title(cls, v):
        return clean_title(v)

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def validate_time(cls, v):
        return parse_time(v)

    @field_validator("description", mode="before")
    @classmethod
    def clean_description(cls, v):
        return get_description(v)

    @field_validator("registration_required", mode="before")
    @classmethod
    def boolify_registration_required(cls, v):
        if v is None:
            return False
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("yes", "true", "1")
        return bool(v)

    # Leave organization alone — handled outside the model

    model_config = dict(arbitrary_types_allowed=True)


def update_or_create_with_create_only(model_cls, lookup, defaults, create_only):
    obj, created = model_cls.objects.update_or_create(**lookup, defaults=defaults)
    if created:
        for field, value in create_only.items():
            setattr(obj, field, value)
        obj.save()
    return obj, created


def parse_data_for_event(event_dict: dict, source: SourceSite) -> EventData | None:
    """Process event data and return validated EventData instance."""
    data = event_dict.copy()
    # Set primary_tag from source
    data["primary_tag"] = getattr(source, "event_tag", None)
    # Do NOT call get_location_obj here; let the validator handle it
    data["organization"] = get_organization_obj(event_dict.get("organization"), source)
    try:
        return EventData(**data)
    except ValidationError as e:
        logger.error(f"Validation failed for event: {event_dict.get('title', '<no title>')}\n{e}")
        return None


class InvalidExtractionFunctionError(Exception):
    pass


class EventParseError(Exception):
    pass


def parse_events_for_source(
    source: SourceSite, force_update=False
) -> tuple[list[EventData], list[str]]:
    """Parse all events from the given HTML, only if the source \
        has changed since last scrape unless force_update is True."""
    event_objs = []
    errors = []
    extraction_func = EXTRACTION_FUNCTIONS.get(source.extraction_function)
    if not extraction_func:
        logger.warning(f"No extraction function found for source: {source}")
        errors += InvalidExtractionFunctionError(
            f"No extraction function found for source: {source}"
        )
        return event_objs, errors
    logger.info(f"Requesting source URL: {source.url}")
    resp = requests.get(source.url, headers=USER_AGENT_HEADERS, timeout=10)
    logger.info(f"Received response for: {source.url}")
    # Check Last-Modified header
    last_modified = resp.headers.get("Last-Modified")
    if last_modified and source.last_scraped and not force_update:
        try:
            from email.utils import parsedate_to_datetime

            last_mod_dt = parsedate_to_datetime(last_modified)
            if last_mod_dt.tzinfo is None:
                last_mod_dt = timezone.make_aware(last_mod_dt)
            if source.last_scraped >= last_mod_dt:
                logger.info(
                    f"Skipping {source.url}: not modified since last \
                        scrape ({source.last_scraped} >= {last_mod_dt})"
                )
                return [], []
        except Exception as e:
            logger.warning(f"Could not parse Last-Modified header: {last_modified} ({e})")
    resp.raise_for_status()
    extracted_events = extraction_func(resp.text, source.url)
    logger.info(f"Extracted {len(extracted_events)} events")
    for event_data_dict in extracted_events:
        try:
            event_obj = parse_data_for_event(event_data_dict, source)
            logger.info(f"Parsed event: {event_obj.title}")
        except Exception as e:
            tb = traceback.format_exc()
            error_msg = f"""Failed to parse event:
                '{event_data_dict.get('title', '<no title>')}': {e}\n
                Event data: {event_data_dict}
                Traceback:\n{tb}"""
            err = EventParseError(error_msg)
            logger.error(error_msg)
            errors.append(err)
            continue
        event_objs.append(event_obj)
    return event_objs, errors


class EventImportError(Exception):
    pass


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
        parser.add_argument(
            "--force-update",
            action="store_true",
            help="Force update even if the source has not changed since last import.",
        )

    def handle(self, *args, **options):
        due_only = options.get("due_only")
        source_id = options.get("source_id")
        force_update = options.get("force_update", False)
        if source_id:
            sources = SourceSite.objects.filter(id=source_id)
        elif due_only:
            sources = [s for s in SourceSite.objects.all() if is_due_for_import(s)]
        else:
            sources = SourceSite.objects.all()
        for source in sources:
            events, errors = parse_events_for_source(source, force_update=force_update)
            logger.info(f"Finished parsing events for source: {source.url}")
            logger.info(f"Importing {len(events)} events...")
            num_events_created = 0
            num_events_updated = 0
            for event_obj in events:
                try:
                    _, created = update_or_create_with_create_only(
                        Event, **event_obj.as_create_or_update_dict()
                    )
                    if created:
                        num_events_created += 1
                        logger.info(f"Added Event '{event_obj.title}'")
                    else:
                        num_events_updated += 1
                        logger.info(f"Updated Event '{event_obj.title}'")
                except Exception as e:
                    tb = traceback.format_exc()
                    error_msg = f"""
                    Failed to add event to database: '{event_obj.title}': {e}\n
                    Event data: {event_obj.__dict__}\n
                    Traceback:\n{tb}"""
                    logger.error(error_msg)
                    err = EventImportError(error_msg)
                    errors.append(err)
                    continue
            # Summary reporting
            if num_events_created + num_events_updated == 0:
                logger.info("No events found for this source.")
            else:
                logger.info(f"Created: {num_events_created}, Updated: {num_events_updated}.")
            if errors:
                logger.error(f"{len(errors)} errors occurred during import.")
                for err in errors:
                    logger.error(err)
