import os

from django.contrib import messages
from django.shortcuts import redirect, render
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.translation import gettext_lazy as _
from django.views.generic import View
from wagtail import hooks
from wagtail.admin.menu import MenuItem
from wagtail.snippets.models import register_snippet
from wagtail.snippets.views.snippets import SnippetViewSet

from .models import CommunityAnnouncement, Event, Location, Organization, Tag


class EventViewSet(SnippetViewSet):
    model = Event
    icon = "date"
    list_display = ["title", "status", "start_date", "organization", "location"]
    list_filter = ["start_date", "organization", "location", "primary_tag", "secondary_tag"]
    ordering = ["-status", "start_date", "start_time"]
    search_fields = ["title", "description"]
    add_to_admin_menu = True
    menu_order = 200

    def get_admin_urls_for_registration(self):
        urls = super().get_admin_urls_for_registration()
        urls += (path("import-ics/", self.import_ics_view, name="import_ics"),)
        return urls

    def get_listing_buttons(self):
        buttons = super().get_listing_buttons()
        buttons.append(
            {
                "label": _("Import ICS"),
                "url": reverse(
                    f"wagtailsnippets_{self.model._meta.app_label}_{self.model._meta.model_name}:import_ics"
                ),
                "classname": "button button-secondary",
                "icon_name": "upload",
            }
        )
        return buttons

    def import_ics_view(self, request):
        # Import here to avoid circular/app registry issues
        from .management.commands.import_ics_events import Command as ImportICSCommand

        if request.method == "POST":
            try:
                ics_file = request.FILES.get("ics_file")
                if not ics_file:
                    messages.error(request, _("No file was uploaded."))
                    return redirect(
                        "wagtailsnippets:list",
                        self.model._meta.app_label,
                        self.model._meta.model_name,
                    )
                temp_dir = "temp_ics"
                if not os.path.exists(temp_dir):
                    os.makedirs(temp_dir)
                temp_path = os.path.join(temp_dir, ics_file.name)
                with open(temp_path, "wb+") as destination:
                    for chunk in ics_file.chunks():
                        destination.write(chunk)
                try:
                    command = ImportICSCommand()
                    command.handle(
                        ics_file=temp_path,
                        organization=request.POST.get("organization", ""),
                        location=request.POST.get("location", ""),
                        default_tags=request.POST.get("default_tags", ""),
                    )
                    messages.success(request, "ICS file imported successfully!")
                    return redirect("wagtailsnippets_events_event:list")
                except Exception as e:
                    messages.error(request, _("Error importing events: %s") % str(e))
                    return redirect(
                        "wagtailsnippets:list",
                        self.model._meta.app_label,
                        self.model._meta.model_name,
                    )
                finally:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                    try:
                        os.rmdir(temp_dir)
                    except Exception:
                        pass
            except Exception as e:
                messages.error(request, _("Error processing file: %s") % str(e))
                return redirect(
                    "wagtailsnippets:list", self.model._meta.app_label, self.model._meta.model_name
                )
        return TemplateResponse(
            request,
            "events/import_ics.html",
            {
                "view": self,
            },
        )


class TagViewSet(SnippetViewSet):
    model = Tag
    icon = "tag"
    list_display = ["name"]
    search_fields = ["name", "description"]


class OrganizationViewSet(SnippetViewSet):
    model = Organization
    icon = "group"
    list_display = ["name", "website", "email"]
    search_fields = ["name", "website"]


class LocationViewSet(SnippetViewSet):
    model = Location
    icon = "site"
    list_display = ["name", "address"]
    search_fields = ["name", "address", "description"]


class CommunityAnnouncementViewSet(SnippetViewSet):
    model = CommunityAnnouncement
    list_display = ["title", "active", "organization", "author", "created_at", "expires_at"]
    search_fields = ["title", "message", "author"]
    list_filter = ["active", "organization"]


register_snippet(Event, viewset=EventViewSet)
register_snippet(Tag, viewset=TagViewSet)
register_snippet(Organization, viewset=OrganizationViewSet)
register_snippet(Location, viewset=LocationViewSet)
register_snippet(CommunityAnnouncement, viewset=CommunityAnnouncementViewSet)


class ImportICSView(View):
    template_name = "events/import_ics.html"

    def get(self, request):
        return render(request, self.template_name)

    def post(self, request):
        # Import here to avoid circular/app registry issues
        from .management.commands.import_ics_events import Command as ImportICSCommand

        try:
            ics_file = request.FILES.get("ics_file")
            if not ics_file:
                messages.error(request, _("No file was uploaded."))
                return redirect("admin_import_ics")

            # Create a temporary file with the uploaded content
            temp_dir = "temp_ics"
            if not os.path.exists(temp_dir):
                os.makedirs(temp_dir)

            temp_path = os.path.join(temp_dir, ics_file.name)
            with open(temp_path, "wb+") as destination:
                for chunk in ics_file.chunks():
                    destination.write(chunk)

            try:
                # Create command instance and run import
                command = ImportICSCommand()
                command.handle(
                    ics_file=temp_path,
                    organization=request.POST.get("organization", ""),
                    location=request.POST.get("location", ""),
                    default_tags=request.POST.get("default_tags", ""),
                )

                messages.success(request, "ICS file imported successfully!")
                return redirect("wagtailsnippets_events_event:list")
            except Exception as e:
                messages.error(request, _("Error importing events: %s") % str(e))
                return redirect("admin_import_ics")
            finally:
                # Clean up the temporary file
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                try:
                    os.rmdir(temp_dir)
                except Exception:
                    pass

        except Exception as e:
            messages.error(request, _("Error processing file: %s") % str(e))
            return redirect("admin_import_ics")


@hooks.register("register_admin_urls")
def register_admin_urls():
    return [
        path("import-ics/", ImportICSView.as_view(), name="admin_import_ics"),
    ]


@hooks.register("register_admin_menu_item")
def register_import_menu_item():
    return MenuItem(_("Import ICS"), reverse("admin_import_ics"), icon_name="upload", order=10000)
