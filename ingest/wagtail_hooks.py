import io
from contextlib import redirect_stderr, redirect_stdout

from django import forms
from django.contrib import messages
from django.core.management import call_command
from django.shortcuts import redirect, render
from django.urls import path, reverse
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


@hooks.register("register_admin_urls")
def register_manual_import_url():
    return [
        path("manual-import/", manual_import_view, name="manual_import"),
    ]


@hooks.register("register_admin_menu_item")
def register_manual_import_menu_item():
    return MenuItem("Manual Import", reverse("manual_import"), icon_name="download", order=10001)
