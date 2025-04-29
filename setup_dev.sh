#!/bin/bash

# Exit on error
set -e

# Activate virtual environment if not already activated
if [[ "$VIRTUAL_ENV" == "" ]]; then
    source .venv/bin/activate
fi

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

# Run migrations
echo "Running migrations..."
python manage.py migrate

# Create a superuser if it doesn't exist
echo "Creating superuser if needed..."
python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('admin', 'admin@example.com', 'admin') if not User.objects.filter(username='admin').exists() else None"

# Create initial Wagtail site if it doesn't exist
echo "Setting up Wagtail site..."
python manage.py shell -c "from wagtail.models import Site, Page; Site.objects.get_or_create(hostname='localhost', port=8000, root_page=Page.objects.first(), is_default_site=True) if Page.objects.exists() else None"

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Development environment setup complete!"
echo "Run 'python manage.py runserver' to start the development server" 