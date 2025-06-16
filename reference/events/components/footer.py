from django_components import component


@component.register("footer")
class Footer(component.Component):
    template_name = "components/footer.html"

    def get_context_data(self):
        return {}
