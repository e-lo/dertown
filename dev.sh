#!/bin/bash

# Activate virtual environment if not already activated
if [[ "$VIRTUAL_ENV" == "" ]]; then
    source .venv/bin/activate
fi

# Install requirements
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create a superuser if it doesn't exist
python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('admin', 'admin@example.com', 'admin') if not User.objects.filter(username='admin').exists() else None"

# Run the development server
python manage.py runserver 