#!/usr/bin/env bash
# Exit on error
set -o errexit

# Modify this line as needed for your package manager (pip, poetry, etc.)
pip install -r requirements.txt

# Convert static asset files
python manage.py collectstatic --no-input

# Apply any outstanding database migrations
python manage.py migrate

# Create a superuser if it doesn't exist
python manage.py shell -c "from django.contrib.auth import get_user_model; import os; User = get_user_model(); username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin'); email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com'); password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'admin'); User.objects.create_superuser(username, email, password) if not User.objects.filter(username=username).exists() else None"

# Register django-crontab jobs
python manage.py crontab add
