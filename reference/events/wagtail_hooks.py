from wagtail import hooks
from wagtail.admin.menu import Menu, MenuItem, SubmenuMenuItem
from wagtail.snippets.models import register_snippet

from .views import EventSnippetViewSet, SnippetAdminViewSetGroup

register_snippet(EventSnippetViewSet, EventSnippetViewSet)


@hooks.register("register_admin_viewset")
def register_snippet_viewset():
    return SnippetAdminViewSetGroup()


@hooks.register("register_admin_menu_item")
def register_events_menu():
    events_menu = Menu(
        items=[
            MenuItem("All Events", "/admin/snippets/events/event/", icon_name="list-ul"),
            MenuItem(
                "Needs Review",
                "/admin/snippets/events/event/?needs_review=true",
                icon_name="warning",
            ),
            MenuItem(
                "Upcoming", "/admin/snippets/events/event/?is_upcoming=true", icon_name="calendar"
            ),
        ]
    )
    return SubmenuMenuItem("Events", events_menu, icon_name="calendar", order=110)


@hooks.register("register_admin_menu_item")
def register_review_menu():
    review_menu = Menu(
        items=[
            MenuItem(
                "Events", "/admin/snippets/events/event/?needs_review=true", icon_name="calendar"
            ),
            MenuItem(
                "Organizations",
                "/admin/snippets/events/organization/?status=pending",
                icon_name="group",
            ),
            MenuItem(
                "Locations", "/admin/snippets/events/location/?status=pending", icon_name="site"
            ),
        ]
    )
    return SubmenuMenuItem("Review", review_menu, icon_name="warning", order=100)
