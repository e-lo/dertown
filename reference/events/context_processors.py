from .models import Tag


def event_tags(request):
    return {
        "event_tags": Tag.objects.exclude(calendar_id__isnull=True).exclude(calendar_id__exact="")
    }
