from django.db import models
from wagtail.models import Page
from wagtail.fields import RichTextField
from wagtail.admin.panels import FieldPanel, MultiFieldPanel
from wagtail.snippets.models import register_snippet
from django.utils import timezone


class HomePage(Page):
    body = RichTextField(blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('body'),
    ]

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        context['events'] = Event.objects.filter(
            start_date__gte=timezone.now()
        ).order_by('start_date')[:5]
        return context

    class Meta:
        verbose_name = "Home Page"


@register_snippet
class Event(models.Model):
    title = models.CharField(max_length=255)
    description = RichTextField(blank=True)
    hosting_organization = models.CharField(max_length=255, blank=True)
    
    # Date and Time
    start_date = models.DateField(default=timezone.now)
    start_time = models.TimeField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    
    # Registration
    registration_opens_at = models.DateTimeField(null=True, blank=True)
    registration_closes_at = models.DateTimeField(null=True, blank=True)
    registration_link = models.URLField(blank=True)
    
    # Additional Information
    website = models.URLField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    
    # Recurring Event Settings
    is_recurring = models.BooleanField(default=False)
    recurrence_pattern = models.CharField(
        max_length=50,
        blank=True,
        choices=[
            ('daily', 'Daily'),
            ('weekly', 'Weekly'),
            ('monthly', 'Monthly'),
            ('yearly', 'Yearly'),
        ]
    )
    recurrence_end_date = models.DateField(null=True, blank=True)
    
    # Integration Status
    instagram_posted = models.BooleanField(default=False)
    email_sent = models.BooleanField(default=False)
    google_calendar_synced = models.BooleanField(default=False)

    # Parent-Child Relationship
    parent_event = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='child_events'
    )

    panels = [
        MultiFieldPanel([
            FieldPanel('title'),
            FieldPanel('description'),
            FieldPanel('hosting_organization'),
        ], heading="Basic Information"),
        
        MultiFieldPanel([
            FieldPanel('start_date'),
            FieldPanel('start_time'),
            FieldPanel('end_date'),
            FieldPanel('end_time'),
        ], heading="Date and Time"),
        
        MultiFieldPanel([
            FieldPanel('registration_opens_at'),
            FieldPanel('registration_closes_at'),
            FieldPanel('registration_link'),
        ], heading="Registration"),
        
        MultiFieldPanel([
            FieldPanel('website'),
            FieldPanel('location'),
            FieldPanel('contact_email'),
            FieldPanel('contact_phone'),
        ], heading="Additional Information"),
        
        MultiFieldPanel([
            FieldPanel('is_recurring'),
            FieldPanel('recurrence_pattern'),
            FieldPanel('recurrence_end_date'),
        ], heading="Recurring Event Settings"),
        
        FieldPanel('parent_event'),
    ]

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['start_date', 'start_time']
        verbose_name = "Event"
        verbose_name_plural = "Events"

    def get_child_events(self):
        """Return all child events for this event"""
        return self.child_events.all()

    def is_parent_event(self):
        """Check if this event has child events"""
        return self.child_events.exists()

    def is_child_event(self):
        """Check if this event is a child event"""
        return self.parent_event is not None
