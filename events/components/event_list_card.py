from django_components import component


@component.register("event_list_card")
class EventListCard(component.Component):
    template_name = "components/event_list_card.html"

    def get_context_data(self, event, request=None):
        return {
            "event": event,
            "request": request,
        }
