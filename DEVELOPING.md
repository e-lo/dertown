# 🛠️ Developing Der Town

## 🤖 AI Agent & Single Contributor Workflow

- This project is maintained by a single contributor with AI agent assistance.
- For code review, refactoring, and new features, describe your goal and let the AI agent propose a plan and edits.
- Use the AI to keep code quality, documentation, and tests up to date.
- Document all major changes in commit messages and TODO.md.
- If you step away for a while, review this file and README.md to get back up to speed quickly.

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

## 🚀 Deployment

- Deploy to Netlify or Vercel
- Set environment variables in deployment dashboard
- For production, run `npm run build` and deploy output

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

## 📚 Reference & Resources

- [README.md](./README.md): Project overview and quickstart
- [PROJECT_REQUIREMENTS.md](./PROJECT_REQUIREMENTS.md): System design, schema, and implementation record
- [Supabase Docs](https://supabase.com/docs)
- [Astro Docs](https://docs.astro.build)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

---

## 📝 Updating This Documentation

- Keep this file concise and up to date as workflows evolve
- Document any new manual procedures or admin tasks
- Use the AI agent to help clarify and refactor documentation
