import os

from django.contrib import admin, messages
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.shortcuts import redirect, render
from django.urls import path

from .management.commands.import_ics_events import Command as ImportICSCommand
from .models import CommunityAnnouncement, Event, Location, Organization, Tag


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["title", "status", "start_date", "location", "organization"]
    list_filter = [
        "status",
        "start_date",
        "location",
        "organization",
        "primary_tag",
        "secondary_tag",
    ]
    search_fields = ["title", "description"]
    autocomplete_fields = ["location", "organization"]
    date_hierarchy = "start_date"
    ordering = ["status", "start_date", "start_time"]

    fieldsets = (
        (
            "Event Details",
            {
                "fields": (
                    "title",
                    "description",
                    "organization",
                    "featured",
                    "primary_tag",
                    "secondary_tag",
                )
            },
        ),
        (
            "Event Image",
            {
                "fields": (
                    "image",
                    "external_image_url",
                ),
                "description": "Upload an image or provide an external image URL. \
                    If both are provided, the uploaded image will be used.",
            },
        ),
        (
            "Date and Time",
            {
                "fields": (
                    "start_date",
                    "end_date",
                    "start_time",
                    "end_time",
                )
            },
        ),
        (
            "Location and Links",
            {
                "fields": (
                    "location",
                    "website",
                    "registration_link",
                    "email",
                )
            },
        ),
    )

    # Add raw ID fields for the image to use Wagtail's image chooser
    raw_id_fields = ("image",)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path("import-ics/", self.import_ics_view, name="import-ics"),
        ]
        return custom_urls + urls

    def import_ics_view(self, request):
        if request.method == "POST":
            ics_file = request.FILES.get("ics_file")
            organization = request.POST.get("organization", "Imported Event")
            location = request.POST.get("location", "TBD")
            default_tags = request.POST.get("default_tags", "")

            if not ics_file:
                messages.error(request, "Please select an ICS file to import.")
                return redirect("admin:import-ics")

            # Save the uploaded file temporarily
            path = default_storage.save(f"temp/{ics_file.name}", ContentFile(ics_file.read()))
            full_path = default_storage.path(path)

            try:
                # Create command instance and run import
                command = ImportICSCommand()
                command.handle(
                    ics_file=full_path,
                    organization=organization,
                    location=location,
                    default_tags=default_tags,
                )
                messages.success(request, "Events imported successfully!")
            except Exception as e:
                messages.error(request, f"Error importing events: {str(e)}")
            finally:
                # Clean up temporary file
                if os.path.exists(full_path):
                    os.remove(full_path)

            return redirect("admin:events_event_changelist")

        return render(
            request,
            "admin/import_ics.html",
            {
                "title": "Import Events from ICS",
                "opts": self.model._meta,
            },
        )


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name"]
    search_fields = ["name"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "parent_organization"]
    search_fields = ["name", "description"]


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ["name", "address", "parent_location"]
    search_fields = ["name", "address", "parent_location"]


@admin.register(CommunityAnnouncement)
class CommunityAnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "active", "created_at", "expires_at")
    list_filter = ("active",)
    search_fields = ("title", "message")
