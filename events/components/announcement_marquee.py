from django_components import component


@component.register("announcement_marquee")
class AnnouncementMarquee(component.Component):
    template_name = "components/announcement_marquee.html"

    def get_context_data(self, announcements):
        return {
            "announcements": announcements,
        }
