from django.db import models

from events.models import Organization, Tag
from ingest.html_utils import EXTRACTION_FUNCTIONS

# Create your models here.

EXTRACTION_FUNCTION_CHOICES = [
    (key, key.replace("_", " ").title()) for key in EXTRACTION_FUNCTIONS.keys()
]


class SourceSite(models.Model):
    name = models.CharField(max_length=255, unique=True)
    url = models.URLField()
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Organization that owns this source site",
    )
    event_tag = models.ForeignKey(
        Tag,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Tag/category to assign to events from this source",
    )
    last_scraped = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(
        max_length=50, blank=True, help_text="Status of last scrape (success, error, etc.)"
    )
    last_error = models.TextField(blank=True, help_text="Error message from last scrape, if any")
    IMPORT_FREQUENCY_CHOICES = [
        ("hourly", "Hourly"),
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("manual", "Manual Only"),
    ]
    import_frequency = models.CharField(
        max_length=20,
        choices=IMPORT_FREQUENCY_CHOICES,
        default="daily",
        help_text="How often to automatically import events from this source.",
    )
    extraction_function = models.CharField(
        max_length=50,
        choices=EXTRACTION_FUNCTION_CHOICES,
        default="llm",
        help_text="Extraction function to use for this source",
    )

    def __str__(self):
        return self.name


class ScrapeLog(models.Model):
    source = models.ForeignKey(SourceSite, on_delete=models.CASCADE, related_name="scrape_logs")
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=50)
    error_message = models.TextField(blank=True)

    def __str__(self):
        return f"{self.source.name} @ {self.timestamp} ({self.status})"
