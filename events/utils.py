from datetime import datetime

from django.db.models import Q
from django.utils import timezone


def is_happening_now(event):
    now = timezone.now()
    event_start = (
        datetime.combine(event.start_date, event.start_time)
        if event.start_time
        else datetime.combine(event.start_date, datetime.min.time())
    )
    event_end = (
        datetime.combine(event.end_date or event.start_date, event.end_time)
        if event.end_time
        else datetime.combine(event.start_date, datetime.max.time())
    )
    # Make event_start and event_end timezone-aware if they are naive
    if timezone.is_naive(event_start):
        event_start = timezone.make_aware(event_start, timezone.get_current_timezone())
    if timezone.is_naive(event_end):
        event_end = timezone.make_aware(event_end, timezone.get_current_timezone())
    return event_start <= now <= event_end


def is_today(event):
    return event.start_date == timezone.now().date()


def get_homepage_events():
    from .models import Event  # moved import here to avoid circular import

    now = timezone.now()
    today = now.date()
    current_time = now.time()
    Event.objects.filter(status="approved")
    # Get upcoming events (including featured)
    upcoming_events = Event.objects.filter(
        Q(start_date__gt=today)
        | (
            Q(start_date=today)
            & (
                (Q(end_time__isnull=False) & Q(end_time__gte=current_time))
                | Q(end_time__isnull=True)
            )
        ),
        status="approved",
    ).order_by("start_date", "start_time")
    # Process events to add status flags
    events_list = []
    for event in upcoming_events:
        event.is_happening_now = is_happening_now(event)
        event.is_today = is_today(event)
        events_list.append(event)

    # Sort events with featured ones distributed throughout
    # Every third event should be featured if available
    featured_events = [e for e in events_list if e.featured]
    non_featured_events = [e for e in events_list if not e.featured]

    sorted_events = []
    featured_idx = 0
    non_featured_idx = 0

    while featured_idx < len(featured_events) or non_featured_idx < len(non_featured_events):
        # Add two non-featured events
        for _ in range(2):
            if non_featured_idx < len(non_featured_events):
                sorted_events.append(non_featured_events[non_featured_idx])
                non_featured_idx += 1
        # Add one featured event
        if featured_idx < len(featured_events):
            sorted_events.append(featured_events[featured_idx])
            featured_idx += 1
    return sorted_events
