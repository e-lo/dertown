from django_components import component


@component.register("navbar")
class Navbar(component.Component):
    template_name = "components/navbar.html"

    def get_context_data(self, request=None):
        return {
            "request": request,
        }
