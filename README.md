# Der Town

A modern, community-driven events and announcements site for small towns.

- **Built with:** Astro, TypeScript, Supabase, Tailwind CSS, Embla Carousel
- **Maintained by:** Single contributor with AI agent assistance

[![Netlify Status](https://api.netlify.com/api/v1/badges/5f2db1b2-1070-4e9e-8ade-958de3b45534/deploy-status)](https://app.netlify.com/projects/dertown/deploys)

---

## 🚀 Quickstart

1. **Install dependencies:**

   ```sh
   npm install
   ```

2. **Start local dev server:**

   ```sh
   npm run dev
   ```

3. **Lint & format code:**

   ```sh
   npm run lint
   npm run format
   ```

4. **Reset & seed database:**

   ```sh
   make db-reset
   make db-seed
   ```

See [DEVELOPING.md](./DEVELOPING.md) for full setup, admin, and troubleshooting details.

---

## 🛠️ Tech Stack

- **Frontend:** Astro, Tailwind CSS, custom UI components, Embla Carousel (event carousel)
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Calendar UI:** FullCalendar.js
- **Python Utilities:** For data import, validation, and admin tasks
- **Hosting:** Netlify or Vercel
- **Automation:** GitHub Actions for scheduled jobs

---

## 📚 Documentation

- [DEVELOPING.md](./DEVELOPING.md): Developer/admin workflow, project organization, setup, Makefile/Python usage, troubleshooting
- [PROJECT_REQUIREMENTS.md](./PROJECT_REQUIREMENTS.md): Canonical requirements, system design, schema, implementation record, and future features
- [EMAIL_SETUP.md](./EMAIL_SETUP.md): Email configuration guide (Resend/Inbucket)
- [ADULT_ACTIVITIES_GUIDE.md](./ADULT_ACTIVITIES_GUIDE.md): Guide for adding adult activities to the "Things to Do" page

---

## 🔒 Security & Privacy

- Private fields (emails, comments) are only visible to authenticated admins
- Public APIs use field-level security via database views
- Spam protection: honeypot fields and rate limiting on forms

---

## 🤖 AI Agent Usage

- AI agents (like GPT-4) are used for code review, refactoring, and feature work
- All major changes are documented in commit messages
- See `.cursor/FEATURE.md` for AI agent development guidelines

---

## 🏁 Ready to go

- Start the dev server, seed the DB, and you’re ready to build or deploy
- For any questions, see DEVELOPING.md or describe your goal and let the AI agent help!
