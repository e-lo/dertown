import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .google_calendar import add_or_update_event
from .models import Event

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Event)
def sync_event_to_google_calendar(sender, instance, **kwargs):
    if instance.exclude_from_calendar:
        return
    try:
        event_id = add_or_update_event(instance, instance.google_calendar_event_id)
        if event_id and event_id != instance.google_calendar_event_id:
            # Avoid recursion by updating only if changed
            Event.objects.filter(pk=instance.pk).update(google_calendar_event_id=event_id)
    except Exception as e:
        logger.error(f"Failed to sync event '{instance}': {e}")
