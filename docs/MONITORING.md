# Monitoring & Observability

How we find out when production breaks — and the guardrails that stop breakage
from shipping in the first place. There are **four layers**; each catches a
different class of problem.

| Layer | Tool | Catches | Alerts via |
|-------|------|---------|-----------|
| Error tracking | **Sentry** (web + mobile) | runtime exceptions, with stack traces | Sentry email/Slack on new issues |
| Uptime | **UptimeRobot** → `/api/health` | site down, DB unreachable | UptimeRobot email/SMS/Slack |
| Pre-merge CI | **GitHub Actions** (`.github/workflows/ci.yml`) | dependency/build breaks *before* they deploy | GitHub email on failed run |
| Deploy status | **CI run on push to `main`** | a failed build/deploy | GitHub email on failed run |

> Why this exists: production once 500'd for ~days and we found out from a *user
> email*. Two separate Dependabot bumps caused outages — `@astrojs/netlify` v7
> (incompatible peer broke `npm install`) and `@supabase/supabase-js` (its
> realtime client throws at construction on Node 18, which had no native
> WebSocket). The layers below are designed to catch exactly those classes.

---

## 1. Sentry — error tracking

**Web** (`@sentry/astro`): configured in `astro.config.mjs` (`sentry()` integration)
plus `sentry.client.config.js` and `sentry.server.config.js` at the repo root.
Both read the DSN from `PUBLIC_SENTRY_DSN` (the server config also falls back to
`process.env`). **Init is skipped when the DSN is unset, so it's a safe no-op.**

**Mobile** (`@sentry/react-native`): initialized in `mobile/app/_layout.tsx`.

### Setup for a deployment
1. In Sentry, create a project (platform **Astro**) → copy its **DSN**.
2. Add `PUBLIC_SENTRY_DSN` in Netlify env vars (Builds + Functions, all contexts).
3. Redeploy. Errors now flow to Sentry; tune email/Slack under Sentry → Alerts.
4. *(Optional)* For un-minified stack traces: create a Sentry auth token, set
   `SENTRY_AUTH_TOKEN` (Builds scope), and add `sourceMapsUploadOptions` (org +
   project) to the `sentry()` call in `astro.config.mjs`.

---

## 2. Uptime — `/api/health` + UptimeRobot

**`/api/health`** (`src/pages/api/health.ts`) is an unauthenticated SSR probe. It
runs the same query the events feed uses and returns JSON:

```json
{ "ok": true, "node": "v22.x", "eventsQuery": "ok",
  "env": { "publicSupabaseUrl": true, "publicSupabaseKey": true, "serviceRoleKey": true } }
```

- `eventsQuery: "ok"` → Supabase reachable and the query works.
- `node` → the runtime Node version (handy for diagnosing Node-version issues).
- `env` booleans → which critical env vars are present (never the values).

### Setup for a deployment
- UptimeRobot (free) → new **HTTP(s)** monitor → `https://<your-domain>/api/health`.
- Make it a **keyword** monitor: alert if the response does **not** contain
  `"eventsQuery": "ok"` — this catches DB-layer failures even when the page
  returns HTTP 200.
- Add alert contacts (email/SMS/Slack).

---

## 3. Pre-merge CI — the dependency canary

`.github/workflows/ci.yml` runs on every PR (including Dependabot's) and on push
to `main`. Critically, it uses **`node-version-file: .nvmrc`** so it runs on the
**same Node version production uses**. Steps:

1. `npm ci` — catches peer/version conflicts (the `@astrojs/netlify` v7 class).
2. **dependency-health canary** (`src/lib/__tests__/dependency-health.test.ts`,
   a.k.a. `npm run test:deps`) — constructs the Supabase client and fails if it
   throws (the realtime/WebSocket-on-Node-18 class).
3. `npm run build` — catches build-time breakage.

When a dependency bump would break the runtime, the PR check goes red instead of
the change reaching production. GitHub emails you when your own workflow run fails
(GitHub → Settings → Notifications → Actions).

> **Make it a required check:** GitHub → Settings → Branches → branch protection
> for `main` → require the **CI / verify** check, so a red Dependabot PR can't be
> merged.

---

## 4. Deploy / build failure alerts

Netlify's email notifications are Pro-only. On the free plan we rely on the **CI
run on push to `main`** (layer 3) — if a build/dependency break lands, that run
fails and GitHub emails you. Optionally add a Netlify **HTTP POST** notification
→ Slack/Discord incoming webhook (scoped to "Deploy failed") for Netlify-side
failures that never go through GitHub.

---

## Critical runtime gotchas (lessons learned)

- **Read env from `import.meta.env` *and* `process.env`.** `import.meta.env.FOO`
  is inlined at *build* time; if a var is missing from the build context it
  becomes `undefined` at runtime. `src/lib/supabase.ts` and
  `sentry.server.config.js` read `import.meta.env.X || process.env.X`.
- **Don't build a Supabase client at module top-level for things that can be
  lazy.** `supabaseAdmin` is built via a lazy `Proxy` so a missing
  `SUPABASE_SERVICE_ROLE_KEY` can't crash the whole site at import — only admin
  routes fail.
- **Keep `NODE_VERSION` (netlify.toml) and `.nvmrc` in sync** and current — newer
  `@supabase/*` requires Node 22+ for native WebSocket.
