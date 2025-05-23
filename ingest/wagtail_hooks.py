import io
import os
from contextlib import redirect_stderr, redirect_stdout

from django import forms
from django.contrib import messages
from django.core.management import call_command
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils.translation import gettext_lazy as _
from django.views import View
from wagtail import hooks
from wagtail.admin.menu import MenuItem
from wagtail.admin.panels import FieldPanel
from wagtail.snippets.models import register_snippet
from wagtail.snippets.views.snippets import SnippetViewSet

from .models import SourceSite


class SourceSiteViewSet(SnippetViewSet):
    model = SourceSite
    icon = "site"
    list_display = ["name", "url", "import_frequency", "last_scraped", "last_status"]
    add_to_admin_menu = True
    menu_order = 300
    panels = [
        FieldPanel("name"),
        FieldPanel("url"),
        FieldPanel("organization"),
        FieldPanel("event_tag"),
        FieldPanel("import_frequency"),
        FieldPanel("extraction_function"),
        FieldPanel("last_scraped", read_only=True),
        FieldPanel("last_status", read_only=True),
        FieldPanel("last_error", read_only=True),
    ]


register_snippet(SourceSite, viewset=SourceSiteViewSet)


# --- Manual Import Admin View ---
class ManualImportForm(forms.Form):
    source = forms.ModelChoiceField(queryset=SourceSite.objects.all(), label="Source Site")


def manual_import_view(request):
    if request.method == "POST":
        form = ManualImportForm(request.POST)
        if form.is_valid():
            source = form.cleaned_data["source"]
            out = io.StringIO()
            err = io.StringIO()
            import logging

            log_handler = logging.StreamHandler(err)
            log_handler.setLevel(logging.INFO)
            logging.getLogger().addHandler(log_handler)
            try:
                with redirect_stdout(out), redirect_stderr(err):
                    call_command("import_events_from_web", f"--source-id={source.id}")
                output = out.getvalue()
                error_output = err.getvalue()
                # Show error messages
                if error_output:
                    for line in error_output.splitlines():
                        if "error" in line.lower():
                            messages.error(request, line)
                        elif "warning" in line.lower():
                            messages.warning(request, line)
                        else:
                            messages.info(request, line)
                # Show info/warning messages from stdout
                if output:
                    for line in output.splitlines():
                        if "error" in line.lower():
                            messages.error(request, line)
                        elif "warning" in line.lower():
                            messages.warning(request, line)
                        else:
                            messages.info(request, line)
                # Always show a completion message
                messages.success(request, f"Import completed for {source.name}.")
            except Exception as e:
                messages.error(request, f"Error triggering import: {e}")
            finally:
                logging.getLogger().removeHandler(log_handler)
            return redirect(request.path)
    else:
        form = ManualImportForm()
    return render(request, "ingest/manual_import.html", {"form": form})


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


@hooks.register("register_admin_urls")
def register_manual_import_url():
    return [
        path("manual-import/", manual_import_view, name="manual_import"),
    ]


@hooks.register("register_admin_menu_item")
def register_import_menu_item():
    return MenuItem(_("Import ICS"), reverse("admin_import_ics"), icon_name="upload", order=10000)


@hooks.register("register_admin_menu_item")
def register_manual_import_menu_item():
    return MenuItem("Manual Import", reverse("manual_import"), icon_name="upload", order=10001)
