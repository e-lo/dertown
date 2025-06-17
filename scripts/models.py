"""
Pydantic models for Der Town database entities.

These models provide validation and serialization for data ingestion scripts,
API endpoints, and data processing pipelines.
"""

from datetime import date, time, datetime
from typing import Optional, List, Union
from enum import Enum
from pydantic import BaseModel, Field, validator, HttpUrl, root_validator
import uuid


def convert_postgres_null(value: Union[str, None]) -> Optional[str]:
    """Convert PostgreSQL \\N to Python None for Pydantic validation."""
    if value is None or value == '' or value == '\\N':
        return None
    return value


def postgres_null_validator(cls, v):
    """Validator to handle PostgreSQL null values in optional string fields."""
    return convert_postgres_null(v)


def postgres_null_url_validator(cls, v):
    """Pre-validator for Optional[HttpUrl] fields to treat '\\N' and '' as None."""
    if v is None or v == '' or v == '\\N':
        return None
    return v


def parse_date_validator(cls, v):
    """Pre-validator to parse date strings to date objects."""
    if v is None or v == '' or v == '\\N':
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        try:
            return datetime.strptime(v, '%Y-%m-%d').date()
        except ValueError:
            raise ValueError(f"Could not parse date: {v}")
    return v


def parse_time_validator(cls, v):
    """Pre-validator to parse time strings to time objects."""
    if v is None or v == '' or v == '\\N':
        return None
    if isinstance(v, time):
        return v
    if isinstance(v, str):
        try:
            return datetime.strptime(v, '%H:%M:%S').time()
        except ValueError:
            raise ValueError(f"Could not parse time: {v}")
    return v


def parse_datetime_validator(cls, v):
    """Pre-validator to parse datetime strings to datetime objects."""
    if v is None or v == '' or v == '\\N':
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        try:
            # Handle PostgreSQL timestamp format
            if v.endswith('+00'):
                v = v[:-3]
            return datetime.fromisoformat(v.replace('Z', '+00:00'))
        except ValueError:
            raise ValueError(f"Could not parse datetime: {v}")
    return v


def parse_boolean_validator(cls, v):
    """Pre-validator to parse various boolean string representations."""
    if v is None or v == '' or v == '\\N':
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        v_lower = v.lower().strip()
        if v_lower in ('true', 't', '1', 'yes', 'y', 'on'):
            return True
        elif v_lower in ('false', 'f', '0', 'no', 'n', 'off'):
            return False
        else:
            raise ValueError(f"Could not parse boolean: {v}")
    return v


def status_enum_pre_validator(enum_cls):
    def _validator(cls, v):
        if v is None:
            return v
        if isinstance(v, enum_cls):
            return v
        if isinstance(v, str):
            try:
                return enum_cls(v.lower())
            except ValueError:
                # Try upper/lower/strip variants
                for member in enum_cls:
                    if v.strip().lower() == member.value:
                        return member
                raise
        return v
    return _validator


class EventStatus(str, Enum):
    """Event status enumeration."""
    PENDING = "pending"
    APPROVED = "approved"
    DUPLICATE = "duplicate"
    ARCHIVED = "archived"


class ImportFrequency(str, Enum):
    """Import frequency enumeration."""
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MANUAL = "manual"


