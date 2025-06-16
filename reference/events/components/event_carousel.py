from django_components import component


@component.register("event_carousel")
class EventCarousel(component.Component):
    template_name = "components/event_carousel.html"

    def get_context_data(self, events, title=None, carousel_id=None):
        return {
            "events": events,
            "title": title,
            "carousel_id": carousel_id,
        }
