from django.conf import settings


def google_calendar_ids(request):
    return {"GOOGLE_CALENDAR_IDS": getattr(settings, "GOOGLE_CALENDAR_IDS", {})}
