from django_components import component


@component.register("event_tag")
class EventTag(component.Component):
    template_name = "components/event_tag.html"

    def get_context_data(self, tag, primary=False):
        return {
            "tag": tag,
            "primary": primary,
        }