class AnnouncementStatus(str, Enum):
    """Announcement status enumeration."""
    PENDING = "pending"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class BaseEntity(BaseModel):
    """Base entity with common fields."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            date: lambda v: v.isoformat() if v else None,
            time: lambda v: v.isoformat() if v else None,
        }


class Location(BaseEntity):
    """Location model for physical venues."""
    name: str = Field(..., min_length=1, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    website: Optional[HttpUrl] = None
    phone: Optional[str] = Field(None, max_length=20)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    parent_location_id: Optional[str] = None
    status: EventStatus = EventStatus.PENDING

    @validator('address', 'phone', 'parent_location_id', pre=True)
    def validate_postgres_nulls(cls, v):
        return postgres_null_validator(cls, v)

    @validator('website', pre=True)
    def validate_postgres_null_url(cls, v):
        return postgres_null_url_validator(cls, v)

    @validator('status', pre=True)
    def validate_status_enum(cls, v):
        return status_enum_pre_validator(EventStatus)(cls, v)

    @validator('phone')
    def validate_phone(cls, v):
        if v and not v.replace('+', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '').isdigit():
            raise ValueError('Phone number must contain only digits, spaces, hyphens, parentheses, and plus sign')
        return v


class Organization(BaseEntity):
    """Organization model for event hosts."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    website: Optional[HttpUrl] = None
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, pattern=r'^[^@]+@[^@]+\.[^@]+$')
    location_id: Optional[str] = None
    parent_organization_id: Optional[str] = None
    status: EventStatus = EventStatus.PENDING

    @validator('description', 'phone', 'email', 'location_id', 'parent_organization_id', pre=True)
    def validate_postgres_nulls(cls, v):
        return postgres_null_validator(cls, v)

    @validator('website', pre=True)
    def validate_postgres_null_url(cls, v):
        return postgres_null_url_validator(cls, v)

    @validator('status', pre=True)
    def validate_status_enum(cls, v):
        return status_enum_pre_validator(EventStatus)(cls, v)

    @validator('phone')
    def validate_phone(cls, v):
        if v and not v.replace('+', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '').isdigit():
            raise ValueError('Phone number must contain only digits, spaces, hyphens, parentheses, and plus sign')
        return v


class Tag(BaseEntity):
    """Tag model for event categories."""
    name: str = Field(..., min_length=1, max_length=100)
    calendar_id: Optional[str] = None
    share_id: Optional[str] = None

    @validator('calendar_id', 'share_id', pre=True)
    def validate_postgres_nulls(cls, v):
        return postgres_null_validator(cls, v)


class SourceSite(BaseEntity):
    """Source site model for external data sources."""
    name: str = Field(..., min_length=1, max_length=255)
    url: HttpUrl
    organization_id: Optional[str] = None
    event_tag_id: Optional[str] = None
    last_scraped: Optional[datetime] = None
    last_status: Optional[str] = None
    last_error: Optional[str] = None
    import_frequency: ImportFrequency = ImportFrequency.MANUAL
    extraction_function: Optional[str] = None

    @validator('organization_id', 'event_tag_id', 'last_status', 'last_error', 'extraction_function', pre=True)
    def validate_postgres_nulls(cls, v):
        return postgres_null_validator(cls, v)

    @validator('last_scraped', pre=True)
    def validate_datetime(cls, v):
        return parse_datetime_validator(cls, v)


class Event(BaseEntity):
    """Event model for community events."""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    location_id: Optional[str] = None
    organization_id: Optional[str] = None
    email: Optional[str] = Field(None, pattern=r'^[^@]+@[^@]+\.[^@]+$')
    website: Optional[HttpUrl] = None
    registration_link: Optional[HttpUrl] = None
    primary_tag_id: Optional[str] = None
    secondary_tag_id: Optional[str] = None
    image_id: Optional[str] = None
    external_image_url: Optional[HttpUrl] = None
    featured: bool = False
    parent_event_id: Optional[str] = None
    exclude_from_calendar: bool = False
    google_calendar_event_id: Optional[str] = None
    registration: bool = False
    cost: Optional[str] = Field(None, max_length=100)
    status: EventStatus = EventStatus.PENDING
    source_id: Optional[str] = None
    details_outdated_checked_at: Optional[datetime] = None

    @validator('description', 'location_id', 'organization_id', 'email', 'primary_tag_id', 
               'secondary_tag_id', 'image_id', 'parent_event_id', 'google_calendar_event_id', 
               'cost', 'source_id', pre=True)
    def validate_postgres_nulls(cls, v):
        return postgres_null_validator(cls, v)

    @validator('website', 'registration_link', 'external_image_url', pre=True)
    def validate_postgres_null_url(cls, v):
        return postgres_null_url_validator(cls, v)

    @validator('start_date', 'end_date', pre=True)
    def validate_dates(cls, v):
        return parse_date_validator(cls, v)

    @validator('start_time', 'end_time', pre=True)
    def validate_times(cls, v):
        return parse_time_validator(cls, v)

    @validator('details_outdated_checked_at', pre=True)
    def validate_datetime(cls, v):
        return parse_datetime_validator(cls, v)

    @validator('status', pre=True)
    def validate_status_enum(cls, v):
        return status_enum_pre_validator(EventStatus)(cls, v)

    @validator('featured', 'exclude_from_calendar', 'registration', pre=True)
    def validate_booleans(cls, v):
        return parse_boolean_validator(cls, v)

    @validator('end_date')
    def validate_end_date(cls, v, values):
        if v and 'start_date' in values and v < values['start_date']:
            raise ValueError('End date must be after or equal to start date')
        return v

    @validator('end_time')
    def validate_end_time(cls, v, values):
        if v and 'start_time' in values and values['start_date'] == values.get('end_date'):
            if v <= values['start_time']:
                raise ValueError('End time must be after start time when on the same date')
        return v


