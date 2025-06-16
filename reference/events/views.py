import logging
import traceback
from datetime import datetime, timedelta

import django_filters
import pytz
from django.contrib import messages
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.feedgenerator import Rss201rev2Feed
from django.utils.http import urlencode
from icalendar import Calendar
from icalendar import Event as ICalEvent
from wagtail.admin.filters import WagtailFilterSet
from wagtail.snippets.views.snippets import SnippetViewSet, SnippetViewSetGroup

from .forms import PublicEventSubmissionForm
from .models import CommunityAnnouncement, Event, Location, Organization, Tag

logger = logging.getLogger(__name__)


class TagViewSet(SnippetViewSet):
    model = Tag
    icon = "tag"
    list_display = ["name"]
    search_fields = ["name", "description"]


class OrganizationViewSet(SnippetViewSet):
    model = Organization
    icon = "group"
    list_display = ["name", "status", "website", "email"]
    search_fields = ["name", "website"]
    list_filter = ["status"]


class LocationViewSet(SnippetViewSet):
    model = Location
    icon = "site"
    list_display = ["name", "status", "address", "parent_location"]
    search_fields = ["name", "address", "description"]
    list_filter = ["status"]


class CommunityAnnouncementViewSet(SnippetViewSet):
    model = CommunityAnnouncement
    list_display = ["title", "active", "organization", "author", "created_at", "expires_at"]
    search_fields = ["title", "message", "author"]
    list_filter = ["active", "organization"]


class SnippetAdminViewSetGroup(SnippetViewSetGroup):
    items = (OrganizationViewSet, LocationViewSet, CommunityAnnouncementViewSet, TagViewSet)
    menu_icon = "table"
    menu_label = "Data"
    menu_name = "data"


class EventFilterSet(WagtailFilterSet):
    is_upcoming = django_filters.BooleanFilter(method="filter_is_upcoming", label="Upcoming")
    needs_review = django_filters.BooleanFilter(method="filter_needs_review", label="Needs Review")

    class Meta:
        model = Event
        fields = ["is_upcoming", "needs_review"]

    def filter_is_upcoming(self, queryset, name, value):
        if value:
            today = timezone.now().date()
            return queryset.filter(Q(start_date__gt=today) | Q(end_date__gt=today))
        return queryset

    def filter_needs_review(self, queryset, name, value):
        if value:
            today = timezone.now().date()
            return queryset.filter(
                Q(status="pending", start_date__gt=today)
                | Q(primary_tag__isnull=True, start_date__gt=today)
            )
        return queryset


class EventSnippetViewSet(SnippetViewSet):
    model = Event
    list_display = ["title", "status", "start_date", "primary_tag", "parent_event"]
    search_fields = [
        "title",
        "description",
        "organization__name",
        "location__name",
        "parent_event__name",
    ]
    filterset_class = EventFilterSet
    icon = "list-ul"
    menu_label = "Events"
    menu_name = "events"
    ordering = ["-start_date", "-start_time"]


class NeedsReviewEventsViewSet(EventSnippetViewSet):
    menu_label = "Needs Review"
    menu_name = "needs_review_events"
    icon = "warning"

    # Override menu_url to point to the filtered view
    @property
    def menu_url(self):
        return "/admin/snippets/events/event/?needs_review=true"


class EventSnippetViewSetGroup(SnippetViewSetGroup):
    menu_label = "Events"
    menu_icon = "calendar"
    menu_name = "events_group"
    items = (EventSnippetViewSet, NeedsReviewEventsViewSet)


def event_list(request):
    today = timezone.now().date()
    events = Event.objects.filter(
        Q(exclude_from_calendar=False),
        Q(end_date__gte=today) | Q(end_date__isnull=True, start_date__gte=today),
        status="approved",
    ).order_by("start_date", "start_time")
    all_tags = Tag.objects.all().order_by("name")
    return render(
        request,
        "events/event_list.html",
        {
            "events": events,
            "all_tags": all_tags,
        },
    )


