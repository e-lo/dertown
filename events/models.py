import urllib.parse
from datetime import datetime

from django.db import models
from django.db.models import Q
from django.utils import timezone
from wagtail.admin.panels import FieldPanel
from wagtail.fields import RichTextField
from wagtail.models import Page

DEFAULT_EVENTS_PER_CATEGORY = 10
HOMEPAGE_UPCOMING_EVENTS = 8
HOMEPAGE_FEATURED_EVENTS = 4


class SimplePage(Page):
    body = RichTextField(blank=True)

    content_panels = Page.content_panels + [
        FieldPanel("body"),
    ]


class HomePage(Page):
    body = RichTextField(blank=True)

    content_panels = Page.content_panels + [
        FieldPanel("body"),
    ]

    def get_context(self, request, *args, **kwargs):
        from .models import CommunityAnnouncement, Event

        context = super().get_context(request, *args, **kwargs)
        context["events"] = Event.get_homepage_events(
            num_upcoming_events=HOMEPAGE_UPCOMING_EVENTS,
            num_featured_events=HOMEPAGE_FEATURED_EVENTS,
        )
        context["announcements"] = CommunityAnnouncement.objects.filter(active=True)
        num_events = int(request.GET.get("num_events", DEFAULT_EVENTS_PER_CATEGORY))
        context["category_events"] = Event.get_upcoming_by_category(num_events=num_events)
        context["num_events"] = num_events
        return context


class Tag(models.Model):
    name = models.CharField(max_length=100)
    calendar_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Google Calendar ID for this tag/category \
            (for subscriptions, embeds, and iCal feeds)",
    )
    share_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Special id for sharing the google calendar.",
    )

    panels = [
        FieldPanel("name"),
        FieldPanel("calendar_id"),
        FieldPanel("share_id"),
    ]

    def __str__(self):
        return self.name

    @property
    def google_calendar_id(self):
        """Full Google Calendar ID."""
        if self.calendar_id:
            full_id = f"{self.calendar_id}@group.calendar.google.com"
            return urllib.parse.quote(full_id)
        return None

    @property
    def google_subscribe_url(self):
        """Google Calendar subscribe (add) link. Uses share_id, otherwise uses calendar_id."""
        if self.share_id:
            share_id = urllib.parse.quote(self.share_id)
            return f"https://calendar.google.com/calendar/u/1?cid={share_id}"
        elif self.google_calendar_id:
            return f"https://calendar.google.com/calendar/u/1?cid={self.google_calendar_id}"
        return None

    @property
    def google_calendar_embed_url(self):
        """Google Calendar embed link."""
        if self.google_calendar_id:
            encoded_id = urllib.parse.quote(self.google_calendar_id)
            return f"https://calendar.google.com/calendar/embed?src={encoded_id}"
        return None

    @property
    def google_calendar_ical_url(self):
        """Google Calendar iCal feed link."""
        if self.google_calendar_id:
            encoded_id = urllib.parse.quote(self.google_calendar_id)
            return f"webcal://calendar.google.com/calendar/ical/{encoded_id}%40group.calendar.google.com/public/basic.ics"
        return None

    @property
    def outlook_calendar_url(self):
        """Outlook Calendar URL."""
        if self.google_calendar_id:
            encoded_id = urllib.parse.quote(self.google_calendar_id)
            return f"https://outlook.live.com/owa/?path=/calendar/action/compose&rru=addsubscription&url=https://calendar.google.com/calendar/ical/{encoded_id}/public/basic.ics"
        return None

    class Meta:
        verbose_name = "Tag"
        verbose_name_plural = "Tags"