class EventStaged(BaseEntity):
    """Staged event model for public submissions."""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    location_id: Optional[str] = None
    organization_id: Optional[str] = None
    email: Optional[str] = Field(None, pattern=r'^[^@]+@[^@]+\.[^@]+$')
    website: Optional[HttpUrl] = None
    registration_link: Optional[HttpUrl] = None
    primary_tag_id: Optional[str] = None
    secondary_tag_id: Optional[str] = None
    image_id: Optional[str] = None
    external_image_url: Optional[HttpUrl] = None
    featured: bool = False
    parent_event_id: Optional[str] = None
    exclude_from_calendar: bool = False
    google_calendar_event_id: Optional[str] = None
    registration: bool = False
    cost: Optional[str] = Field(None, max_length=100)
    status: str = "pending"
    source_id: Optional[str] = None
    details_outdated_checked_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None

    @validator('description', 'location_id', 'organization_id', 'email', 'primary_tag_id', 
               'secondary_tag_id', 'image_id', 'parent_event_id', 'google_calendar_event_id', 
               'cost', 'source_id', pre=True)
    def validate_postgres_nulls(cls, v):
        return postgres_null_validator(cls, v)

    @validator('website', 'registration_link', 'external_image_url', pre=True)
    def validate_postgres_null_url(cls, v):
        return postgres_null_url_validator(cls, v)

    @validator('start_date', 'end_date', pre=True)
    def validate_dates(cls, v):
        return parse_date_validator(cls, v)

    @validator('start_time', 'end_time', pre=True)
    def validate_times(cls, v):
        return parse_time_validator(cls, v)

    @validator('details_outdated_checked_at', 'submitted_at', pre=True)
    def validate_datetime(cls, v):
        return parse_datetime_validator(cls, v)

    @validator('featured', 'exclude_from_calendar', 'registration', pre=True)
    def validate_booleans(cls, v):
        return parse_boolean_validator(cls, v)

    @validator('end_date')
    def validate_end_date(cls, v, values):
        if v and 'start_date' in values and v < values['start_date']:
            raise ValueError('End date must be after or equal to start date')
        return v

    @validator('end_time')
    def validate_end_time(cls, v, values):
        if v and 'start_time' in values and values['start_date'] == values.get('end_date'):
            if v <= values['start_time']:
                raise ValueError('End time must be after start time when on the same date')
        return v


class Announcement(BaseEntity):
    """Announcement model for community announcements."""
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1, max_length=2000)
    link: Optional[HttpUrl] = None
    email: Optional[str] = Field(None, pattern=r'^[^@]+@[^@]+\.[^@]+$')
    organization_id: Optional[str] = None
    author: Optional[str] = Field(None, max_length=255)
    status: AnnouncementStatus = AnnouncementStatus.PENDING
    show_at: datetime = Field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None

    @validator('email', 'organization_id', 'author', pre=True)
    def validate_postgres_nulls(cls, v):
        return postgres_null_validator(cls, v)

    @validator('link', pre=True)
    def validate_postgres_null_url(cls, v):
        return postgres_null_url_validator(cls, v)

    @validator('status', pre=True)
    def validate_status_enum(cls, v):
        return status_enum_pre_validator(AnnouncementStatus)(cls, v)

    @validator('show_at', 'expires_at', pre=True)
    def validate_datetime(cls, v):
        return parse_datetime_validator(cls, v)

    @validator('expires_at')
    def validate_expires_at(cls, v, values):
        if v and 'show_at' in values and v <= values['show_at']:
            raise ValueError('Expires at must be after show at')
        return v


