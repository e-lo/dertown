# 🛠️ Developing Der Town

## 🤖 AI Agent & Single Contributor Workflow

- This project is maintained by a single contributor with AI agent assistance.
- For code review, refactoring, and new features, describe your goal and let the AI agent propose a plan and edits.
- Use the AI to keep code quality, documentation, and tests up to date.
- Document all major changes in commit messages.
- If you step away for a while, review this file and README.md to get back up to speed quickly.

---

## 📁 Project Organization

### Directory Structure

```
dertown/
├── src/
│   ├── components/          # Reusable Astro components
│   │   ├── ui/              # Core UI components (Button, Input, etc.)
│   │   ├── kid-activities/  # Kid activity-specific components
│   │   └── ...              # Other feature components
│   ├── lib/                 # Utility functions and helpers
│   ├── pages/               # Astro pages (routes)
│   │   ├── api/             # API endpoints (serverless functions)
│   │   ├── admin/           # Admin-only pages
│   │   └── families/        # Public-facing pages
│   └── styles/              # Global styles
├── scripts/                 # Python scripts for data management
├── supabase/
│   ├── migrations/          # Database migrations (canonical schema)
│   └── seed.sql            # Seed data
├── public/                 # Static assets
└── docs/                   # Documentation (markdown files)
```

### Key Architectural Patterns

1. **Component System:** Custom Astro components in `src/components/ui/` + Tailwind utilities (no full UI library)
2. **API Routes:** Astro serverless functions in `src/pages/api/` handle backend logic
3. **Database:** Supabase PostgreSQL with migrations in `supabase/migrations/`
4. **Data Management:** Python scripts in `scripts/` for imports, validation, seeding
5. **Security:** RLS policies in Supabase, field-level security via database views

### Main Feature Areas

- **Events & Announcements:** Core calendar functionality, public submissions, admin review
- **Activities:** Kid activities with hierarchical structure, calendar, filtering
- **Admin Panel:** Review/approve submissions, manage content, calendar exceptions
- **Calendar Sync:** iCal feeds for events and activities, calendar downloads

### Code Style & Conventions

- **TypeScript:** Used for type safety in API routes and utilities
- **Astro:** Component-based architecture with server-side rendering
- **Tailwind CSS:** Utility-first styling, custom components for common patterns
- **Python:** Data scripts use Pydantic for validation
- **Linting:** ESLint for JS/TS, Prettier for formatting

---

## 🗂️ Local Development & Environment

### Prerequisites

- Node.js 18+
- Python 3.10+
- Git
- Supabase CLI

### Setup

1. Clone the repo: `git clone ... && cd dertown`
2. Install Node.js deps: `npm install`
3. Install Python deps: `pip install -r requirements.txt`
4. Copy env: `cp .env.example .env` and fill in secrets
5. Start Supabase: `supabase start` (or use hosted project)
6. Reset/seed DB: `make db-reset && make db-seed`
7. Start dev server: `npm run dev`

### Environment Variables

- See `.env.example` for required variables (Supabase, Auth, API keys, etc.)

---

## 🛠️ Makefile & Python Utilities

- `make dev` — Start dev server
- `make lint` — Lint code
- `make format` — Format code
- `make db-reset` — Reset DB
- `make db-seed` — Seed DB
- Python scripts in `scripts/` for DB management, CSV/ICS import, validation

---

## 🎨 Customization & Theme

All customizable settings (colors, fonts, location coordinates, map styles) are centralized in `/src/lib/config.ts`. This makes it easy to adapt the application for different cities or customize the visual theme.

### Quick Customization Guide

See **[CUSTOMIZATION.md](./CUSTOMIZATION.md)** for comprehensive guidance on:
- **Location Settings** – Change default location from Leavenworth to your city
- **Map Styles** – Switch between Mapbox styles or use different map providers
- **Colors** – Customize theme colors, event category colors, and UI elements
- **Typography** – Change font families

### Common Tasks

```typescript
// Change default location from Leavenworth, WA to your city
export const DEFAULT_LOCATION = {
  name: 'Your City',
  coordinates: [47.6062, -122.3321],  // [latitude, longitude]
  defaultZoom: 14,
};

// Switch map style from Outdoors to Light
detail: {
  url: 'mapbox://styles/mapbox/light-v11',  // instead of outdoors-v12
  defaultZoom: 14,
}

// Change primary brand color
theme: {
  primary: '#your-hex-color',
}
```

All changes take effect immediately in development and after rebuild in production.

---

## 🚦 Initial Project Setup & First Deployment

### 1. Supabase Project Setup

