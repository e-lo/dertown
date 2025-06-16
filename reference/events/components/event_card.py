from django_components import component


@component.register("event_card")
class EventCard(component.Component):
    template_name = "components/event_card.html"

    def get_context_data(self, event):
        return {"event": event}