class ScrapeLog(BaseEntity):
    """Scrape log model for tracking data ingestion."""
    source_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    status: str = Field(..., max_length=50)
    error_message: Optional[str] = None

    @validator('error_message', pre=True)
    def validate_postgres_nulls(cls, v):
        return postgres_null_validator(cls, v)

    @validator('timestamp', pre=True)
    def validate_datetime(cls, v):
        return parse_datetime_validator(cls, v)


# API Response Models
class ApiResponse(BaseModel):
    """Generic API response wrapper."""
    data: Optional[dict] = None
    error: Optional[str] = None
    success: bool = True


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""
    data: List[dict]
    count: int
    page: int
    page_size: int
    total_pages: int


# Form Models for Event Submission
class EventSubmissionForm(BaseModel):
    """Form model for public event submissions."""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    location_name: Optional[str] = Field(None, max_length=255)
    organization_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, pattern=r'^[^@]+@[^@]+\.[^@]+$')
    website: Optional[HttpUrl] = None
    registration_link: Optional[HttpUrl] = None
    primary_tag_name: Optional[str] = Field(None, max_length=100)
    cost: Optional[str] = Field(None, max_length=100)
    registration: bool = False

    @validator('description', 'location_name', 'organization_name', 'email', 
               'primary_tag_name', 'cost', pre=True)
    def validate_postgres_nulls(cls, v):
        return postgres_null_validator(cls, v)

    @validator('website', 'registration_link', pre=True)
    def validate_postgres_null_url(cls, v):
        return postgres_null_url_validator(cls, v)

    @validator('start_date', 'end_date', pre=True)
    def validate_dates(cls, v):
        return parse_date_validator(cls, v)

    @validator('start_time', 'end_time', pre=True)
    def validate_times(cls, v):
        return parse_time_validator(cls, v)

    @validator('registration', pre=True)
    def validate_booleans(cls, v):
        return parse_boolean_validator(cls, v)

    @validator('end_date')
    def validate_end_date(cls, v, values):
        if v and 'start_date' in values and v < values['start_date']:
            raise ValueError('End date must be after or equal to start date')
        return v

    @validator('end_time')
    def validate_end_time(cls, v, values):
        if v and 'start_time' in values and values['start_date'] == values.get('end_date'):
            if v <= values['start_time']:
                raise ValueError('End time must be after start time when on the same date')
        return v


class EventFilters(BaseModel):
    """Event search and filter parameters."""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    location_id: Optional[str] = None
    organization_id: Optional[str] = None
    primary_tag_id: Optional[str] = None
    secondary_tag_id: Optional[str] = None
    featured: Optional[bool] = None
    status: Optional[EventStatus] = None
    search: Optional[str] = Field(None, max_length=255)

    @validator('location_id', 'organization_id', 'primary_tag_id', 'secondary_tag_id', 
               'search', pre=True)
    def validate_postgres_nulls(cls, v):
        return postgres_null_validator(cls, v)

    @validator('start_date', 'end_date', pre=True)
    def validate_dates(cls, v):
        return parse_date_validator(cls, v)

    @validator('status', pre=True)
    def validate_status_enum(cls, v):
        return status_enum_pre_validator(EventStatus)(cls, v)

    @validator('featured', pre=True)
    def validate_booleans(cls, v):
        return parse_boolean_validator(cls, v)


class EventSearchParams(BaseModel):
    """Event search parameters with pagination."""
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    filters: Optional[EventFilters] = None
    sort_by: str = Field("start_date", pattern="^(start_date|title|created_at)$")
    sort_order: str = Field("asc", pattern="^(asc|desc)$")


# Utility functions
def create_event_from_staged(staged_event: EventStaged) -> Event:
    """Create an Event from an EventStaged instance."""
    event_data = staged_event.model_dump()
    event_data['submitted_at'] = None  # Remove staged-specific field
    return Event(**event_data)


def validate_uuid(uuid_string: str) -> bool:
    """Validate if a string is a valid UUID."""
    try:
        uuid.UUID(uuid_string)
        return True
    except ValueError:
        return False 