class Location(models.Model):
    name = models.CharField(max_length=100)
    address = models.TextField(null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    parent_location = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sub_locations",
        help_text="Optional parent location (e.g., a city that contains multiple neighborhoods)",
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending Review"),
            ("approved", "Approved/Published"),
            ("duplicate", "Duplicate"),
            ("archived", "Archived"),
        ],
        default="pending",
        help_text="Moderation status: pending, approved, duplicate, or archived.",
    )
    panels = [
        FieldPanel("name"),
        FieldPanel("website"),
        FieldPanel("phone"),
        FieldPanel("address"),
        FieldPanel("latitude"),
        FieldPanel("longitude"),
        FieldPanel("parent_location"),
        FieldPanel("status"),
    ]

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Location"
        verbose_name_plural = "Locations"


class Organization(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    website = models.URLField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True)
    parent_organization = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sub_organizations",
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending Review"),
            ("approved", "Approved/Published"),
            ("duplicate", "Duplicate"),
            ("archived", "Archived"),
        ],
        default="pending",
        help_text="Moderation status: pending, approved, duplicate, or archived.",
    )

    panels = [
        FieldPanel("name"),
        FieldPanel("description"),
        FieldPanel("website"),
        FieldPanel("phone"),
        FieldPanel("email"),
        FieldPanel("location"),
        FieldPanel("parent_organization"),
        FieldPanel("status"),
    ]

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"


