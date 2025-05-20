"""Import events from ICS files.

Usage:
python manage.py import_ics_events <ics_file>
"""

import logging
import os
import re
from datetime import datetime

from django.core.management.base import BaseCommand
from icalendar import Calendar

from events.models import Event, Location, Organization, Tag

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Import events from ICS files"

    def add_arguments(self, parser):
        parser.add_argument("ics_file", type=str, help="Path to the ICS file")
        parser.add_argument(
            "--organization", type=str, help="Default organization name for imported events"
        )
        parser.add_argument("--location", type=str, help="Default location for imported events")
        parser.add_argument(
            "--default-tags",
            type=str,
            help="Comma-separated list of default tags to apply to all events",
        )

    def extract_urls_from_description(self, description, ics_website=None):
        """Extract website and registration URLs from description text."""
        website = ics_website.strip() if ics_website else None
        registration = None

        # Common patterns for website URLs
        website_patterns = [
            r"(?i)more info:\s*(https?://\S+)",
            r"(?i)website:\s*(https?://\S+)",
            r"(?i)info:\s*(https?://\S+)",
            r"(?i)details:\s*(https?://\S+)",
            r"(?i)learn more:\s*(https?://\S+)",
        ]

        # Common patterns for registration URLs
        registration_patterns = [
            r"(?i)register(?:ation)?:\s*(https?://\S+)",
            r"(?i)sign[- ]?up:\s*(https?://\S+)",
            r"(?i)tickets:\s*(https?://\S+)",
            r"(?i)rsvp:\s*(https?://\S+)",
        ]

        # Try to find website URL by pattern if not already set
        if not website:
            for pattern in website_patterns:
                match = re.search(pattern, description)
                if match:
                    website = match.group(1).strip()
                    break

        # Try to find registration URL
        for pattern in registration_patterns:
            match = re.search(pattern, description)
            if match:
                registration = match.group(1).strip()
                break

        # If no website found, look for any URL
        if not website:
            urls = re.findall(r"https?://\S+", description)
            if urls:
                website = urls[0].strip()

        return website, registration

    def extract_tags_from_text(self, text):
        """Extract potential tags from text using common patterns."""
        # Look for hashtags
        hashtags = re.findall(r"#(\w+)", text)
        # Look for keywords in brackets
        bracketed = re.findall(r"\[(\w+)\]", text)
        # Look for keywords in parentheses
        parenthetical = re.findall(r"\((\w+)\)", text)

        # Combine all found tags and make them unique
        all_tags = set(hashtags + bracketed + parenthetical)
        return list(all_tags)

    def get_or_create_tag(self, tag_name):
        """Get or create a tag with the given name."""
        tag_name = tag_name.strip().lower()
        tag, created = Tag.objects.get_or_create(
            name=tag_name, defaults={"slug": tag_name.replace(" ", "-")}
        )
        return tag

    def get_or_create_organization(self, org_name, website=None):
        """Get or create an organization with the given name and website."""
        if not org_name:
            return None

        # First try to find by exact name
        try:
            return Organization.objects.get(name=org_name)
        except Organization.DoesNotExist:
            pass

        # Then try to find by website if provided
        if website:
            try:
                return Organization.objects.get(website=website)
            except Organization.DoesNotExist:
                pass

        # Create new organization if not found
        return Organization.objects.create(name=org_name, website=website or "")

    def parse_location_hierarchy(self, location_string):
        """Parse a location string to extract potential parent/child relationships."""
        # Common separators that might indicate hierarchy
        separators = [" > ", " - ", " / ", ","]

        for separator in separators:
            if separator in location_string:
                parts = [p.strip() for p in location_string.split(separator)]
                # Return the most specific (child) location name and its parent
                return parts[-1], parts[-2] if len(parts) > 1 else None

        return location_string, None

    def get_or_create_location(self, location_name, organization=None):
        """Get or create a location with the given name and optionally associate with an \
            organization."""
        if not location_name or location_name.lower() in ["tbd", "unknown", ""]:
            return None

        # Parse location hierarchy
        child_name, parent_name = self.parse_location_hierarchy(location_name)

        # If we have a parent name, get or create the parent location first
        parent_location = None
        if parent_name:
            parent_location = self.get_or_create_location(parent_name, organization)

        # Try to find existing location by name
        try:
            location = Location.objects.get(name=child_name)
            # Update parent if needed
            if parent_location and location.parent != parent_location:
                location.parent = parent_location
                location.save()
            # Update organization if needed
            if organization and organization not in location.organizations.all():
                location.organizations.add(organization)
            return location
        except Location.DoesNotExist:
            pass

        # Create new location
        location = Location.objects.create(name=child_name, parent=parent_location)
        # Associate with organization if provided
        if organization:
            location.organizations.add(organization)

        return location

    def handle(self, *args, **options):
        ics_file = options["ics_file"]
        default_org_name = options.get("organization", "Imported Event")
        default_location = options.get("location", "TBD")
        default_tags = (
            options.get("default_tags", "").split(",") if options.get("default_tags") else []
        )

        if not os.path.exists(ics_file):
            logger.error(f"ICS file not found: {ics_file}")
            return

        try:
            with open(ics_file, "rb") as f:
                cal = Calendar.from_ical(f.read())
        except Exception as e:
            logger.error(f"Error reading ICS file: {str(e)}")
            return

        events_created = 0
        events_updated = 0

        for component in cal.walk():
            if component.name != "VEVENT":
                continue

            website_url = None
            # Extract event details
            title = str(component.get("summary", "Untitled Event"))
            description = str(component.get("description", ""))
            start = component.get("dtstart").dt
            end = component.get("dtend").dt if component.get("dtend") else None

            # Convert to datetime if it's a date
            if isinstance(start, datetime):
                start_date = start.date()
                start_time = start.time()
            else:
                start_date = start
                start_time = None

            if end and isinstance(end, datetime):
                end_time = end.time()
            else:
                end_time = None

            # Get or create organization first (since we need it for location)
            org_name = (
                str(component.get("organizer", default_org_name))
                if component.get("organizer")
                else default_org_name
            )
            organization = self.get_or_create_organization(org_name, website_url)

            # Get location and associate with organization
            location_name = str(component.get("location", default_location))
            location = self.get_or_create_location(location_name, organization)

            # Extract website and registration URLs from description
            ics_website = str(component.get("website", "")) if component.get("website") else None
            website_url, registration_url = self.extract_urls_from_description(
                description, ics_website
            )

            # Extract tags from various sources
            tags = set()

            # Add default tags
            for tag_name in default_tags:
                if tag_name.strip():
                    tags.add(self.get_or_create_tag(tag_name))

            # Extract tags from description
            description_tags = self.extract_tags_from_text(description)
            for tag_name in description_tags:
                tags.add(self.get_or_create_tag(tag_name))

            # Extract tags from categories if present
            categories = component.get("categories", [])
            if categories:
                for category in categories:
                    tags.add(self.get_or_create_tag(str(category)))

            # Create or update event
            event, created = Event.objects.update_or_create(
                title=title,
                start_date=start_date,
                defaults={
                    "description": description,
                    "organization": organization,
                    "start_time": start_time,
                    "end_time": end_time,
                    "location": location,
                    "website": website_url,
                    "registration_link": registration_url,
                },
            )

            # Add tags to the event
            event.tags.add(*tags)

            if created:
                events_created += 1
                logger.info(f"Created event: {title}")
            else:
                events_updated += 1
                logger.info(f"Updated event: {title}")

        logger.info(f"Import complete. Created {events_created} events, updated {events_updated} \
                    events.")
