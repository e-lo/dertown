# Mobile Deployment Guide

Building, deploying, and localizing the Dertown mobile app.

---

## Required Accounts

Before you can build or deploy, you need the following accounts. Set them up once; they are reused for all subsequent builds.

| Account | Cost | Purpose |
|---|---|---|
| [Expo / EAS](https://expo.dev) | Free | Cloud builds, push notifications, OTA updates |
| [Mapbox](https://mapbox.com) | Free tier | Map tiles (runtime) + SDK download (build time) |
| [Sentry](https://sentry.io) | Free tier | Crash reporting and error monitoring |
| [Apple Developer Program](https://developer.apple.com/programs/) | $99/year | iOS builds, TestFlight, App Store submission |
| [Google Play Console](https://play.google.com/console) | $25 one-time | Android Store submission |

---

## Environment Variables and Secrets

### Local development (`.env.local`)

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:4321
EXPO_PUBLIC_MAPBOX_TOKEN=pk.your_public_token_here
EXPO_PUBLIC_SENTRY_DSN=                          # leave blank to disable Sentry locally
```

### EAS environment variables (production builds)

Set these once in EAS. They are injected into every production build automatically.

```bash
# API base URL — baked into JS bundle, plaintext is fine
eas env:create production --name EXPO_PUBLIC_API_BASE_URL --value https://dertown.org --visibility plaintext --scope project

# Mapbox public token — baked into JS bundle
eas env:create production --name EXPO_PUBLIC_MAPBOX_TOKEN --visibility plaintext --scope project
# (EAS will prompt for the value interactively — safer than passing on the command line)

# Sentry DSN — baked into JS bundle
eas env:create production --name EXPO_PUBLIC_SENTRY_DSN --visibility plaintext --scope project
```

### EAS secrets (never shown after creation)

```bash
# Mapbox downloads token (sk. token) — authenticates SDK download during build
eas env:create production --name MAPBOX_DOWNLOADS_TOKEN --visibility secret --scope project

# Sentry auth token — uploads source maps so stack traces are readable
eas env:create production --name SENTRY_AUTH_TOKEN --visibility secret --scope project
```

**Where to get each token:**

- `EXPO_PUBLIC_MAPBOX_TOKEN` — [account.mapbox.com](https://account.mapbox.com) > Access Tokens > your default public `pk.` token
- `MAPBOX_DOWNLOADS_TOKEN` — [account.mapbox.com](https://account.mapbox.com) > Create a token > enable the **DOWNLOADS:READ** secret scope → generates a `sk.` token
- `EXPO_PUBLIC_SENTRY_DSN` — [sentry.io](https://sentry.io) > Project > Settings > Client Keys (DSN)
- `SENTRY_AUTH_TOKEN` — [sentry.io](https://sentry.io) > Organization Settings > Auth Tokens > Create token

---

## EAS CLI Setup

```bash
npm install -g eas-cli
eas login
```

Verify your project is linked:
```bash
eas project:info
```

---

## Build Profiles

The `eas.json` in this repo defines three profiles:

| Profile | Use for | Distribution |
|---|---|---|
| `development` | Testing on a physical device with hot reload | Internal (direct install) |
| `preview` | Sharing a test build (TestFlight / internal Play track) | Internal |
| `production` | App Store / Google Play submission | Store |

---

## Local Development (Simulator)

No EAS build needed for simulator testing:

```bash
cd mobile
npx expo start
```

- Press `i` for iOS simulator, `a` for Android emulator.
- **Expo Go is not supported** — the app uses native modules (Mapbox, Sentry) that require a compiled build. The simulator runs a compiled build automatically via `npx expo start`.

---

## Development Build (Physical Device)

A development build is a compiled app installed directly on your device. Required for testing push notifications, calendar integration, and native module behavior that the simulator may not fully replicate.

```bash
# Build (runs in the cloud, takes ~10-15 min first time)
eas build --profile development --platform ios
# or: --platform android   --platform all

# After the build downloads and installs on your device, start the local dev server:
npx expo start --dev-client
```

Scan the QR code in the terminal — the installed dev client connects to your local Metro server for hot reload.

> The development build needs to be rebuilt whenever you add or update a native dependency. Pure JS/TS changes do not require a new build.

---

## Preview Build

A preview build is a production-like binary distributed internally (TestFlight for iOS, internal track for Android). Use it for stakeholder testing before submitting to the store.

```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

Distribute via the EAS dashboard link, TestFlight, or Google Play internal track.

---

## Production Build

```bash
eas build --profile production --platform ios
eas build --profile production --platform android
# or both at once:
eas build --profile production --platform all
```

Builds run in the cloud. Monitor at [expo.dev](https://expo.dev) or in the terminal output.

**Before building for the first time:**
- Ensure all EAS environment variables and secrets are set (see above)
- Increment `ios.buildNumber` and `android.versionCode` in `app.json` for each new submission
- Apple: have an app record created in App Store Connect with matching bundle ID
- Android: have an app record created in Google Play Console with matching package name

---

## Submitting to App Stores

After a successful production build:

```bash
eas submit --platform ios      # prompts for App Store Connect API key on first run
eas submit --platform android  # prompts for Google Play service account JSON on first run
```

Store these credentials in EAS secrets (the CLI will offer to save them after first use).

---

## OTA Updates

JavaScript-only changes (no new or updated native modules) can be pushed without going through store review:

```bash
eas update --branch production --message "Fix event date display"
```

Users receive the update silently on next app launch. Use OTA updates for bug fixes and UI changes. Any change that adds, removes, or updates a native dependency requires a full `eas build` + store submission.

---

## Push Notifications

Push tokens are requested when users first open the News tab. The app requests permission, retrieves an Expo push token, and registers it with the backend at `POST /api/mobile/register-push-token`. Tokens are stored in the `push_tokens` Supabase table.

When an admin approves an announcement, the backend fans out push notifications to all registered tokens via Expo's Push Service (`https://exp.host/--/api/v2/push/send`).

**Credentials:**
- **iOS (APNs):** EAS manages the APNs key automatically when you run `eas build` while authenticated with an Apple Developer account.
- **Android (FCM):** Handled automatically by Expo's push service for managed-workflow apps — no extra configuration needed.

Push notifications do not work on simulators — a physical device is required.

---

## Localizing for a New Community

Use this checklist when deploying the app for a community other than Leavenworth.

### `mobile/lib/app-config.ts`

All town-specific values live here. Update every field:

- [ ] `townName` — display name shown throughout the UI
- [ ] `webBaseUrl` — public URL of the web app, no trailing slash
- [ ] `notificationChannelName` — Android notification channel label
- [ ] `storageKeyPrefix` — AsyncStorage key prefix (prevents collisions if multiple instances installed on same device)
- [ ] `timezone` — IANA timezone identifier (e.g. `America/Chicago`)
  - Also review `getPacificOffsetMinutes` in `lib/icalUtils.ts` — it contains US Pacific DST math that must be updated for non-Pacific timezones
- [ ] `mapCenter` — `{ longitude, latitude }` of the town center for the map's initial camera
- [ ] `contactEmail` — support and feedback email address
- [ ] `submitEventUrl` — URL to submit events on the web app
- [ ] `submitAnnouncementUrl` — URL to submit announcements
- [ ] `termsUrl` — URL to terms of use page
- [ ] `bugReportUrl` — URL to file a bug report
- [ ] `featureRequestUrl` — URL to request a feature

### `mobile/app.json`

- [ ] `name` — app display name
- [ ] `slug` — Expo project slug (must be unique on expo.dev)
- [ ] `ios.bundleIdentifier` — e.g. `com.yourtown.app`
- [ ] `android.package` — e.g. `com.yourtown.app`
- [ ] `ios.buildNumber` — reset to `"1"`
- [ ] `android.versionCode` — reset to `1`
- [ ] Sentry plugin `organization` and `project` — update to your Sentry org/project slugs

### Assets

- [ ] `assets/icon.png` — app icon (1024×1024)
- [ ] `assets/adaptive-icon.png` — Android adaptive icon foreground
- [ ] `assets/splash.png` — splash screen
- [ ] `assets/feature-graphic.png` — Google Play feature graphic (1024×500)
- [ ] `components/WelcomeModal.tsx` — the `MountainLogo` SVG is Leavenworth-specific; replace with your own

### EAS and accounts

- [ ] Create a new EAS project: `eas project:init`
- [ ] Set all EAS environment variables and secrets for the new project (see above)
- [ ] Create new app records in App Store Connect and Google Play Console
- [ ] Configure Sentry: new project, update DSN and auth token

### Help screen text

`app/help.tsx` contains example organization names (Icicle Creek Center for the Arts, Wenatchee River Institute, etc.) specific to Leavenworth. Update these to reflect your community's organizations.
