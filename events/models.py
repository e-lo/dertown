import urllib.parse
from itertools import zip_longest

from django.db import models
from django.db.models import Q
from django.utils import timezone
from wagtail.admin.panels import FieldPanel
from wagtail.fields import RichTextField
from wagtail.models import Page

from .utils import get_homepage_events


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
        context = super().get_context(request, *args, **kwargs)
        context["events"] = get_homepage_events()
        from .models import CommunityAnnouncement, Event

        context["announcements"] = CommunityAnnouncement.objects.filter(active=True)
        num_events = int(request.GET.get("num_events", 10))
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
        """Google Calendar subscribe (add) link."""
        if self.google_calendar_id:
            share_id = urllib.parse.quote(self.share_id)
            return f"https://calendar.google.com/calendar/u/1?cid={share_id}"
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
    panels = [
        FieldPanel("name"),
        FieldPanel("website"),
        FieldPanel("phone"),
        FieldPanel("address"),
        FieldPanel("latitude"),
        FieldPanel("longitude"),
        FieldPanel("parent_location"),
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

    panels = [
        FieldPanel("name"),
        FieldPanel("description"),
        FieldPanel("website"),
        FieldPanel("phone"),
        FieldPanel("email"),
        FieldPanel("location"),
        FieldPanel("parent_organization"),
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
    STATUS_CHOICES = [
        ("pending", "Pending Review"),
        ("approved", "Approved/Published"),
        ("rejected", "Rejected"),
        ("archived", "Archived"),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        help_text="Moderation status: pending, approved, rejected, or archived.",
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

    @staticmethod
    def group_events(events, group_size=3):
        """Group events into lists of specified size."""
        args = [iter(events)] * group_size
        return list(zip_longest(*args, fillvalue=None))

    @classmethod
    def get_upcoming_events(cls, limit=None):
        """Get upcoming events ordered by start date."""
        events = cls.objects.filter(
            start_date__gte=timezone.now().date(), status="approved"
        ).order_by("start_date", "start_time")
        if limit:
            events = events[:limit]
        return events

    @classmethod
    def get_upcoming_by_category(cls, num_events=10):
        """Return a list of (tag, events) for all categories with upcoming events."""
        from .models import Tag

        tags = Tag.objects.all()
        result = []
        today = timezone.now().date()
        for tag in tags:
            events = cls.objects.filter(
                Q(primary_tag=tag) | Q(secondary_tag=tag), start_date__gte=today, status="approved"
            ).order_by("start_date", "start_time")[:num_events]
            if events:
                result.append({"tag": tag, "events": events})
        return result

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
