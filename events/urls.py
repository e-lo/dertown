from django.urls import path

from . import views

app_name = "events"

urlpatterns = [
    path("", views.event_list, name="event_list"),
    path("calendar/", views.calendar_view, name="calendar"),
    path("api/events/", views.events_api, name="events_api"),
    path("rss/", views.events_rss, name="events_rss"),
    path("<int:event_id>/", views.event_detail, name="event_detail"),
    path(
        "<int:event_id>/add-to-calendar/<str:calendar_type>/",
        views.add_to_calendar,
        name="add_to_calendar",
    ),
    path(
        "<int:event_id>/add-all-to-calendar/<str:calendar_type>/",
        views.add_all_to_calendar,
        name="add_all_to_calendar",
    ),
    path("submit/", views.submit_event, name="submit_event"),
    path("submit/thank-you/", views.submit_event_thank_you, name="submit_event_thank_you"),
]
