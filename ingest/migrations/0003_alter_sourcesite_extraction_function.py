# Generated by Django 5.2.1 on 2025-05-20 00:22

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("ingest", "0002_sourcesite_extraction_function"),
    ]

    operations = [
        migrations.AlterField(
            model_name="sourcesite",
            name="extraction_function",
            field=models.CharField(
                choices=[
                    ("skileavenworth", "Skileavenworth"),
                    ("llm", "Llm"),
                    ("default", "Default"),
                    ("Firespring Events", "Firespring Events"),
                    ("cascadekodiakathletics", "Cascadekodiakathletics"),
                    ("Salesforce Tickets", "Salesforce Tickets"),
                    ("Wordpress: TheEventsCalendar", "Wordpress: Theeventscalendar"),
                    ("Joomla: dpCalendar", "Joomla: Dpcalendar"),
                ],
                default="llm",
                help_text="Extraction function to use for this source",
                max_length=50,
            ),
        ),
    ]