class Event(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    location = models.ForeignKey(Location, on_delete=models.SET_NULL, null=True, blank=True)
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    website = models.URLField(
        null=True, blank=True, help_text="Event website or more information URL"
    )
    registration_link = models.URLField(
        null=True, blank=True, help_text="Link to event registration page"
    )
    primary_tag = models.ForeignKey(
        Tag, on_delete=models.SET_NULL, null=True, blank=True, related_name="primary_events"
    )
    secondary_tag = models.ForeignKey(
        Tag, on_delete=models.SET_NULL, null=True, blank=True, related_name="secondary_events"
    )
    image = models.ForeignKey(
        "wagtailimages.Image", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    external_image_url = models.URLField(null=True, blank=True)
    featured = models.BooleanField(default=False)
    parent_event = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sub_events",
        help_text="Optional parent event (e.g., a walk that is part of a festival)",
    )
    exclude_from_calendar = models.BooleanField(
        default=False, help_text="Exclude this event from the calendar and event list."
    )
    google_calendar_event_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Google Calendar event ID for syncing. Leave blank to create new event.",
    )
    registration_required = models.BooleanField(
        default=False, help_text="Is registration or ticket purchase required?"
    )
    fee = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Event fee, e.g. '$10', 'Free', 'Donation', or a range",
    )
    STATUS_CHOICES = [
        ("pending", "Pending Review"),
        ("approved", "Approved/Published"),
        ("duplicate", "Duplicate"),
        ("archived", "Archived"),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Moderation status: pending, approved, duplicate, or archived.",
    )

    panels = [
        FieldPanel("title"),
        FieldPanel("description"),
        FieldPanel("start_date"),
        FieldPanel("start_time"),
        FieldPanel("end_date"),
        FieldPanel("end_time"),
        FieldPanel("location"),
        FieldPanel("organization"),
        FieldPanel("primary_tag"),
        FieldPanel("secondary_tag"),
        FieldPanel("email"),
        FieldPanel("website"),
        FieldPanel("registration_link"),
        FieldPanel("registration_required"),
        FieldPanel("fee"),
        FieldPanel("image"),
        FieldPanel("external_image_url"),
        FieldPanel("google_calendar_event_id"),
        FieldPanel("featured"),
        FieldPanel("parent_event"),
        FieldPanel("exclude_from_calendar"),
        FieldPanel("status"),
    ]

    def __str__(self):
        return self.title

    @property
    def start_datetime(self):
        """Get the start datetime of the event. Defaults to midnight if no start_time."""
        if self.start_time:
            return datetime.combine(self.start_date, self.start_time)
        return datetime.combine(self.start_date, datetime.min.time())

    @property
    def end_datetime(self):
        """Get the end datetime of the event. Defaults to end of day if no end_time."""
        end_date = self.end_date or self.start_date
        if self.end_time:
            return datetime.combine(end_date, self.end_time)
        return datetime.combine(end_date, datetime.max.time())

    @property
    def is_today(self):
        """Check if the event is today.

        Event is today if:
        1. The start date is today or
        2. The start date is in the past and the end date is today or in the future
        """
        today = timezone.now().date()
        if not self.start_date <= today:
            return False
        if self.start_date == today:
            return True
        if self.end_date and today <= self.end_date:
            return True
        return False

    @property
    def is_happening_now(self):
        """Check if the event is happening now.

        Event is happening now if:

        1. The event is today AND
        2. The start time is the past and either:
          a. the end time is in the future or
          b. there is no end time.
        """
        if not self.is_today:
            return False
        now = timezone.now()
        if self.start_datetime <= now <= self.end_datetime:
            return True
        if self.start_datetime <= now and not self.end_time:
            return True
        return False

    @classmethod
    def filter_visible(cls, queryset):
        """Filter events to only those that are visible & approved."""
        return queryset.filter(exclude_from_calendar=False, status="approved")

    @classmethod
    def get_visible_events(cls, limit=None):
        """Get visible & approved events ordered by start date."""
        events = cls.filter_visible(cls.objects).order_by("start_date", "start_time")
        if limit:
            events = events[:limit]
        return events

    @classmethod
    def filter_upcoming(cls, queryset):
        """Filter visible events to only those that are upcoming."""
        today = timezone.now().date()
        visible_events = cls.filter_visible(queryset)
        return visible_events.filter(Q(start_date__gte=today) | Q(end_date__gte=today))

    @classmethod
    def get_upcoming_events(cls, limit=None):
        """Get vsible upcoming events ordered by start date."""
        events = cls.filter_upcoming(cls.objects).order_by("start_date", "start_time")
        if limit:
            events = events[:limit]
        return events

    @classmethod
    def filter_featured(cls, queryset):
        """Filter visible upcoming events to only those that are featured."""
        visible_upcoming = cls.filter_upcoming(queryset)
        return visible_upcoming.filter(featured=True)

    @classmethod
    def get_featured_events(cls, limit=None):
        """Get featured events ordered by start date."""
        events = cls.filter_featured(cls.objects).order_by("start_date", "start_time")
        if limit:
            events = events[:limit]
        return events

    @classmethod
    def filter_tags(cls, queryset, tags: list[Tag]):
        """Filter visible upcoming events to only those that have any of the given tags."""
        visible_upcoming = cls.filter_upcoming(queryset)
        return visible_upcoming.filter(Q(primary_tag__in=tags) | Q(secondary_tag__in=tags))

    @classmethod
    def get_upcoming_by_category(cls, num_events=10):
        """Return a list of (tag, events) for all categories with upcoming visible events."""
        from .models import Tag

        tags = Tag.objects.all()
        result = []
        for tag in tags:
            # Filter first, then slice
            events = cls.filter_tags(cls.get_upcoming_events(), [tag])[:num_events]
            if events:
                result.append({"tag": tag, "events": events})
        return result

    @classmethod
    def get_homepage_events(cls, num_upcoming_events=8, num_featured_events=4):
        """Get the events for the homepage."""
        from .utils import mix_lists

        featured_events_qs = cls.get_featured_events(num_featured_events)
        non_featured_upcoming = cls.get_upcoming_events().filter(featured=False)[
            :num_upcoming_events
        ]
        return mix_lists(featured_events_qs, non_featured_upcoming)

    class Meta:
        ordering = ["start_date", "start_time"]
        verbose_name = "Event"
        verbose_name_plural = "Events"


class CommunityAnnouncement(models.Model):
    title = models.CharField(max_length=200)
    message = models.TextField()
    link = models.URLField(blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    organization = models.ForeignKey(
        Organization, on_delete=models.SET_NULL, null=True, blank=True, related_name="announcements"
    )
    author = models.CharField(max_length=100, blank=True, null=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
