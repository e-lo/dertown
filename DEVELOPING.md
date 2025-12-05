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
- **Backup:** Use Supabase dashboard or CLI for backups; test recovery monthly

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

## 🛠️ Troubleshooting & Maintenance

- If you encounter issues, check logs, Supabase status, and environment variables
- Use AI agent for troubleshooting and best practices
- Regularly backup DB and test recovery
- Review and update dependencies monthly

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
- [EMAIL_SETUP.md](./EMAIL_SETUP.md): Email configuration guide (Resend/Inbucket)
- [ADULT_ACTIVITIES_GUIDE.md](./ADULT_ACTIVITIES_GUIDE.md): Guide for adding adult activities

### External Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Astro Docs](https://docs.astro.build)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [FullCalendar Docs](https://fullcalendar.io/docs)