def calendar_view(request):
    # Get all unique tags, organizations, and locations for filters
    tags = Tag.objects.all().order_by("name")
    organizations = Organization.objects.all().order_by("name")
    locations = Location.objects.all().order_by("name")

    return render(
        request,
        "events/calendar.html",
        {
            "tags": tags,
            "organizations": organizations,
            "locations": locations,
        },
    )


def event_detail(request, event_id):
    event = get_object_or_404(Event, id=event_id)
    return render(
        request,
        "events/event_detail.html",
        {
            "event": event,
        },
    )


def events_api(request):
    logger.info("Events API called with params: %s", request.GET)

    # Get start and end parameters from the request
    start = request.GET.get("start")
    end = request.GET.get("end")

    # Get filter parameters
    tags = request.GET.getlist("tags[]")  # Get multiple tag IDs or names
    organization = request.GET.get("organization")
    location = request.GET.get("location")

    # Convert to datetime objects if provided
    if start:
        start_date = datetime.fromisoformat(start.replace("Z", "+00:00"))
    else:
        start_date = timezone.now() - timedelta(days=30)

    if end:
        end_date = datetime.fromisoformat(end.replace("Z", "+00:00"))
    else:
        end_date = timezone.now() + timedelta(days=60)

    logger.info("Querying events between %s and %s", start_date, end_date)

    # Build the base query
    events = Event.objects.filter(
        Q(exclude_from_calendar=False),
        Q(end_date__gte=start_date.date())
        | Q(end_date__isnull=True, start_date__gte=start_date.date()),
        start_date__lte=end_date.date(),
        status="approved",
    ).select_related("location", "organization", "primary_tag", "secondary_tag")

    # If tags are present, convert names to IDs if needed
    tag_ids = []
    if tags:
        for tag in tags:
            if tag.isdigit():
                tag_ids.append(int(tag))
            else:
                tag_obj = Tag.objects.filter(name__iexact=tag).first()
                if tag_obj:
                    tag_ids.append(tag_obj.id)

    # Apply tag filter if provided
    if tag_ids:
        events = events.filter(Q(primary_tag__id__in=tag_ids) | Q(secondary_tag__id__in=tag_ids))

    # Apply other filters if provided
    if organization:
        events = events.filter(organization__id=organization)
    if location:
        events = events.filter(location__id=location)

    # Get available organizations and locations for the current timeframe
    available_organizations = (
        Organization.objects.filter(
            event__start_date__gte=start_date.date(), event__start_date__lte=end_date.date()
        )
        .distinct()
        .values("id", "name")
    )

    available_locations = (
        Location.objects.filter(
            event__start_date__gte=start_date.date(), event__start_date__lte=end_date.date()
        )
        .distinct()
        .values("id", "name")
    )

    # Convert events to calendar format
    calendar_events = []
    for event in events:
        # Create start datetime
        start_datetime = (
            datetime.combine(event.start_date, event.start_time)
            if event.start_time
            else event.start_date
        )

        # Create end datetime
        if event.end_date:
            if event.end_time:
                end_datetime = datetime.combine(event.end_date, event.end_time)
            else:
                end_datetime = datetime.combine(event.end_date, datetime.max.time())
        elif event.end_time:
            end_datetime = datetime.combine(event.start_date, event.end_time)
        else:
            end_datetime = start_datetime + timedelta(hours=1)

        calendar_event = {
            "id": event.id,
            "title": ("★ " + event.title) if event.featured else event.title,
            "start": start_datetime.isoformat(),
            "end": end_datetime.isoformat(),
            "description": event.description,
            "location": event.location.name if event.location else None,
            "organization": event.organization.name if event.organization else None,
            "featured": event.featured,
            "extendedProps": {
                "primary_tag": event.primary_tag.name if event.primary_tag else None,
                "secondary_tag": event.secondary_tag.name if event.secondary_tag else None,
                "location": event.location.name if event.location else None,
                "organization": event.organization.name if event.organization else None,
                "featured": event.featured,
                "description": event.description,
            },
        }

        # Set event color based on primary tag
        if event.primary_tag:
            calendar_event["textColor"] = "#FFFFFF"  # White text for better contrast

        # If it's a multi-day event, mark it as all-day
        if event.end_date and event.end_date > event.start_date:
            calendar_event["allDay"] = True

        calendar_events.append(calendar_event)

    # Return both events and available filters
    response_data = {
        "events": calendar_events,
        "available_filters": {
            "organizations": list(available_organizations),
            "locations": list(available_locations),
        },
    }

    return JsonResponse(response_data)


