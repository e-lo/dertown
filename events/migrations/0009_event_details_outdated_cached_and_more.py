# Generated by Django 5.2.1 on 2025-05-20 00:22

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0008_location_status_organization_status_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='details_outdated_cached',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='event',
            name='details_outdated_checked_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='event',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]
