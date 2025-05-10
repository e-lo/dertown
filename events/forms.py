from django import forms
from django_recaptcha.fields import ReCaptchaField
from django_recaptcha.widgets import ReCaptchaV2Checkbox

from .models import Event


class PublicEventSubmissionForm(forms.ModelForm):
    captcha = ReCaptchaField(widget=ReCaptchaV2Checkbox)
    new_location = forms.CharField(
        required=False,
        label="New Location",
        help_text="If your location isn't listed above, enter it here.",
    )
    new_organization = forms.CharField(
        required=False,
        label="New Organization",
        help_text="If your organization isn't listed above, enter it here.",
    )

    class Meta:
        model = Event
        fields = [
            "title",
            "description",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "location",
            "organization",
            "new_location",
            "new_organization",
            "email",
            "website",
            "registration_link",
            "primary_tag",
            "secondary_tag",
            "image",
            "external_image_url",
        ]
        widgets = {
            "description": forms.Textarea(attrs={"rows": 4}),
            "start_date": forms.DateInput(attrs={"type": "date"}),
            "end_date": forms.DateInput(attrs={"type": "date"}),
            "start_time": forms.TimeInput(attrs={"type": "time"}),
            "end_time": forms.TimeInput(attrs={"type": "time"}),
            "image": forms.FileInput(attrs={"accept": "image/*"}),
            "external_image_url": forms.URLInput(
                attrs={
                    "placeholder": "https://example.com/image.jpg",
                    "pattern": r".*\.(jpg|jpeg|png|gif|webp)$",
                    "title": "URL must end with an image extension like .jpg, .png, .gif or .webp",
                }
            ),
        }
        help_texts = {
            "email": "Contact email",
            "website": "(Optional) Event website or more information URL",
            "registration_link": "(Optional) Link to event registration page (if any)",
            "start_time": "(Optional) Time the event starts",
            "end_time": "(Optional) Time the event ends",
            "end_date": "(Optional) Last day of the event (for multi-day events)",
            "image": "(Optional) Upload an image for the event (recommended size: 800x600px \
                landscape)",
            "external_image_url": "(Optional) Enter an external image URL for the event \
                (recommended size: 800x600px landscape)",
            "location": "Select a location, or enter a new one below if not listed.",
            "organization": "Select an organization, or enter a new one below if not listed.",
        }

    def clean(self):
        cleaned_data = super().clean()
        image = cleaned_data.get("image")
        external_image_url = cleaned_data.get("external_image_url")
        if not image and not external_image_url:
            raise forms.ValidationError(
                "You must provide either an image file or an external image URL."
            )
        if image and external_image_url:
            raise forms.ValidationError(
                "Please provide only one: either upload an image file or enter an external \
                    image URL, not both."
            )

        # Handle new location
        new_location = cleaned_data.get("new_location")
        if new_location:
            from .models import Location

            location_obj, _ = Location.objects.get_or_create(name=new_location.strip())
            cleaned_data["location"] = location_obj

        # Handle new organization
        new_organization = cleaned_data.get("new_organization")
        if new_organization:
            from .models import Organization

            org_obj, _ = Organization.objects.get_or_create(name=new_organization.strip())
            cleaned_data["organization"] = org_obj

        return cleaned_data

    def clean_image(self):
        image = self.cleaned_data.get("image")
        if image:
            if image.size > 2 * 1024 * 1024:
                raise forms.ValidationError("Image file too large (max 2MB).")
            valid_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
            if hasattr(image, "content_type") and image.content_type not in valid_types:
                raise forms.ValidationError(
                    "Unsupported image type. Please upload a JPG, PNG, GIF, or WEBP image."
                )
        return image