def add_to_calendar(request, event_id, calendar_type):
    event = get_object_or_404(Event, id=event_id)

    # Use Pacific Time for Leavenworth, WA
    tz = pytz.timezone("America/Los_Angeles")

    # Create start and end datetimes
    start_dt = datetime.combine(event.start_date, event.start_time or datetime.min.time())
    start_dt = tz.localize(start_dt)

    if event.end_date:
        end_dt = datetime.combine(event.end_date, event.end_time or datetime.max.time())
    else:
        end_dt = datetime.combine(
            event.start_date, event.end_time or (event.start_time or datetime.max.time())
        )
    end_dt = tz.localize(end_dt)

    # Format dates for Google Calendar and Outlook
    # Convert to UTC for the calendar services
    start_str = start_dt.astimezone(pytz.UTC).strftime("%Y%m%dT%H%M%SZ")
    end_str = end_dt.astimezone(pytz.UTC).strftime("%Y%m%dT%H%M%SZ")

    if calendar_type == "google":
        # Google Calendar URL
        params = {
            "action": "TEMPLATE",
            "text": event.title,
            "dates": f"{start_str}/{end_str}",
            "details": event.description or "",
            "location": str(event.location) if event.location else "",
            "ctz": "America/Los_Angeles",  # Specify timezone
        }
        if event.website:
            params["details"] += f"\n\nMore information: {event.website}"
        calendar_url = f"https://calendar.google.com/calendar/render?{urlencode(params)}"
        return redirect(calendar_url)

    elif calendar_type == "outlook":
        # Outlook URL
        base_url = "https://outlook.live.com/calendar/0/calendar/action/compose"
        params = {
            "rru": "addevent",
            "subject": event.title,
            "startdt": start_dt.isoformat(),
            "enddt": end_dt.isoformat(),
            "body": event.description or "",
            "location": str(event.location) if event.location else "",
            "timezone": "America/Los_Angeles",  # Specify timezone
        }
        if event.website:
            params["body"] += f"\n\nMore information: {event.website}"
        calendar_url = f"{base_url}?{urlencode(params)}"
        return redirect(calendar_url)

    elif calendar_type == "ical":
        # Create iCal file
        cal = Calendar()
        cal.add("prodid", "-//DerTown Events//EN")
        cal.add("version", "2.0")

        ical_event = ICalEvent()
        ical_event.add("summary", event.title)
        ical_event.add("dtstart", start_dt)
        ical_event.add("dtend", end_dt)
        if event.description:
            ical_event.add("description", event.description)
        if event.location:
            ical_event.add("location", str(event.location))
        if event.website:
            ical_event.add("url", event.website)

        # Add timezone information
        cal.add("tzid", "America/Los_Angeles")

        cal.add_component(ical_event)

        response = HttpResponse(cal.to_ical(), content_type="text/calendar")
        response["Content-Disposition"] = f'attachment; filename="{event.title}.ics"'
        return response

    return HttpResponse(status=400)  # Invalid calendar type