- Create a new project at [Supabase](https://app.supabase.com/)
- Go to Project Settings > API and copy your `SUPABASE_URL` and `SUPABASE_KEY`
- In the SQL editor, run all migrations in `supabase/migrations/` (or use `supabase db push` locally)
- (Optional) Seed the database:
  - Use `make db-seed` or run the Python scripts in `scripts/` for test data
- (Optional) Set up storage buckets if needed (see `supabase/config.toml`)

### 2. Netlify Site Setup

- See the [Deployment](#-deployment) section below for detailed setup instructions

### 3. First-Time Setup Tips

- Ensure your `.env` file matches `.env.example` for local dev
- If migrations fail, check DB version compatibility in `supabase/config.toml`
- For troubleshooting, check Netlify deploy logs and Supabase project logs
- After first deploy, test public and admin flows (login, event/announcement submission, admin approval)

---

## 🚀 Deployment

### Netlify Deployment

1. **Create/Connect Site:**
   - Create a new site at [Netlify](https://app.netlify.com/)
   - Connect your GitHub repo (choose the `main` or `dev` branch)

2. **Environment Variables:**
   - Go to Site settings → Environment variables
   - Add the following (from Supabase Dashboard → Project Settings → API):
     - `PUBLIC_SUPABASE_URL` - Your production Supabase project URL
     - `PUBLIC_SUPABASE_KEY` - Your production Supabase anon/public key
     - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)
     - `RESEND_API_KEY` - For email notifications (if using Resend)
     - `RECIPIENT_EMAIL` - Email address for notifications (defaults to `dertown@gmail.com`)
     - `GOOGLE_ANALYTICS_ID` - For analytics (optional)
   - **Important:** Do NOT set `USE_LOCAL_DB` in production (leave unset or set to `false`)

3. **Build Settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`

4. **Supabase Configuration:**
   - In Supabase Dashboard → Authentication → URL Configuration:
     - **Site URL:** Your Netlify domain (e.g., `https://your-site.netlify.app`)
     - **Redirect URLs:** Add:
       - `https://your-site.netlify.app/**`
       - `https://your-site.netlify.app/login`
       - `https://your-site.netlify.app/admin`
       - If using custom domain, add those URLs too

### Authentication & Security

- **Cookie Security:** Automatically configured for production (HTTPS) vs development (HTTP)
  - `secure: true` in production, `secure: false` in development
  - `httpOnly: true` and `sameSite: 'lax'` for security
- **Token Expiration:** Access tokens expire in 1 hour, refresh tokens in 7 days
  - **Note:** Automatic token refresh not yet implemented; users must re-login after 1 hour
- **Session Persistence:** Sessions persist across deployments (cookies are client-side)

### Post-Deployment Verification

1. ✅ Login works on production domain
2. ✅ Cookies are set with `secure: true` (check in browser DevTools)
3. ✅ Session persists across page navigations
4. ✅ Logout clears cookies
5. ✅ Protected routes (admin) require authentication
6. ✅ Redirect after login works correctly
7. ✅ Email notifications work (if configured)

### Troubleshooting Deployment

- **"Missing required environment variables":** Check Netlify environment variables are set correctly
- **"No session cookies found":** Verify cookies are being set (check Network tab → Response Headers)
- **Login works but session doesn't persist:** Check cookie expiration times and flags
- **Redirect URL errors:** Verify Supabase Dashboard → Authentication → Redirect URLs includes your domain

---

## 🗃️ Database Management

- **Migrations:** Add SQL files to `supabase/migrations/` and run `supabase db push`
- **Seeding:** `make db-seed` or use Python scripts
- **Validation:** Use provided scripts to validate/clean data before import
- **Manual Import:** Use `scripts/dev_utils.py` for CSV/ICS import
- **Backup:** Automated weekly backups via GitHub Actions (see [Disaster Recovery](#-disaster-recovery--restoring-from-backup) below). For an immediate on-demand backup run `make db-backup` or trigger the workflow manually in GitHub Actions.

---

## 🆘 Disaster Recovery / Restoring from Backup

Database backups run automatically every Sunday via GitHub Actions (`.github/workflows/db-backup.yml`). Each backup is a compressed, data-only `pg_dump` of the production Supabase database. The schema is already version-controlled in `supabase/migrations/` so it doesn't need to be backed up separately.

Backups are stored as GitHub Actions artifacts with 90-day rolling retention.

### Adding Required GitHub Secrets (one-time setup)

Go to **GitHub repo → Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret Name | Where to find it |
|---|---|
| `SUPABASE_PROJECT_REF` | `hracrmsclsinpgidgjwb` |
| `SUPABASE_DB_PASSWORD` | Supabase dashboard → Settings → Database → Database password |

### Triggering a Manual Backup

Go to **GitHub repo → Actions → Database Backup → Run workflow**.

### Restoring from a Backup

1. Go to **GitHub repo → Actions → Database Backup** and pick a recent successful run
2. Click **Artifacts** and download the `.sql.gz` file
3. Decompress: `gunzip backup_YYYYMMDD.sql.gz`
4. Create a fresh Supabase project (or use the existing one after verifying it's accessible)
5. Apply migrations to restore the schema: `supabase link --project-ref <ref>` then `supabase db push`
6. Restore data:
   ```sh
   psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" \
     -f backup_YYYYMMDD.sql \
     --set ON_ERROR_STOP=off
   ```
7. Verify in Supabase Studio (spot-check event/org/location counts look reasonable)
8. Update Netlify environment variables if the project ref or keys changed

> **Tip:** Test this procedure on a local Supabase instance (`supabase start`) at least once so you know it works before you ever need it under pressure.

---

## 🛡️ Admin & Manual Procedures

- **Review/approve events & announcements:** Use `/admin` panel (Supabase Auth required)
- **Handle pending locations/organizations:** Approve via admin panel; not public until approved
- **Manual data import:** Use Python scripts in `scripts/` for CSV/ICS
- **Calendar Sync:**
  - All calendar platforms (iCal, Google, Outlook) use feed-based subscriptions (`/api/calendar/ical`)
  - Feeds are always up-to-date; calendar apps poll every 2-6 hours
  - Tag-based feeds supported via query params (e.g., `/api/calendar/ical?tag=Arts+Culture`)
  - See PROJECT_REQUIREMENTS.md for technical details
- **Initial data seed:**
  - Run `make db-initial-seed` to upload all reference and content data (tags, organizations, locations, events, announcements) from `/seed_data` to your database.
  - **Warning:** Only run this on a fresh database! It will insert all data, including events and announcements.

---

## 🧩 UI Component System

- Hybrid system: custom Astro components + Tailwind utilities
- Core UI: `Badge.astro`, `Button.astro`, `Input.astro`, `Select.astro`, `FormField.astro`
- Utilities: `date-utils.ts`, `components.css`
- No full UI library (e.g., daisyUI) to avoid bloat/conflicts
- See PROJECT_REQUIREMENTS.md for rationale

---

## 🧪 Testing & Code Quality

- `npm run lint` — Lint code
- `npm run format` — Format code
- `npm run test` — Run tests (if present)
- Manual testing: Use dev server and admin panel to verify all flows

---

## 🔒 Security & Monitoring

- RLS policies enforced in Supabase
- Private fields (emails, comments) only visible to admins
- Public APIs use field-level security via DB views
- Spam protection: honeypot fields and rate limiting on forms
- Monitor error rates and performance via analytics

---

## 📦 Dependency Updates

Dependabot (`.github/dependabot.yml`) automatically opens PRs every Monday for outdated packages across:
- **npm** (web app at `/`) — Astro, Solid.js, Tailwind, and all other dependencies
- **npm** (mobile app at `/mobile`) — Expo SDK, React Native stack
- **pip** (`requirements.txt`) — Python scripts
- **GitHub Actions** (monthly) — keeps workflow action versions current

### Review Process

- **Patch/minor PRs** (grouped into one PR per ecosystem): generally safe to merge once you've glanced at what changed
- **Major version PRs**: read the changelog before merging — these may have breaking changes
- **Expo SDK / Astro major bumps**: treat as mini-projects; test locally before merging
- **SaaS services** (Supabase, Netlify, Resend, Mapbox): these self-update; just watch for API deprecation notices in their changelog or emails

Batch-review Dependabot PRs at your convenience — there's no pressure to merge immediately. Nothing auto-merges.

---

## 🛠️ Troubleshooting & Maintenance

- If you encounter issues, check logs, Supabase status, and environment variables
- Use AI agent for troubleshooting and best practices
- Backups run automatically every Sunday — check the Actions tab if you suspect a failure
- Review and merge Dependabot PRs weekly (they open every Monday)

---

## 📝 Important Decisions & Architecture Notes

### Why Feed-Based Calendar Sync?
- Calendar apps (Google Calendar, Outlook, iCal) poll feeds every 2-6 hours automatically
- No need for push notifications or webhooks
- Simpler architecture, more reliable
- Feeds are generated on-demand for real-time updates

### Why Custom UI Components?
- Avoids bundle bloat from full UI libraries (e.g., daisyUI)
- Prevents conflicts with Tailwind utilities
- Full control over styling and behavior
- Easier to maintain and customize

### Why Hierarchical Kid Activities?
- Supports flexible program structures (PROGRAM → SESSION → CLASS_TYPE → CLASS_INSTANCE)
- Handles both fixed-term courses and rolling-enrollment programs
- Self-referencing table structure allows unlimited nesting
- Calendar exceptions cascade from parent to child activities

### Why Separate Staging Tables?
- Public submissions go to `events_staged` and `announcements_staged`
- Admin review before publishing to main tables
- Prevents spam and inappropriate content from appearing publicly
- Maintains data quality and community standards

### Why Python Scripts for Data Management?
- Better data validation with Pydantic
- Easier CSV/ICS parsing and transformation
- Can be run independently of the web app
- Reusable for batch operations and migrations

---

## 📚 Reference & Resources

### Project Documentation
- [README.md](./README.md): Project overview and quickstart
- [PROJECT_REQUIREMENTS.md](./PROJECT_REQUIREMENTS.md): System design, schema, implementation record, and future features
- [CUSTOMIZATION.md](./CUSTOMIZATION.md): How to customize theme, colors, location, and map settings
- [EMAIL_SETUP.md](./EMAIL_SETUP.md): Email configuration guide (Resend/Inbucket)
- [ADULT_ACTIVITIES_GUIDE.md](./ADULT_ACTIVITIES_GUIDE.md): Guide for adding adult activities

### External Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Astro Docs](https://docs.astro.build)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [FullCalendar Docs](https://fullcalendar.io/docs)