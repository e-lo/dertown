# Der Town

A modern, community-driven events site built with Django and Wagtail. Der Town features a beautiful calendar, custom CSS/JS, a strong design system, and a modular component-based architecture for maintainability and scalability.

## Features

- Community event calendar with category filtering
- Modular, reusable UI components (django-components)
- Custom BEM-based CSS, Bootstrap layout
- Wagtail CMS for content management
- Google Calendar integration
- Recaptcha and spam protection
- Automated linting, formatting, and pre-commit hooks

## Tech Stack

- Python 3.12+
- Django 5.x
- Wagtail 6.x
- django-components
- Bootstrap 5
- Pre-commit, Ruff, Stylelint, ESLint
- Dependency management via `pyproject.toml` and [`uv`](https://github.com/astral-sh/uv)

---

## Local Development

1. **Clone the repo:**

   ```sh
   git clone https://github.com/yourusername/dertown.git
   cd dertown
   ```

2. **Create and activate a virtual environment:**

   ```sh
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies:**

   ```sh
   uv pip install -e .
   ```

4. **Set up your `.env` file:**
   - Copy `.env.example` to `.env` and fill in secrets (or set environment variables directly).

5. **Apply migrations and create a superuser:**

   ```sh
   python manage.py migrate
   python manage.py createsuperuser
   ```

6. **Run the development server:**

   ```sh
   python manage.py runserver
   ```

7. **Run linting and formatting checks:**

   ```sh
   pre-commit run --all-files
   ```

---

## Deployment on Render

1. **Connect your GitHub repo to Render.**
2. **Set environment variables** in the Render dashboard (these override `.env`).
   - `DJANGO_SETTINGS_MODULE=dertown.settings.production`
   - `SECRET_KEY`, `DATABASE_URL`, etc.
   - `DEBUG=False`
3. **Set Render build and start commands:**
   - **Build Command:**

     ```sh
     uv pip install -e . && python manage.py collectstatic --noinput
     ```

   - **Start Command:**

     ```sh
     gunicorn dertown.wsgi
     ```

   - **Migrate Command (optional, or add as a shell command):**

     ```sh
     python manage.py migrate
     ```

4. **ALLOWED_HOSTS** in your production settings should include your Render domain (e.g., `your-app.onrender.com`).
5. **Push to your main branch** to trigger a deploy.
6. **(Optional) Set up a static site on Render** to serve `/static` via their CDN for best performance.

---

## Maintenance & Best Practices

- Use pre-commit hooks to enforce code quality.
- Keep dependencies up to date in `pyproject.toml`.
- Use `python manage.py check --deploy` to verify production security settings.
- Review logs and test all integrations after each deploy.

---

## License

MIT (or your chosen license)