def add_all_to_calendar(request, event_id, calendar_type):
    parent_event = get_object_or_404(Event, id=event_id)
    sub_events = parent_event.sub_events.all()

    if calendar_type == "ical":
        cal = Calendar()
        cal.add("prodid", "-//DerTown Events//EN")
        cal.add("version", "2.0")
        cal.add("tzid", "America/Los_Angeles")

        # Add the parent event itself
        def add_ical_event(ev):
            tz = pytz.timezone("America/Los_Angeles")
            start_dt = datetime.combine(ev.start_date, ev.start_time or datetime.min.time())
            start_dt = tz.localize(start_dt)
            if ev.end_date:
                end_dt = datetime.combine(ev.end_date, ev.end_time or datetime.max.time())
            else:
                end_dt = datetime.combine(
                    ev.start_date, ev.end_time or (ev.start_time or datetime.max.time())
                )
            end_dt = tz.localize(end_dt)
            ical_event = ICalEvent()
            ical_event.add("summary", ev.title)
            ical_event.add("dtstart", start_dt)
            ical_event.add("dtend", end_dt)
            if ev.description:
                ical_event.add("description", ev.description)
            if ev.location:
                ical_event.add("location", str(ev.location))
            if hasattr(ev, "website") and ev.website:
                ical_event.add("url", ev.website)
            cal.add_component(ical_event)

        add_ical_event(parent_event)
        for sub_event in sub_events:
            add_ical_event(sub_event)

        response = HttpResponse(cal.to_ical(), content_type="text/calendar")
        response["Content-Disposition"] = (
            f'attachment; filename="{parent_event.title}_and_sub_events.ics"'
        )
        return response
    else:
        return HttpResponse(
            "Adding multiple events at once is only supported for iCal download. \
                Please import the .ics file into Google Calendar or Outlook."
        )


def events_rss(request):
    """Return an RSS feed of upcoming events, optionally filtered by event type (primary_tag)."""
    event_type = request.GET.get("type")
    events = Event.objects.filter(
        start_date__gte=timezone.now().date(), status="approved"
    ).order_by("start_date", "start_time")
    if event_type:
        events = events.filter(primary_tag__name__iexact=event_type)
    feed = Rss201rev2Feed(
        title="Der Town Events",
        link=request.build_absolute_uri("/events/rss/"),
        description="Upcoming community events in Leavenworth, WA",
        language="en",
    )
    for event in events:
        start_time = event.start_time.strftime("%I:%M %p") if event.start_time else ""
        end_time = event.end_time.strftime("%I:%M %p") if event.end_time else ""
        date_str = event.start_date.strftime("%B %d, %Y")
        if start_time:
            date_str += f" at {start_time}"
            if end_time:
                date_str += f" - {end_time}"
        description = (
            f"{event.description or ''}<br>Location: {event.location or ''}<br>Date: {date_str}"
        )
        if event.website:
            description += f"<br><a href='{event.website}'>More info</a>"
        feed.add_item(
            title=event.title,
            link=request.build_absolute_uri(f"/events/{event.id}/"),
            description=description,
            pubdate=event.start_date,
            unique_id=str(event.id),
        )
    rss_content = feed.writeString("utf-8")
    return HttpResponse(rss_content, content_type="application/rss+xml")


def submit_event(request):
    if request.method == "POST":
        form = PublicEventSubmissionForm(request.POST or None)
        if form.is_valid():
            event = form.save(commit=False)
            event.status = "pending"  # Ensure status is pending
            event.save()
            messages.success(request, "Thank you! Your event has been submitted for review.")
            return redirect(reverse("events:submit_event_thank_you"))
    else:
        form = PublicEventSubmissionForm()
    return render(request, "events/submit_event.html", {"form": form})


def submit_event_thank_you(request):
    return render(request, "events/submit_event_thank_you.html")


def debug_check(request):
    try:
        # Test database
        from django.db import connection

        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        db_ok = cursor.fetchone()[0] == 1

        # Test Wagtail
        from wagtail.models import Site

        sites = list(Site.objects.all())
        site_count = len(sites)

        # Check context processors
        from context_processors import your_processor

        processor_result = your_processor(request)

        result = {
            "db_connection": db_ok,
            "site_count": site_count,
            "processor_keys": list(processor_result.keys()),
        }
        return JsonResponse({"status": "ok", "checks": result})
    except Exception as e:
        return JsonResponse(
            {"status": "error", "error": str(e), "traceback": traceback.format_exc()}
        )


def server_error(request, exception=None):
    import sys
    import traceback

    exc_type, exc_value, exc_tb = sys.exc_info()
    tb_str = "".join(traceback.format_exception(exc_type, exc_value, exc_tb))

    return render(
        request,
        "500.html",
        {
            "exception": exception,
            "exception_type": exc_type,
            "exception_value": exc_value,
            "traceback": tb_str,
            "request": request,
        },
        status=500,
    )
