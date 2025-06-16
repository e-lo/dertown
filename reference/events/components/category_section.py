from django_components import component


@component.register("category_section")
class CategorySection(component.Component):
    template_name = "components/category_section.html"

    def get_context_data(self, tag, events, **kwargs):
        return {
            "tag": tag,
            "events": events,
        }
